import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Mapeia product IDs do StoreKit pra quantidade de gemas (inclui bônus).
// Fonte de verdade no servidor pra evitar trapaça do cliente.
export const IOS_GEM_PRODUCTS: Record<string, { gems: number }> = {
  "com.arenapet.gems.50": { gems: 50 },
  "com.arenapet.gems.150": { gems: 170 }, // 150 + 20 bônus
  "com.arenapet.gems.400": { gems: 480 }, // 400 + 80 bônus
  "com.arenapet.gems.1000": { gems: 1300 }, // 1000 + 300 bônus
};

const Schema = z.object({
  productId: z.string().min(1).max(100),
  transactionId: z.string().min(1).max(200),
  platform: z.enum(["ios"]),
});

export const creditIapGems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const product = IOS_GEM_PRODUCTS[data.productId];
    if (!product) throw new Error("Produto desconhecido");

    // Idempotência: insere transação; se já existe, é replay.
    const { error: insErr } = await supabaseAdmin.from("iap_transactions").insert({
      user_id: userId,
      platform: data.platform,
      product_id: data.productId,
      transaction_id: data.transactionId,
      gems_credited: product.gems,
    });
    if (insErr) {
      if (insErr.code === "23505") {
        // já foi creditado antes — retorna sucesso silencioso pra evitar UI travada
        return { ok: true, alreadyCredited: true, gems: 0 };
      }
      throw new Error(insErr.message);
    }

    const { data: me, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("gems")
      .eq("id", userId)
      .single();
    if (profErr || !me) throw new Error("Perfil não encontrado");

    const newGems = (me.gems ?? 0) + product.gems;
    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update({ gems: newGems })
      .eq("id", userId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, alreadyCredited: false, gems: product.gems, total: newGems };
  });

// === Battle Pass via StoreKit (iOS) ===
export const IOS_BATTLE_PASS_PRODUCT = "com.arenapet.battlepass.monthly";

const BPSchema = z.object({
  productId: z.literal(IOS_BATTLE_PASS_PRODUCT),
  transactionId: z.string().min(1).max(200),
  platform: z.literal("ios"),
});

export const activateIosBattlePass = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => BPSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // Idempotência por transactionId
    const { error: insErr } = await supabaseAdmin.from("iap_transactions").insert({
      user_id: userId,
      platform: data.platform,
      product_id: data.productId,
      transaction_id: data.transactionId,
      gems_credited: 0,
    });
    const isReplay = insErr?.code === "23505";
    if (insErr && !isReplay) throw new Error(insErr.message);

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("vip_until, bp_subscription_id")
      .eq("id", userId)
      .single();
    if (profErr || !profile) throw new Error("Perfil não encontrado");

    if (isReplay) {
      return { ok: true, alreadyCredited: true, vip_until: profile.vip_until };
    }

    // Estende vip_until por 30 dias (a partir do maior entre agora e vip_until atual)
    const now = Date.now();
    const currentEnd = profile.vip_until ? new Date(profile.vip_until).getTime() : 0;
    const base = Math.max(now, currentEnd);
    const newEnd = new Date(base + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Se é uma nova assinatura (sem BP ativa), zera os contadores diários
    const isNewSubscription = !currentEnd || currentEnd < now;
    const update: Record<string, unknown> = {
      vip_until: newEnd,
      bp_subscription_id: data.transactionId,
      bp_status: "active",
    };
    if (isNewSubscription) {
      update.bp_started_at = new Date().toISOString();
      update.bp_last_claim_date = null;
      update.bp_days_claimed = 0;
      update.bp_silvers_given = 0;
      update.bp_monthly_claimed = false;
    }

    const { error: upErr } = await supabaseAdmin
      .from("profiles")
      .update(update)
      .eq("id", userId);
    if (upErr) throw new Error(upErr.message);

    return { ok: true, alreadyCredited: false, vip_until: newEnd };
  });

