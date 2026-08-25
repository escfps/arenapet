import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { POKE_TYPES } from "@/lib/moves";
import type { NpcTeamMember } from "./gym-npc";

const TypeSchema = z.enum(POKE_TYPES as unknown as [string, ...string[]]);

/** Inicia o desafio de ginásio: gasta insígnias/energia e simula no servidor. */
export const gymChallengeStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ type: TypeSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeBattleEnergy } = await import("./game-data");
    const { simulateBattle, toBattleMonster } = await import("./battle");
    const { buildNpcTeam, vacantLeaderName } = await import("./gym-npc");
    const { getTypes } = await import("./moves");
    const t = data.type as Parameters<typeof getTypes>[0] extends string ? string : string;

    const { data: gym } = await supabaseAdmin
      .from("gyms")
      .select("*")
      .eq("type", data.type)
      .maybeSingle();
    if (!gym) throw new Error("Ginásio não encontrado");
    if (gym.leader_id === context.userId) throw new Error("Você já é o líder deste ginásio!");

    const { data: teamRows } = await supabaseAdmin
      .from("monsters")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("in_team", true)
      .order("team_position", { ascending: true })
      .limit(3);
    const myTeam = (teamRows ?? []).slice(0, 3);
    if (myTeam.length < 3) throw new Error("Monte um time com 3 pokémons antes! 🎒");
    if (myTeam.some((m) => (m.hunger ?? 100) <= 0)) throw new Error("Algum pokémon está faminto! 🍖");
    const energies = myTeam.map((m) => computeBattleEnergy(m.battle_energy, m.battle_energy_at));
    if (Math.min(...energies.map((e) => e.energy)) < 1) {
      throw new Error("Algum pokémon do time está sem energia de batalha! ⚡");
    }

    // Ginásios não-iniciais consomem 5 insígnias diferentes
    if (!gym.starter) {
      const { error: spendErr } = await context.supabase.rpc("gym_start_challenge", { p_type: data.type });
      if (spendErr) throw new Error("Você precisa de 5 insígnias diferentes para desafiar! 🎖️");
    }

    // Time inimigo: líder atual ou NPC
    let enemyTeam: NpcTeamMember[] = [];
    let enemyName = vacantLeaderName(data.type as never);
    let isNpc = true;
    if (gym.leader_id) {
      const { data: leaderTeam } = await supabaseAdmin
        .from("monsters")
        .select("*")
        .eq("owner_id", gym.leader_id)
        .eq("in_team", true)
        .order("team_position", { ascending: true })
        .limit(3);
      const rows = (leaderTeam ?? []).slice(0, 3);
      if (rows.length === 3) {
        enemyTeam = rows.map((r, i) => ({
          id: r.id,
          owner_id: r.owner_id,
          species: r.species,
          name: r.name,
          hp: r.hp, atk: r.atk, def: r.def, spd: r.spd, int: r.int, crit: r.crit ?? 0,
          hunger: r.hunger ?? 100, energy: r.energy ?? 100, happiness: r.happiness ?? 100,
          skin: r.skin ?? "default",
          in_team: true,
          rank: r.rank ?? 1,
          team_position: r.team_position ?? i,
          is_shiny: r.is_shiny === true,
        }));
        isNpc = false;
        const { data: lp } = await supabaseAdmin
          .from("profiles")
          .select("username")
          .eq("id", gym.leader_id)
          .maybeSingle();
        enemyName = (lp?.username as string) ?? "Líder";
      }
    }
    if (enemyTeam.length !== 3) enemyTeam = buildNpcTeam(data.type as never);
    if (enemyTeam.length !== 3) throw new Error("Este ginásio ainda não tem líder disponível.");

    // Consome energia + fome
    await Promise.all(
      myTeam.map((m, i) => {
        const hungerLoss = 1 + Math.floor(Math.random() * 3);
        return supabaseAdmin
          .from("monsters")
          .update({
            battle_energy: Math.max(0, energies[i].energy - 1),
            battle_energy_at: energies[i].nextStoredAt,
            hunger: Math.max(0, (m.hunger ?? 100) - hungerLoss),
          } as never)
          .eq("id", m.id);
      }),
    );

    const pure = myTeam.every((m) => getTypes(m.species).includes(data.type as never));
    void t;

    const a = myTeam.map((m) => toBattleMonster(m as never));
    const b = enemyTeam.map((m) => toBattleMonster(m as never));
    const result = simulateBattle(a, b);

    const { data: session, error } = await supabaseAdmin
      .from("battle_sessions")
      .insert({
        user_id: context.userId,
        kind: "gym",
        gym_type: data.type,
        winner: result.winner,
        payload: { log: result.log, teamA: a, teamB: b, pure },
      } as never)
      .select("id")
      .single();
    if (error || !session) throw new Error(error?.message ?? "Falha ao iniciar desafio");

    return {
      sessionId: session.id as string,
      log: result.log,
      winner: result.winner,
      enemyTeam,
      enemyName,
      isNpc,
      pure,
      myTeam,
    };
  });

/** Encerra o desafio e registra o resultado (insígnia/liderança). */
export const gymChallengeFinish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sessionId: z.string().uuid(),
        visibleTurns: z.number().int().min(0).max(100000).default(0),
        forfeit: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeWinnerFromVisibleLog } = await import("./battle");

    const { data: claimed } = await supabaseAdmin
      .from("battle_sessions")
      .update({ applied: true } as never)
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .eq("applied", false)
      .select("*")
      .maybeSingle();
    if (!claimed) throw new Error("Desafio já finalizado");

    const payload = claimed.payload as {
      log: Parameters<typeof computeWinnerFromVisibleLog>[2];
      teamA: Parameters<typeof computeWinnerFromVisibleLog>[0];
      teamB: Parameters<typeof computeWinnerFromVisibleLog>[1];
      pure: boolean;
    };

    let finalWinner: "team_a" | "team_b" | "draw";
    if (data.forfeit) finalWinner = "team_b";
    else if (data.visibleTurns >= payload.log.length) {
      finalWinner = claimed.winner as "team_a" | "team_b" | "draw";
    } else {
      finalWinner = computeWinnerFromVisibleLog(
        payload.teamA, payload.teamB, payload.log, data.visibleTurns,
      );
    }

    const won = finalWinner === "team_a";
    const { data: res, error } = await context.supabase.rpc("gym_report_result", {
      p_type: claimed.gym_type as string,
      p_won: won,
      p_pure: won && payload.pure === true,
    });
    if (error) throw new Error(error.message);
    const out = (res ?? {}) as { badge_earned?: boolean; became_leader?: boolean };
    return { won, badge: !!out.badge_earned, leader: !!out.became_leader };
  });
