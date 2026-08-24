import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Avança o relógio do torneio (antes era chamado direto pelo cliente). */
export const tickTournaments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("tournaments_tick");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Registra o resultado de uma partida de torneio. O vencedor é recalculado no
 * servidor com a MESMA semente determinística do cliente — assim o resultado
 * exibido é o mesmo, mas não pode ser forjado.
 */
export const reportTournamentMatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ matchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { simulateBattle, toBattleMonster } = await import("./battle");

    const { data: match } = await supabaseAdmin
      .from("tournament_matches")
      .select("id, p1_id, p2_id, status, winner_id")
      .eq("id", data.matchId)
      .maybeSingle();
    if (!match) throw new Error("Partida não encontrada");
    if (match.winner_id) return { ok: true, winnerId: match.winner_id as string, alreadyDone: true };
    if (match.p1_id !== context.userId && match.p2_id !== context.userId) {
      throw new Error("Você não participa desta partida");
    }

    const team = async (ownerId: string) => {
      const { data: rows } = await supabaseAdmin
        .from("monsters")
        .select("*")
        .eq("owner_id", ownerId)
        .eq("in_team", true)
        .order("team_position", { ascending: true })
        .limit(3);
      return (rows ?? []).slice(0, 3);
    };
    const [t1, t2] = await Promise.all([team(match.p1_id as string), team(match.p2_id as string)]);
    if (t1.length < 3 || t2.length < 3) throw new Error("Times incompletos");

    const seed =
      (data.matchId.split("").reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7) >>> 0);
    const result = simulateBattle(
      t1.map((m) => toBattleMonster(m as never)),
      t2.map((m) => toBattleMonster(m as never)),
      seed,
    );
    if (result.winner === "draw") return { ok: false, winnerId: null };

    const winnerId = result.winner === "team_a" ? (match.p1_id as string) : (match.p2_id as string);
    const { error } = await supabaseAdmin.rpc("report_match_result", {
      p_match_id: data.matchId,
      p_winner_id: winnerId,
      p_log: result.log as unknown as never,
    });
    if (error) throw new Error(error.message);
    return { ok: true, winnerId, alreadyDone: false };
  });
