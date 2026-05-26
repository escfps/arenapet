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
