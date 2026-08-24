import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ChestReward, ChestTier } from "./game-data";

const PromoSchema = z
  .object({
    wins: z.number().int().min(0).max(5),
    losses: z.number().int().min(0).max(5),
    type: z.enum(["bo3", "bo5"]),
    targetFrom: z.number().int().min(0).max(100000),
  })
  .nullable()
  .default(null);

/**
 * Inicia a batalha de arena: consome energia/fome, simula NO SERVIDOR e
 * guarda o resultado numa sessão. O cliente só recebe o log pra animar.
 */
export const arenaStart = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ opponentId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computeBattleEnergy, MAX_BATTLE_ENERGY } = await import("./game-data");
    const { simulateBattle, toBattleMonster } = await import("./battle");

    if (data.opponentId === context.userId) throw new Error("Oponente inválido");

    const { data: myTeamRows } = await supabaseAdmin
      .from("monsters")
      .select("*")
      .eq("owner_id", context.userId)
      .eq("in_team", true)
      .order("team_position", { ascending: true })
      .limit(3);
    const myTeam = (myTeamRows ?? []).slice(0, 3);
    if (myTeam.length === 0) throw new Error("Você não tem pokémons no time!");
    if (myTeam.some((m) => (m.hunger ?? 100) <= 0)) throw new Error("Algum pokémon está faminto! 🍖");

    const energies = myTeam.map((m) => computeBattleEnergy(m.battle_energy, m.battle_energy_at));
    if (Math.min(...energies.map((e) => e.energy)) < 1) {
      throw new Error("Algum pokémon do seu time está sem energia de batalha! ⚡");
    }

    const { data: oppProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, username, arena_points, is_bot")
      .eq("id", data.opponentId)
      .maybeSingle();
    if (!oppProfile) throw new Error("Oponente não encontrado");

    if (oppProfile.is_bot) {
      await supabaseAdmin
        .from("monsters")
        .update({
          battle_energy: MAX_BATTLE_ENERGY,
          battle_energy_at: new Date().toISOString(),
          hunger: 100,
        } as never)
        .eq("owner_id", data.opponentId);
    }

    const { data: oppTeamRows } = await supabaseAdmin
      .from("monsters")
      .select("*")
      .eq("owner_id", data.opponentId)
      .eq("in_team", true)
      .order("team_position", { ascending: true })
      .limit(3);
    const oppTeam = (oppTeamRows ?? []).slice(0, 3);
    if (oppTeam.length === 0) throw new Error("Oponente sem time completo");

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

    const a = myTeam.map((m) => toBattleMonster(m as never));
    const b = oppTeam.map((m) => toBattleMonster(m as never));
    const result = simulateBattle(a, b);

    const { data: session, error } = await supabaseAdmin
      .from("battle_sessions")
      .insert({
        user_id: context.userId,
        kind: "arena",
        opponent_id: data.opponentId,
        winner: result.winner,
        payload: {
          log: result.log,
          teamA: a,
          teamB: b,
          oppArenaPoints: oppProfile.arena_points ?? 0,
        },
      } as never)
      .select("id")
      .single();
    if (error || !session) throw new Error(error?.message ?? "Falha ao iniciar batalha");

    return {
      sessionId: session.id as string,
      log: result.log,
      winner: result.winner,
      teamA: a,
      teamB: b,
      myTeam,
      opponent: {
        ownerId: data.opponentId,
        ownerName: oppProfile.username as string,
        arenaPoints: oppProfile.arena_points ?? 0,
        team: oppTeam,
      },
    };
  });

/**
 * Encerra a batalha: define o vencedor final (desistência ou tempo esgotado
 * usam o log guardado no servidor) e credita as recompensas UMA única vez.
 */
export const arenaFinish = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        sessionId: z.string().uuid(),
        visibleTurns: z.number().int().min(0).max(100000).default(0),
        forfeit: z.boolean().default(false),
        promo: PromoSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const S = await import("./economy.server");
    const {
      computeRewards, computeWinnerFromVisibleLog,
    } = await import("./battle");
    const {
      isVip, rollArenaPoints, promoNeeded, divisionBounds, xpForNextLevel,
      rollLevelUpRewards, getTier, tierRankIndex, tierPromotionChests, rollChest, CHESTS,
    } = await import("./game-data");

    // Consome a sessão de forma atômica (impede recompensa repetida)
    const { data: claimed } = await supabaseAdmin
      .from("battle_sessions")
      .update({ applied: true } as never)
      .eq("id", data.sessionId)
      .eq("user_id", context.userId)
      .eq("applied", false)
      .select("*")
      .maybeSingle();
    if (!claimed) throw new Error("Batalha já finalizada");

    const payload = claimed.payload as {
      log: Parameters<typeof computeWinnerFromVisibleLog>[2];
      teamA: Parameters<typeof computeWinnerFromVisibleLog>[0];
      teamB: Parameters<typeof computeWinnerFromVisibleLog>[1];
      oppArenaPoints: number;
    };
    const fullWinner = claimed.winner as "team_a" | "team_b" | "draw";

    let finalWinner: "team_a" | "team_b" | "draw";
    if (data.forfeit) {
      finalWinner = "team_b";
    } else if (data.visibleTurns >= payload.log.length) {
      finalWinner = fullWinner;
    } else {
      finalWinner = computeWinnerFromVisibleLog(
        payload.teamA, payload.teamB, payload.log, data.visibleTurns,
      );
    }

    const profile = await S.getProfile(context.userId);
    const isDraw = finalWinner === "draw";
    const won = finalWinner === "team_a";
    const rew = isDraw
      ? { coins: 0, xp: 0 }
      : computeRewards(profile.level, won, isVip(profile.vip_until));
    const gemWin = !isDraw && Math.random() < (won ? 0.5 : 0.25) ? 1 : 0;

    const oldPoints = (profile as { arena_points?: number }).arena_points ?? 0;
    const myRoll = rollArenaPoints(oldPoints);
    const oppRoll = rollArenaPoints(payload.oppArenaPoints);
    const promo = data.promo;

    let newPoints = oldPoints;
    let delta = 0;
    let promoMsg: string | undefined;
    let nextPromo = promo;
    const chests: Array<{ tier: ChestTier; label: string; reward: ChestReward }> = [];
    const messages: string[] = [];
    let rationsDropped = 0;

    if (isDraw) {
      promoMsg = "🤝 Empate — pontos preservados";
      await S.patchProfile(context.userId, {});
    } else {
      if (promo) {
        const updated = { ...promo, wins: promo.wins + (won ? 1 : 0), losses: promo.losses + (won ? 0 : 1) };
        const need = promoNeeded(promo.type);
        if (updated.wins >= need) {
          const b = divisionBounds(oldPoints);
          newPoints = b ? b.end : oldPoints + 1;
          delta = newPoints - oldPoints;
          nextPromo = null;
          promoMsg = promo.type === "bo5" ? "👑 SUBIU DE TIER!" : "🎉 Promovido!";
        } else if (updated.losses >= need) {
          newPoints = Math.max(0, oldPoints - 30);
          delta = newPoints - oldPoints;
          nextPromo = null;
          promoMsg = "😢 Série de promoção fracassou";
        } else {
          nextPromo = updated;
          promoMsg = `Série ${promo.type.toUpperCase()}: ${updated.wins}V ${updated.losses}D`;
        }
      } else {
        delta = won ? myRoll.win : -myRoll.loss;
        newPoints = Math.max(0, oldPoints + delta);
        const b = divisionBounds(oldPoints);
        if (b && newPoints >= b.end) {
          newPoints = b.end - 1;
          delta = newPoints - oldPoints;
          nextPromo = {
            wins: 0, losses: 0,
            type: b.nextIsTierUp ? ("bo5" as const) : ("bo3" as const),
            targetFrom: oldPoints,
          };
          promoMsg = b.nextIsTierUp ? "🔥 Série de tier MD5 iniciada!" : "⚡ Série de promoção MD3 iniciada!";
        }
      }

      const updates: Record<string, number> = {
        coins: (profile.coins ?? 0) + rew.coins,
        gems: (profile.gems ?? 0) + gemWin,
        xp: (profile.xp ?? 0) + rew.xp,
        wins: ((profile as { wins?: number }).wins ?? 0) + (won ? 1 : 0),
        losses: ((profile as { losses?: number }).losses ?? 0) + (won ? 0 : 1),
        arena_points: newPoints,
      };

      let newXp = updates.xp;
      let newLevel = profile.level;
      while (newXp >= xpForNextLevel(newLevel)) {
        newXp -= xpForNextLevel(newLevel);
        newLevel += 1;
      }
      updates.xp = newXp;
      updates.level = newLevel;

      if (newLevel > profile.level) {
        const lvRew = rollLevelUpRewards(profile.level, newLevel);
        updates.coins += lvRew.coins;
        updates.gems += lvRew.gems;
        if (lvRew.rations > 0) {
          await S.addItem(context.userId, "ration", lvRew.rations);
          rationsDropped += lvRew.rations;
        }
        if (lvRew.petSpecies.length > 0) {
          await S.grantMonsters(context.userId, lvRew.petSpecies.map((species) => ({ species })));
        }
        for (const c of lvRew.chests) {
          chests.push({ tier: c.tier, label: `Level ${c.level}!`, reward: c.reward });
        }
        const parts: string[] = [];
        if (lvRew.coins) parts.push(`🪙 ${lvRew.coins}`);
        if (lvRew.gems) parts.push(`💎 ${lvRew.gems}`);
        if (lvRew.rations) parts.push(`🍖 ${lvRew.rations}`);
        if (lvRew.petSpecies.length) parts.push(`🥚 ${lvRew.petSpecies.length} pet(s)`);
        if (parts.length) messages.push(`Recompensas: ${parts.join(" • ")}`);
      }

      // Promoção de tier: baús extras
      const oldTierName = getTier(oldPoints).name;
      const newTierName = getTier(newPoints).name;
      const newTierIdx = tierRankIndex(newTierName);
      const highest = (profile as { highest_tier_rank?: number }).highest_tier_rank ?? 0;
      if (oldTierName !== newTierName && newTierIdx > highest) {
        const counts = tierPromotionChests(newTierName);
        const tiersToRoll: Array<"silver" | "gold" | "legendary"> = [];
        for (let i = 0; i < counts.silver; i++) tiersToRoll.push("silver");
        for (let i = 0; i < counts.gold; i++) tiersToRoll.push("gold");
        for (let i = 0; i < counts.legendary; i++) tiersToRoll.push("legendary");
        if (tiersToRoll.length > 0) {
          let bonusRations = 0;
          const bonusPets: string[] = [];
          for (const tk of tiersToRoll) {
            const r = rollChest(tk);
            updates.coins += r.coins;
            updates.gems += r.gems;
            bonusRations += r.rations;
            if (r.petSpecies) bonusPets.push(r.petSpecies);
            chests.push({ tier: tk, label: `Promoção pra ${newTierName}!`, reward: r });
          }
          if (bonusRations > 0) {
            await S.addItem(context.userId, "ration", bonusRations);
            rationsDropped += bonusRations;
          }
          if (bonusPets.length > 0) {
            await S.grantMonsters(context.userId, bonusPets.map((species) => ({ species })));
          }
          messages.push(
            `👑 Promoção pra ${newTierName}! Baús: ${tiersToRoll.map((tk) => CHESTS[tk].emoji).join(" ")}`,
          );
        }
        (updates as Record<string, number>).highest_tier_rank = newTierIdx;
      }

      // Drop de ração por vitória
      if (won && Math.random() < 0.7) {
        const dropped = 1 + Math.floor(Math.random() * 2);
        await S.addItem(context.userId, "ration", dropped);
        rationsDropped += dropped;
      }

      await S.patchProfile(context.userId, updates);

      // Pontos do defensor
      await supabaseAdmin.rpc("apply_arena_defender_result", {
        p_defender_id: claimed.opponent_id as string,
        p_attacker_won: won,
        p_win_pts: oppRoll.win,
        p_loss_pts: oppRoll.loss,
      });
    }

    return {
      winner: finalWinner,
      rewards: { ...rew, gems: gemWin, points: delta, oldPoints, newPoints, promoMsg },
      promoAfter: nextPromo,
      chests,
      messages,
      rationsDropped,
    };
  });
