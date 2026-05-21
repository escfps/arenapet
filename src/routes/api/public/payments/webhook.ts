import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// price_id (external_id) -> total de gemas a creditar
const GEMS_BY_PRICE: Record<string, number> = {
  gems_starter_price: 50,
  gems_pro_price: 170,
  gems_epic_price: 480,
  gems_legend_price: 1300,
};

const BATTLE_PASS_PRICE_ID = "battle_pass_monthly";

async function handleTransactionCompleted(data: any, env: PaddleEnv) {
  const transactionId: string = data.id;
  const userId: string | undefined = data.customData?.userId;
  if (!userId) {
    console.warn("transaction.completed sem userId em customData", { transactionId });
    return;
  }
  const item = data.items?.[0];
  const priceId: string | undefined = item?.price?.importMeta?.externalId;
  if (!priceId) {
    console.warn("transaction.completed sem importMeta.externalId", { transactionId });
    return;
  }

  // Passe de Batalha é tratado via subscription events
  if (priceId === BATTLE_PASS_PRICE_ID) return;

  const gems = GEMS_BY_PRICE[priceId];
  if (!gems) {
    console.warn("price_id desconhecido", { priceId });
    return;
  }

  const supabase = getSupabase();

  const amount = Number(data.details?.totals?.total ?? 0);
  const { error: insertErr } = await supabase.from("gem_purchases").insert({
    user_id: userId,
    paddle_transaction_id: transactionId,
    price_id: priceId,
    gems_credited: gems,
    amount_brl: amount,
    environment: env,
  });
  if (insertErr) {
    if ((insertErr as any).code === "23505") {
      console.log("transação já processada, ignorando", transactionId);
      return;
    }
    throw insertErr;
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("gems")
    .eq("id", userId)
    .single();
  if (pErr) throw pErr;
  const newTotal = (profile?.gems ?? 0) + gems;
  const { error: uErr } = await supabase
    .from("profiles")
    .update({ gems: newTotal })
    .eq("id", userId);
  if (uErr) throw uErr;

  console.log(`Creditadas ${gems} 💎 ao usuário ${userId} (tx ${transactionId})`);
}

async function applyBattlePassSubscription(data: any, _env: PaddleEnv) {
  const userId: string | undefined = data.customData?.userId;
  if (!userId) {
    console.warn("subscription event sem userId em customData", data.id);
    return;
  }
  const item = data.items?.[0];
  const priceId: string | undefined = item?.price?.importMeta?.externalId;
  if (priceId !== BATTLE_PASS_PRICE_ID) {
    console.log("subscription ignorada (não é battle pass):", priceId);
    return;
  }

  const supabase = getSupabase();
  const status: string = data.status;
  const periodEnd: string | null = data.currentBillingPeriod?.endsAt ?? null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("vip_until, bp_subscription_id")
    .eq("id", userId)
    .single();

  const update: Record<string, unknown> = {
    bp_subscription_id: data.id,
    bp_customer_id: data.customerId,
    bp_status: status,
  };

  const isActive = ["active", "trialing", "past_due"].includes(status);

  if (isActive && periodEnd) {
    update.vip_until = periodEnd;
    // se é uma nova assinatura (ID mudou), zera contadores diários
    if (profile?.bp_subscription_id !== data.id) {
      update.bp_started_at = new Date().toISOString();
      update.bp_last_claim_date = null;
      update.bp_days_claimed = 0;
      update.bp_silvers_given = 0;
      update.bp_monthly_claimed = false;
    }
  } else if (status === "canceled") {
    // mantém vip_until até o fim do período pago
    if (periodEnd) update.vip_until = periodEnd;
  }

  const { error: uErr } = await supabase.from("profiles").update(update).eq("id", userId);
  if (uErr) throw uErr;

  console.log(`Battle Pass ${status} para ${userId} até ${periodEnd}`);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
      break;
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
      await applyBattlePassSubscription(event.data, env);
      break;
    default:
      console.log("Evento não tratado:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
