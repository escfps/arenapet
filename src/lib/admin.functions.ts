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

// ---------- Search ----------
export const adminSearchPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ query: z.string().trim().min(1).max(50) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, username, coins, gems, vip_until, arena_points, level, xp, wins, losses, is_bot")
      .ilike("username", `%${data.query}%`)
      .order("username", { ascending: true })
      .limit(20);
    return { profiles: profiles ?? [] };
  });

export const adminGetPlayerPets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { data: pets } = await supabaseAdmin
      .from("monsters")
      .select("id, name, species, rank, hp, atk, def, spd, int, in_team, team_position")
      .eq("owner_id", data.userId)
      .order("in_team", { ascending: false })
      .order("rank", { ascending: false });
    return { pets: pets ?? [] };
  });

// ---------- Grant resources ----------
export const adminGrantResources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        gems: z.number().int().min(-100000).max(100000).optional(),
        coins: z.number().int().min(-10000000).max(10000000).optional(),
        vipDays: z.number().int().min(0).max(3650).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("gems, coins, vip_until")
      .eq("id", data.userId)
      .single();
    if (!p) throw new Error("Jogador não encontrado");

    const update: { gems?: number; coins?: number; vip_until?: string } = {};
    if (typeof data.gems === "number" && data.gems !== 0) {
      update.gems = Math.max(0, (p.gems ?? 0) + data.gems);
    }
    if (typeof data.coins === "number" && data.coins !== 0) {
      update.coins = Math.max(0, (p.coins ?? 0) + data.coins);
    }
    if (typeof data.vipDays === "number" && data.vipDays > 0) {
      const base =
        p.vip_until && new Date(p.vip_until) > new Date()
          ? new Date(p.vip_until)
          : new Date();
      update.vip_until = new Date(
        base.getTime() + data.vipDays * 24 * 60 * 60 * 1000
      ).toISOString();
    }

    if (Object.keys(update).length === 0) return { ok: true, noop: true };

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(update)
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Pets ----------
export const adminRankUpPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        petId: z.string().uuid(),
        delta: z.number().int().min(-9).max(9),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { data: pet } = await supabaseAdmin
      .from("monsters")
      .select("id, rank")
      .eq("id", data.petId)
      .single();
    if (!pet) throw new Error("Pet não encontrado");
    const newRank = Math.min(10, Math.max(1, (pet.rank ?? 1) + data.delta));
    const { error } = await supabaseAdmin
      .from("monsters")
      .update({ rank: newRank })
      .eq("id", data.petId);
    if (error) throw new Error(error.message);
    return { ok: true, rank: newRank };
  });

export const adminAddPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        userId: z.string().uuid(),
        species: z.string().min(1).max(64),
        rank: z.number().int().min(1).max(10).default(1),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { error } = await supabaseAdmin.from("monsters").insert({
      owner_id: data.userId,
      species: data.species,
      name: data.species,
      rank: data.rank,
      hp: 0,
      atk: 0,
      def: 0,
      spd: 0,
      int: 0,
      in_team: false,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ petId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    assertAdmin(context.userId);
    const { error } = await supabaseAdmin
      .from("monsters")
      .delete()
      .eq("id", data.petId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
