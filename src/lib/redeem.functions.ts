import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ADMIN_USER_IDS = new Set<string>([
  "9efcc279-b110-4feb-862e-deea6acf858e",
]);

function assertAdmin(userId: string) {
  if (!ADMIN_USER_IDS.has(userId)) throw new Error("Acesso negado");
}

function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
    if (i === 3 || i === 7) out += "-";
  }
  return out;
}

const RewardSchema = z.discriminatedUnion("reward_type", [
  z.object({
    reward_type: z.literal("pet"),
    species: z.string().min(1).max(64),
    rank: z.number().int().min(1).max(10),
  }),
  z.object({
    reward_type: z.literal("chest"),
    chestTier: z.enum(["wood", "silver", "gold", "legendary"]),
  }),
  z.object({
    reward_type: z.literal("gems"),
    amount: z.number().int().min(1).max(100000),
  }),
  z.object({
    reward_type: z.literal("coins"),
    amount: z.number().int().min(1).max(10000000),
  }),
]);

export const adminCreateRedeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RewardSchema.parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { reward_type, ...rest } = data;
    // try a few times in case of collision
    for (let i = 0; i < 5; i++) {
      const code = genCode();
      const { data: ins, error } = await supabaseAdmin
        .from("redeem_codes")
        .insert({
          code,
          reward_type,
          reward_data: rest,
          created_by: context.userId,
        })
        .select("id, code")
        .single();
      if (!error) return { ok: true, code: ins.code, id: ins.id };
    }
    throw new Error("Falha ao gerar código único");
  });

export const adminListRedeemCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.userId);
    const { data: codes } = await supabaseAdmin
      .from("redeem_codes")
      .select("id, code, reward_type, reward_data, created_at, used_at, used_by")
      .order("created_at", { ascending: false })
      .limit(200);
    const userIds = Array.from(
      new Set((codes ?? []).map((c) => c.used_by).filter((x): x is string => !!x))
    );
    let usernames: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", userIds);
      usernames = Object.fromEntries((users ?? []).map((u) => [u.id, u.username]));
    }
    return {
      codes: (codes ?? []).map((c) => ({
        ...c,
        used_by_name: c.used_by ? usernames[c.used_by] ?? null : null,
      })),
    };
  });

export const adminDeleteRedeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("redeem_codes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Player redeem ----------
export const redeemCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ code: z.string().trim().min(3).max(32) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const codeNorm = data.code.toUpperCase().trim();
    const { data: row } = await supabaseAdmin
      .from("redeem_codes")
      .select("id, reward_type, reward_data, used_at")
      .eq("code", codeNorm)
      .maybeSingle();
    if (!row) throw new Error("Código inválido");
    if (row.used_at) throw new Error("Esse código já foi resgatado");

    // Atomically claim it
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("redeem_codes")
      .update({ used_at: new Date().toISOString(), used_by: context.userId })
      .eq("id", row.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (claimErr || !claimed) throw new Error("Esse código já foi resgatado");

    const rd = row.reward_data as Record<string, unknown>;
    const result: {
      type: string;
      species?: string;
      rank?: number;
      chestTier?: string;
      coins?: number;
      gems?: number;
    } = { type: row.reward_type };

    if (row.reward_type === "pet") {
      const species = String(rd.species);
      const rank = Math.min(10, Math.max(1, Number(rd.rank) || 1));
      await supabaseAdmin.from("monsters").insert({
        owner_id: context.userId,
        species,
        name: species,
        rank,
        hp: 0,
        atk: 0,
        def: 0,
        spd: 0,
        int: 0,
        in_team: false,
      });
      result.species = species;
      result.rank = rank;
    } else if (row.reward_type === "gems") {
      const amount = Math.max(0, Number(rd.amount) || 0);
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("gems")
        .eq("id", context.userId)
        .single();
      await supabaseAdmin
        .from("profiles")
        .update({ gems: (p?.gems ?? 0) + amount })
        .eq("id", context.userId);
      result.gems = amount;
    } else if (row.reward_type === "coins") {
      const amount = Math.max(0, Number(rd.amount) || 0);
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("coins")
        .eq("id", context.userId)
        .single();
      await supabaseAdmin
        .from("profiles")
        .update({ coins: (p?.coins ?? 0) + amount })
        .eq("id", context.userId);
      result.coins = amount;
    } else if (row.reward_type === "chest") {
      // Salva como "baú pendente" via flag — aqui simplificamos: damos as recompensas equivalentes
      // ao tier diretamente, e retornamos o tier para a animação.
      const tier = String(rd.chestTier);
      result.chestTier = tier;
      // Recompensa mínima de moedas/gemas para o tier
      const reward: Record<string, { coins: number; gems: number }> = {
        wood: { coins: 500, gems: 0 },
        silver: { coins: 1500, gems: 3 },
        gold: { coins: 4000, gems: 8 },
        legendary: { coins: 10000, gems: 20 },
      };
      const r = reward[tier] ?? reward.wood;
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("coins, gems")
        .eq("id", context.userId)
        .single();
      await supabaseAdmin
        .from("profiles")
        .update({
          coins: (p?.coins ?? 0) + r.coins,
          gems: (p?.gems ?? 0) + r.gems,
        })
        .eq("id", context.userId);
      result.coins = r.coins;
      result.gems = r.gems;
    }

    return { ok: true, reward: result };
  });
