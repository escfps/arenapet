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
      .select("id, code, reward_type, reward_data, created_at, used_at, used_by, max_uses, uses_count")
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

export const adminListCodeUsages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ code_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { data: uses } = await supabaseAdmin
      .from("redeem_code_uses")
      .select("id, user_id, used_at")
      .eq("code_id", data.code_id)
      .order("used_at", { ascending: false });
    const ids = Array.from(new Set((uses ?? []).map((u) => u.user_id)));
    let usernames: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: users } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      usernames = Object.fromEntries((users ?? []).map((u) => [u.id, u.username]));
    }
    return {
      uses: (uses ?? []).map((u) => ({
        ...u,
        username: usernames[u.user_id] ?? "?",
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
      .select("id, reward_type, reward_data, used_at, max_uses, uses_count")
      .eq("code", codeNorm)
      .maybeSingle();
    if (!row) throw new Error("Código inválido");

    const maxUses = (row as { max_uses?: number }).max_uses ?? 1;
    const usesCount = (row as { uses_count?: number }).uses_count ?? 0;

    if (maxUses <= 1) {
      if (row.used_at) throw new Error("Esse código já foi resgatado");
    } else {
      if (usesCount >= maxUses) throw new Error("Esse código atingiu o limite de resgates");
      // Já resgatou nessa conta?
      const { data: prev } = await supabaseAdmin
        .from("redeem_code_uses")
        .select("id")
        .eq("code_id", row.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (prev) throw new Error("Você já resgatou esse código nessa conta");
    }

    // Atomically claim it
    if (maxUses <= 1) {
      const { data: claimed, error: claimErr } = await supabaseAdmin
        .from("redeem_codes")
        .update({ used_at: new Date().toISOString(), used_by: context.userId })
        .eq("id", row.id)
        .is("used_at", null)
        .select("id")
        .maybeSingle();
      if (claimErr || !claimed) throw new Error("Esse código já foi resgatado");
    } else {
      // Insere o uso (unique constraint code_id+user_id garante 1x por conta)
      const { error: useErr } = await supabaseAdmin
        .from("redeem_code_uses")
        .insert({ code_id: row.id, user_id: context.userId });
      if (useErr) throw new Error("Você já resgatou esse código nessa conta");
      // Incrementa o contador (best-effort; o gate principal é a tabela _uses)
      await supabaseAdmin
        .from("redeem_codes")
        .update({ uses_count: usesCount + 1 })
        .eq("id", row.id);
    }

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
      // Entrega 1 baú do tier no inventário do jogador
      const tier = String(rd.chestTier);
      const itemType: Record<string, string> = {
        wood: "wood_chest",
        silver: "silver_chest",
        gold: "gold_chest",
        legendary: "legendary_chest",
      };
      const item = itemType[tier] ?? "gold_chest";
      const { data: inv } = await supabaseAdmin
        .from("inventory")
        .select("quantity")
        .eq("user_id", context.userId)
        .eq("item_type", item)
        .maybeSingle();
      await supabaseAdmin.from("inventory").upsert(
        { user_id: context.userId, item_type: item, quantity: (inv?.quantity ?? 0) + 1 },
        { onConflict: "user_id,item_type" },
      );
      result.chestTier = tier;
    }

    return { ok: true, reward: result };
  });

