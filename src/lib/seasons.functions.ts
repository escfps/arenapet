import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SeasonInfo = {
  id: string;
  number: number;
  started_at: string;
  ends_at: string;
  legendary_filled: number;
  legendary_slots: number;
};

export type SeasonTrophy = {
  season_number: number;
  tier: string;
  final_rank: number | null;
  arena_points: number;
};

export const getCurrentSeason = createServerFn({ method: "GET" }).handler(async (): Promise<SeasonInfo> => {
  // ensure tick has run (idempotent — closes expired, creates next)
  await supabaseAdmin.rpc("seasons_tick");

  const { data: s, error } = await supabaseAdmin
    .from("seasons")
    .select("id, number, started_at, ends_at")
    .eq("status", "active")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!s) throw new Error("Nenhuma season ativa");

  // Top 10 com arena_points >= 4000 = vagas Lendário preenchidas
  const { data: top } = await supabaseAdmin
    .from("profiles")
    .select("arena_points")
    .gte("arena_points", 4000)
    .order("arena_points", { ascending: false })
    .limit(10);

  return {
    id: s.id,
    number: s.number,
    started_at: s.started_at,
    ends_at: s.ends_at,
    legendary_filled: top?.length ?? 0,
    legendary_slots: 10,
  };
});

export const getUserTrophies = createServerFn({ method: "GET" })
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data }): Promise<SeasonTrophy[]> => {
    const { data: rows, error } = await supabaseAdmin
      .from("season_trophies")
      .select("season_number, tier, final_rank, arena_points")
      .eq("user_id", data.userId)
      .order("season_number", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []) as SeasonTrophy[];
  });
