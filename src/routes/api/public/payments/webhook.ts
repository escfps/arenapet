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
  gems_starter_price: 30,
  gems_pro_price: 120,
  gems_epic_price: 400,
  gems_legend_price: 1100,
};

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
  const gems = GEMS_BY_PRICE[priceId];
  if (!gems) {
    console.warn("price_id desconhecido", { priceId });
    return;
  }

  const supabase = getSupabase();

  // Idempotência: insere o registro de compra; se a transação já foi processada,
  // a constraint UNIQUE em paddle_transaction_id falha e nada é creditado.
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

  // Credita as gems no profile (read-modify-write — sem RPC)
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

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.TransactionCompleted:
      await handleTransactionCompleted(event.data, env);
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
