import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, ROLE_INFO, RARITY_INFO, MAX_RANK, skinFilter, isVip, xpForNextLevel, rankStars, totalStats, ARENA_WIN_POINTS, ARENA_LOSS_POINTS, rollArenaPoints, getTier, divisionBounds, promoNeeded, type PromoSeries, computeBattleEnergy, MAX_BATTLE_ENERGY, hungerMultiplier, rollLevelUpRewards, tierPromotionChests, rollChest, CHESTS, tierRankIndex, starterMonsterStats, getSpeciesCategories, CATEGORY_INFO } from "@/lib/game-data";
import type { MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { simulateBattle, computeRewards, toBattleMonster, type BattleLogEntry } from "@/lib/battle";
import { BattleScene } from "@/components/BattleScene";
import { BattleStats } from "@/components/BattleStats";
import { SynergyBadges } from "@/components/SynergyBadges";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";
import { playSfx, startMusic, stopMusic } from "@/lib/sound";
import { ChestRewardPopup, type PendingChest } from "@/components/ChestRewardPopup";

export const Route = createFileRoute("/arena")({
  component: ArenaPage,
});

type FullMonster = MonsterRow & { owner_id: string };

async function fetchOpponentMonsters(userId: string) {
  const chunks: FullMonster[] = [];
  const pageSize = 1000;

  // Ordena por owner_id pra que todos os pets de um mesmo dono fiquem juntos
  // e não sejam fragmentados pela paginação (senão muitos donos viram "time incompleto")
  for (let from = 0; from < 12000; from += pageSize) {
    const { data, error } = await supabase
      .from("monsters")
      .select("*")
      .neq("owner_id", userId)
      .eq("in_team", true)
      .order("owner_id", { ascending: true })
      .order("team_position", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;
    chunks.push(...(data as FullMonster[]));
    if (data.length < pageSize) break;
  }

  return chunks;
}

async function fetchOpponentProfiles(ownerIds: string[]) {
  const rows: Array<{ id: string; username: string; level: number; vip_until: string | null; arena_points: number | null; is_bot: boolean }> = [];
  const chunkSize = 200;

  for (let i = 0; i < ownerIds.length; i += chunkSize) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, level, vip_until, arena_points, is_bot")
      .in("id", ownerIds.slice(i, i + chunkSize));

    if (data) rows.push(...data);
  }

  return rows;
}

function ArenaPage() {
  const navigate = useNavigate();
  const { userId, profile, patch, loading } = useProfile();
  const [myTeam, setMyTeam] = useState<FullMonster[]>([]);
  const [opponent, setOpponent] = useState<{ ownerId: string; ownerName: string; arenaPoints: number; team: FullMonster[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[] | null>(null);
  const [winner, setWinner] = useState<"team_a" | "team_b" | "draw" | null>(null);
  const [rewards, setRewards] = useState<{ coins: number; xp: number; gems: number; points: number; oldPoints: number; newPoints: number; promoMsg?: string; promoBefore?: PromoSeries | null; promoAfter?: PromoSeries | null } | null>(null);
  const [shownLog, setShownLog] = useState<BattleLogEntry[]>([]);
  const [searchCountdown, setSearchCountdown] = useState(0);
  const [battleTimer, setBattleTimer] = useState(120);
  const [promo, setPromo] = useState<PromoSeries | null>(null);
  const [autoRematch, setAutoRematch] = useState<number | null>(null);
  const [chestQueue, setChestQueue] = useState<PendingChest[]>([]);
  const pendingApplyRef = useRef<null | (() => Promise<void>)>(null);
  const playbackStoppedRef = useRef(false);
  const [ranks, setRanks] = useState<{ mine: number | null; opp: number | null }>({ mine: null, opp: null });
  const battleFinished = !!battleLog && (shownLog.length >= battleLog.length || (battleTimer <= 0 && playbackStoppedRef.current));

  // Compute ranking positions (1-based) when fight starts
  useEffect(() => {
    if (!battleLog || !opponent || !profile) return;
    let cancel = false;
    (async () => {
      const [mineRes, oppRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }).gt("arena_points", profile.arena_points ?? 0),
        supabase.from("profiles").select("id", { count: "exact", head: true }).gt("arena_points", opponent.arenaPoints),
      ]);
      if (cancel) return;
      setRanks({
        mine: (mineRes.count ?? 0) + 1,
        opp: (oppRes.count ?? 0) + 1,
      });
    })();
    return () => { cancel = true; };
  }, [battleLog, opponent?.ownerId, profile?.arena_points]);


  // Aplica resultado da batalha (HUD, recompensas, DB) somente quando a animação termina,
  // pra não revelar o vencedor pelas atualizações de vitórias/derrotas no topo.
  useEffect(() => {
    if (!battleLog) return;
    if (!battleFinished) return;
    const apply = pendingApplyRef.current;
    if (!apply) return;
    pendingApplyRef.current = null;
    void apply();
  }, [battleLog, battleFinished]);

  // auto rematch: começa countdown de 10s quando a batalha termina
  useEffect(() => {
    if (!battleLog || !winner) return;
    if (!battleFinished) return;
    setAutoRematch(10);
    if (winner === "team_a") playSfx("victory");
    else if (winner === "team_b") playSfx("defeat");
    const interval = setInterval(() => {
      setAutoRematch((v) => (v === null ? null : v - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [battleLog, winner, battleFinished]);

  // Esconde o overlay do tutorial enquanto a batalha está rolando — volta a aparecer
  // quando a animação acaba (winner definido + log totalmente exibido).
  useEffect(() => {
    const inBattle = !!battleLog && !battleFinished;
    window.dispatchEvent(new CustomEvent(inBattle ? "tutorial:hide" : "tutorial:show"));
    return () => { window.dispatchEvent(new CustomEvent("tutorial:show")); };
  }, [battleLog, battleFinished]);

  // Trilha ambiente enquanto está na arena
  useEffect(() => {
    startMusic();
    return () => stopMusic();
  }, []);

  // dispara próxima batalha quando o contador zerar
  useEffect(() => {
    if (autoRematch === null) return;
    if (autoRematch <= 0) {
      setAutoRematch(null);
      if (canFight) findOpponent();
    }
  }, [autoRematch]);

  // load promo from localStorage
  useEffect(() => {
    if (!userId) return;
    try {
      const raw = localStorage.getItem(`promo_${userId}`);
      setPromo(raw ? JSON.parse(raw) : null);
    } catch { setPromo(null); }
  }, [userId]);

  function savePromo(userId: string, p: PromoSeries | null) {
    if (p) localStorage.setItem(`promo_${userId}`, JSON.stringify(p));
    else localStorage.removeItem(`promo_${userId}`);
    setPromo(p);
  }

  useEffect(() => {
    async function loadTeam() {
      if (!userId) return;
      const { data } = await supabase.from("monsters").select("*").eq("owner_id", userId).eq("in_team", true).order("team_position", { ascending: true }).limit(3);
      if (data) setMyTeam((data as FullMonster[]).slice(0, 3));
    }
    if (userId) loadTeam();
  }, [userId]);

  // animate log com ritmo dramático (pausas maiores em momentos especiais)
  useEffect(() => {
    if (!battleLog) return;
    playbackStoppedRef.current = false;
    setShownLog([]);
    let i = 0;
    let cancelled = false;
    let timeoutId: number | undefined;
    function delayFor(entry: BattleLogEntry | undefined): number {
      if (!entry) return 2400;
      const m = entry.message;
      // Momentos épicos: pausa bem longa
      if (m.includes("EXECUÇÃO") || m.includes("VERDADEIRO") || m.includes("ressuscitado")) return 3400;
      if (entry.crit) return 2800;
      if (m.includes("escudo") || m.includes("queimando") || m.includes("silenciou") || m.includes("fúria")) return 2700;
      if (m.includes("salto") || m.includes("Curou todos") || m.includes("golpe ")) return 2600;
      // Dano por DoT um pouco mais rápido pra não cansar
      if (m.includes("sofreu") && m.includes("queimadura")) return 1500;
      return 2400; // ritmo base bem mais lento, golpe por golpe
    }
    function tick() {
      if (cancelled || playbackStoppedRef.current) return;
      i += 1;
      setShownLog(battleLog!.slice(0, i));
      if (i >= battleLog!.length) return;
      // Pausa extra quando muda de turno (round break)
      const prev = battleLog![i - 1];
      const next = battleLog![i];
      const turnChange = prev && next && prev.turn !== next.turn ? 1200 : 0;
      timeoutId = window.setTimeout(tick, delayFor(next) + turnChange);
    }
    const initial = window.setTimeout(tick, delayFor(battleLog[0]));
    return () => { cancelled = true; clearTimeout(initial); if (timeoutId) clearTimeout(timeoutId); };
  }, [battleLog]);

  // Timer regressivo de 2min durante a batalha (ao zerar, congela a cena no estado atual)
  useEffect(() => {
    if (!battleLog) { setBattleTimer(120); return; }
    if (battleFinished) return;
    const id = setInterval(() => {
      setBattleTimer((t) => {
        if (t <= 1) {
          playbackStoppedRef.current = true;
          clearInterval(id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [battleLog, battleFinished]);

  // Reseta o timer ao iniciar uma nova batalha
  useEffect(() => {
    if (battleLog) setBattleTimer(120);
  }, [battleLog]);

  useEffect(() => {
    if (battleLog && shownLog.length >= battleLog.length) {
      // congela o timer ao terminar
    }
  }, [battleLog, shownLog.length]);

  async function findOpponent() {
    if (!userId || !profile || myTeam.length === 0) return;
    if (searching) return;
    setSearching(true);
    setOpponent(null);
    setBattleLog(null);
    setWinner(null);
    setRewards(null);
    setAutoRematch(null);

    // Temporizador aleatório 1–13s pra simular a busca (evita ficar dando scout)
    const waitMs = (1 + Math.floor(Math.random() * 13)) * 1000;
    const startedAt = Date.now();
    setSearchCountdown(1);
    const tickId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setSearchCountdown(Math.min(Math.ceil(waitMs / 1000), Math.max(1, Math.ceil(elapsed / 1000))));
    }, 250);

    // Busca em páginas grandes para não depender do limite padrão de 1000 linhas.
    // Assim contas novas também acham times completos entre todos os bots.
    const monsPromise = fetchOpponentMonsters(userId);

    await new Promise((r) => setTimeout(r, waitMs));
    window.clearInterval(tickId);
    setSearchCountdown(0);

    const allMons = await monsPromise;
    if (allMons.length === 0) {
      setSearching(false);
      toast("Ninguém disponível ainda. Convide amigos! 🎯", { icon: "👀" });
      return;
    }

    const ownerIds = Array.from(new Set(allMons.map((m) => m.owner_id)));
    const profs = await fetchOpponentProfiles(ownerIds);
    const profById = new Map(profs.map((p) => [p.id as string, p]));

    const byOwner: Record<string, { team: FullMonster[]; username: string; level: number; arenaPoints: number }> = {};
    for (const m of allMons) {
      const p = profById.get(m.owner_id);
      if (!p) continue;
      if (!byOwner[m.owner_id]) byOwner[m.owner_id] = {
        team: [],
        username: p.username as string,
        level: p.level as number,
        arenaPoints: (p.arena_points as number) ?? 0,
      };
      byOwner[m.owner_id].team.push(m);
    }

    const myPts = profile.arena_points ?? 0;
    // Evita repetir os últimos oponentes (anti-rematch)
    const recentKey = `recent_opps_${userId}`;
    let recent: string[] = [];
    try { recent = JSON.parse(localStorage.getItem(recentKey) ?? "[]"); } catch { recent = []; }
    // Só considera oponentes com time COMPLETO (3 pets) e SEM espécies repetidas
    const allOwnersFull = Object.keys(byOwner).filter((id) => {
      const team = byOwner[id].team;
      if (team.length < 3) return false;
      const species = new Set(team.map((m) => m.species));
      return species.size === team.length;
    });
    // Cap de rank do oponente por tier (proteção pra novatos)
    // Ferro: rank 2 • Bronze: 3 • Prata: 5 • Ouro: 6 • Platina+: sem cap
    const myMaxRank = Math.max(1, ...myTeam.map((m) => m.rank ?? 1));
    let rankCap = 99;
    if (myPts < 500) rankCap = Math.max(2, myMaxRank + 1);
    else if (myPts < 1000) rankCap = Math.max(3, myMaxRank + 1);
    else if (myPts < 1500) rankCap = Math.max(5, myMaxRank + 1);
    else if (myPts < 2000) rankCap = Math.max(6, myMaxRank + 1);
    const allOwnersCapped = allOwnersFull.filter((id) => {
      const maxR = Math.max(...byOwner[id].team.map((m) => m.rank ?? 1));
      return maxR <= rankCap;
    });
    const poolBase = allOwnersCapped.length > 0 ? allOwnersCapped : allOwnersFull;
    const allOwners = poolBase.filter((id) => !recent.includes(id));
    // Pool sempre mista (bots + players reais). Anti-rematch de 25 partidas vale pra todos.
    const windows = [100, 200, 400, 800];
    let ownerList: string[] = [];
    for (const w of windows) {
      const inWindow = allOwners.filter((id) => Math.abs(byOwner[id].arenaPoints - myPts) <= w);
      if (inWindow.length >= 3) { ownerList = inWindow; break; }
    }
    if (ownerList.length === 0 && allOwners.length > 0) {
      ownerList = allOwners
        .slice()
        .sort((a, b) => Math.abs(byOwner[a].arenaPoints - myPts) - Math.abs(byOwner[b].arenaPoints - myPts))
        .slice(0, 8);
    }

    if (ownerList.length === 0 && allOwners.length > 0) {
      ownerList = allOwners
        .slice()
        .sort((a, b) => Math.abs(byOwner[a].arenaPoints - myPts) - Math.abs(byOwner[b].arenaPoints - myPts))
        .slice(0, 8);
    }
    // fallback: se sobrou ninguém após excluir recentes, libera os recentes (respeitando o cap se possível)
    if (ownerList.length === 0 && poolBase.length > 0) {
      ownerList = poolBase
        .slice()
        .sort((a, b) => Math.abs(byOwner[a].arenaPoints - myPts) - Math.abs(byOwner[b].arenaPoints - myPts))
        .slice(0, 8);
    }
    if (ownerList.length === 0) {
      setSearching(false);
      toast("Ninguém com time completo agora. Tente em instantes! 🎯", { icon: "👀" });
      return;
    }
    const chosen = ownerList[Math.floor(Math.random() * ownerList.length)];
    // grava nos recentes (mantém últimos 75 — evita cair no mesmo oponente por ~75 partidas)
    try {
      const updated = [chosen, ...recent.filter((id) => id !== chosen)].slice(0, 75);
      localStorage.setItem(recentKey, JSON.stringify(updated));
    } catch { /* ignore */ }
    const chosenOpp = { ownerId: chosen, ownerName: byOwner[chosen].username, arenaPoints: byOwner[chosen].arenaPoints, team: byOwner[chosen].team.slice(0, 3) };
    setOpponent(chosenOpp);
    setSearching(false);
    // Bots têm energia ilimitada — recarrega antes da batalha pra nunca travarem
    if (profById.get(chosen)?.is_bot) {
      void supabase.from("monsters").update({ battle_energy: 24, battle_energy_at: new Date().toISOString(), hunger: 100 }).eq("owner_id", chosen);
    }
    // Já começa a partida imediatamente — não dá pra rebuscar oponente
    void fight(chosenOpp);
  }


  // Compute current energy for each team pet (with regen applied)
  const teamEnergies = myTeam.map((m) => computeBattleEnergy(m.battle_energy, m.battle_energy_at));
  const minEnergy = teamEnergies.length ? Math.min(...teamEnergies.map((e) => e.energy)) : 0;
  const starvingPets = myTeam.filter((m) => (m.hunger ?? 100) <= 0);
  const hungryPets = myTeam.filter((m) => (m.hunger ?? 100) > 0 && (m.hunger ?? 100) < 50);
  const canFight = myTeam.length > 0 && minEnergy >= 1 && starvingPets.length === 0;

  async function fight(forcedOpp?: NonNullable<typeof opponent>) {
    const opp = forcedOpp ?? opponent;
    if (!profile || !userId || !opp) return;
    if (starvingPets.length > 0) {
      toast.error(`${starvingPets[0].name} está faminto! Alimente antes de batalhar. 🍖`);
      return;
    }
    if (!canFight) {
      toast.error("Algum pet do seu time está sem energia de batalha! ⚡");
      return;
    }

    // Consume 1 battle energy + 1~3 hunger from each team pet
    const hungerLoss = myTeam.map(() => 1 + Math.floor(Math.random() * 3));
    await Promise.all(myTeam.map(async (m, i) => {
      const e = teamEnergies[i];
      const newEnergy = Math.max(0, e.energy - 1);
      const newHunger = Math.max(0, (m.hunger ?? 100) - hungerLoss[i]);
      await supabase
        .from("monsters")
        .update({ battle_energy: newEnergy, battle_energy_at: e.nextStoredAt, hunger: newHunger })
        .eq("id", m.id);
    }));
    // Reflect locally so the UI updates instantly
    setMyTeam((prev) => prev.map((m, i) => ({
      ...m,
      battle_energy: Math.max(0, teamEnergies[i].energy - 1),
      battle_energy_at: teamEnergies[i].nextStoredAt,
      hunger: Math.max(0, (m.hunger ?? 100) - hungerLoss[i]),
    })));

    const a = myTeam.map(toBattleMonster);
    const b = opp.team.map(toBattleMonster);
    const result = simulateBattle(a, b);
    const isDraw = result.winner === "draw";
    const won = result.winner === "team_a";
    const rew = isDraw
      ? { coins: 0, xp: 0 }
      : computeRewards(profile.level, won, isVip(profile.vip_until));
    const gemWin = !isDraw && Math.random() < (won ? 0.5 : 0.25) ? 1 : 0;

    // Inicia a animação ANTES de aplicar resultado, pra não revelar o vencedor
    // pelas atualizações de vitórias/derrotas/recompensas no HUD.
    setBattleLog(result.log);
    setWinner(result.winner);

    // Aplica HUD, recompensas e gravações no DB somente quando a animação terminar.
    pendingApplyRef.current = async () => {
      // Arena points + promo series logic
      const oldPoints = profile.arena_points ?? 0;
      const promoBefore = promo;
      const myRoll = rollArenaPoints(oldPoints);
      const oppRoll = rollArenaPoints(opp.arenaPoints);
      const myWinPts = myRoll.win;
      const myLossPts = myRoll.loss;
      const oppWinPts = oppRoll.win;
      const oppLossPts = oppRoll.loss;
      let newPoints = oldPoints;
      let delta = 0;
      let promoMsg: string | undefined;
      let nextPromo: PromoSeries | null = promo;
      const levelUpToasts: Array<() => void> = [];
      let rationToast: (() => void) | null = null;

      if (isDraw) {
        promoMsg = "🤝 Empate — pontos preservados";
      } else {
        if (promo) {
          const updated: PromoSeries = { ...promo, wins: promo.wins + (won ? 1 : 0), losses: promo.losses + (won ? 0 : 1) };
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
          delta = won ? myWinPts : -myLossPts;
          newPoints = Math.max(0, oldPoints + delta);
          const b = divisionBounds(oldPoints);
          if (b && newPoints >= b.end) {
            newPoints = b.end - 1;
            delta = newPoints - oldPoints;
            nextPromo = { wins: 0, losses: 0, type: b.nextIsTierUp ? "bo5" : "bo3", targetFrom: oldPoints };
            promoMsg = b.nextIsTierUp ? "🔥 Série de tier MD5 iniciada!" : "⚡ Série de promoção MD3 iniciada!";
          }
        }

        savePromo(userId, nextPromo);

        const updates: Partial<typeof profile> = {
          coins: profile.coins + rew.coins,
          gems: (profile.gems ?? 0) + gemWin,
          xp: profile.xp + rew.xp,
          wins: profile.wins + (won ? 1 : 0),
          losses: profile.losses + (won ? 0 : 1),
          arena_points: newPoints,
        };

        let newXp = updates.xp!;
        let newLevel = profile.level;
        while (newXp >= xpForNextLevel(newLevel)) {
          newXp -= xpForNextLevel(newLevel);
          newLevel += 1;
        }
        updates.xp = newXp;
        updates.level = newLevel;

        if (newLevel > profile.level) {
          const lvRew = rollLevelUpRewards(profile.level, newLevel);
          updates.coins = (updates.coins ?? profile.coins) + lvRew.coins;
          updates.gems = (updates.gems ?? (profile.gems ?? 0)) + lvRew.gems;
          await patch(updates);
          if (lvRew.rations > 0) {
            const { data: rRow } = await supabase.from("inventory").select("quantity").eq("user_id", userId).eq("item_type", "ration").maybeSingle();
            await supabase.from("inventory").upsert(
              { user_id: userId, item_type: "ration", quantity: (rRow?.quantity ?? 0) + lvRew.rations },
              { onConflict: "user_id,item_type" }
            );
          }
          if (lvRew.petSpecies.length > 0) {
            const rows = lvRew.petSpecies.map((sid) => {
              const sp = SPECIES[sid];
              return { owner_id: userId, species: sid, name: sp.name, ...starterMonsterStats(sid) };
            });
            await supabase.from("monsters").insert(rows);
          }
          const newChests: PendingChest[] = lvRew.chests.map((c, i) => ({
            id: `lv-${Date.now()}-${i}`,
            tier: c.tier,
            label: `Level ${c.level}!`,
            reward: c.reward,
          }));
          setChestQueue((q) => [...q, ...newChests]);
          const parts: string[] = [];
          if (lvRew.coins) parts.push(`🪙 ${lvRew.coins}`);
          if (lvRew.gems) parts.push(`💎 ${lvRew.gems}`);
          if (lvRew.rations) parts.push(`🍖 ${lvRew.rations}`);
          if (lvRew.petSpecies.length) parts.push(`🥚 ${lvRew.petSpecies.length} pet${lvRew.petSpecies.length > 1 ? "s" : ""}`);
          if (parts.length) levelUpToasts.push(() => toast(`Recompensas: ${parts.join(" • ")}`, { duration: 5000 }));
        } else {
          await patch(updates);
        }

        await supabase.rpc("apply_arena_defender_result", {
          p_defender_id: opp.ownerId,
          p_attacker_won: won,
          p_win_pts: oppWinPts,
          p_loss_pts: oppLossPts,
        });

        const displayedAttackerDelta = isDraw ? 0 : (won ? myWinPts : -myLossPts);
        const displayedDefenderDelta = isDraw ? 0 : (won ? -Math.min(oppLossPts, opp.arenaPoints) : oppWinPts);

        await supabase.from("battles").insert({
          attacker_id: userId,
          defender_id: opp.ownerId,
          winner_id: won ? userId : opp.ownerId,
          log: JSON.parse(JSON.stringify(result.log)),
          coins_reward: rew.coins,
          xp_reward: rew.xp,
          attacker_points_delta: displayedAttackerDelta,
          defender_points_delta: displayedDefenderDelta,
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("tutorial:battle-finished"));
        }

        if (won && Math.random() < 0.70) {
          const dropped = 1 + Math.floor(Math.random() * 2);
          const { data: foodRow } = await supabase
            .from("inventory")
            .select("quantity")
            .eq("user_id", userId)
            .eq("item_type", "ration")
            .maybeSingle();
          const current = foodRow?.quantity ?? 0;
          await supabase
            .from("inventory")
            .upsert(
              { user_id: userId, item_type: "ration", quantity: current + dropped },
              { onConflict: "user_id,item_type" }
            );
          rationToast = () => toast(`🍖 +${dropped} ração!`, { icon: "🎁" });
        }

        const oldTierName = getTier(oldPoints).name;
        const newTierName = getTier(newPoints).name;
        const newTierIdx = tierRankIndex(newTierName);
        const highest = (profile as { highest_tier_rank?: number }).highest_tier_rank ?? 0;
        if (oldTierName !== newTierName && newTierIdx > highest) {
          const chestCounts = tierPromotionChests(newTierName);
          const tiersToRoll: Array<"silver" | "gold" | "legendary"> = [];
          for (let i = 0; i < chestCounts.silver; i++) tiersToRoll.push("silver");
          for (let i = 0; i < chestCounts.gold; i++) tiersToRoll.push("gold");
          for (let i = 0; i < chestCounts.legendary; i++) tiersToRoll.push("legendary");

          if (tiersToRoll.length > 0) {
            let bonusCoins = 0, bonusGems = 0, bonusRations = 0;
            const bonusPets: string[] = [];
            const tierChests: PendingChest[] = [];
            for (const tk of tiersToRoll) {
              const r = rollChest(tk);
              bonusCoins += r.coins;
              bonusGems += r.gems;
              bonusRations += r.rations;
              if (r.petSpecies) bonusPets.push(r.petSpecies);
              tierChests.push({
                id: `tier-${Date.now()}-${tierChests.length}`,
                tier: tk,
                label: `Promoção pra ${newTierName}!`,
                reward: r,
              });
            }
            setChestQueue((q) => [...q, ...tierChests]);

            const { data: freshProfile } = await supabase
              .from("profiles")
              .select("coins,gems")
              .eq("id", userId)
              .maybeSingle();
            await supabase
              .from("profiles")
              .update({
                coins: (freshProfile?.coins ?? 0) + bonusCoins,
                gems: (freshProfile?.gems ?? 0) + bonusGems,
              })
              .eq("id", userId);

            if (bonusRations > 0) {
              const { data: rRow } = await supabase.from("inventory").select("quantity").eq("user_id", userId).eq("item_type", "ration").maybeSingle();
              await supabase.from("inventory").upsert(
                { user_id: userId, item_type: "ration", quantity: (rRow?.quantity ?? 0) + bonusRations },
                { onConflict: "user_id,item_type" }
              );
            }

            if (bonusPets.length > 0) {
              const rows = bonusPets.map((sid) => {
                const sp = SPECIES[sid];
                return { owner_id: userId, species: sid, name: sp.name, ...starterMonsterStats(sid) };
              });
              await supabase.from("monsters").insert(rows);
            }

            const chestLabel = tiersToRoll.map((tk) => CHESTS[tk].emoji).join(" ");
            levelUpToasts.push(() => toast.success(`👑 Promoção pra ${newTierName}! Baús: ${chestLabel}`, { duration: 5000 }));
            const parts: string[] = [];
            if (bonusCoins) parts.push(`🪙 ${bonusCoins}`);
            if (bonusGems) parts.push(`💎 ${bonusGems}`);
            if (bonusRations) parts.push(`🍖 ${bonusRations}`);
            if (bonusPets.length) parts.push(`🥚 ${bonusPets.length} pet${bonusPets.length > 1 ? "s" : ""}`);
            if (parts.length) levelUpToasts.push(() => toast(`Recompensas de tier: ${parts.join(" • ")}`, { duration: 6000 }));
          }
          await supabase.from("profiles").update({ highest_tier_rank: newTierIdx }).eq("id", userId);
        }
      }

      setRewards({ ...rew, gems: gemWin, points: delta, oldPoints, newPoints, promoMsg, promoBefore, promoAfter: nextPromo });
      levelUpToasts.forEach((fn) => fn());
      if (rationToast) rationToast();
    };
  }

  // Avisar se o jogador tentar sair durante a animação da batalha
  // (o resultado já está salvo no DB, mas evita confusão)
  useEffect(() => {
    if (!battleLog) return;
    const animationDone = shownLog.length >= battleLog.length;
    if (animationDone || battleFinished) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "Batalha em andamento! O resultado já foi registrado.";
      return e.returnValue;
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [battleLog, shownLog.length, battleFinished]);



  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(20,5,50,0.6),rgba(20,5,50,0.8)),url(${arenaBg})` }}
    >
      <Toaster position="top-center" richColors />
      <ChestRewardPopup queue={chestQueue} onConsume={(id) => setChestQueue((q) => q.filter((c) => c.id !== id))} />
      <HUD profile={profile} />

      <div className="max-w-4xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Home</button>

        <header className="text-center text-white">
          <h1 className="text-4xl font-extrabold drop-shadow-lg">⚔️ Arena</h1>
          <p className="opacity-80 text-sm">Batalhe contra times reais de outros jogadores</p>
        </header>

        {myTeam.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-6 text-center text-white">
            <p>Você não tem monstros no time!</p>
            <button onClick={() => navigate({ to: "/" })} className="mt-3 px-4 py-2 bg-yellow-400 text-yellow-950 rounded-lg font-bold">Escolher time</button>
          </div>
        ) : (
          <>
            {!battleLog && (<>
            <div className="grid md:grid-cols-2 gap-4">
              <TeamPanel title="Seu time" team={myTeam} side="left" energies={teamEnergies} />
              {opponent ? (
                <TeamPanel title={`vs ${opponent.ownerName}`} team={opponent.team} side="right" />
              ) : (
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border-2 border-dashed border-white/30 flex items-center justify-center p-8 text-white/70 text-center">
                  ❓<br/>Nenhum oponente ainda
                </div>
              )}
            </div>

            {starvingPets.length > 0 && (
              <div className="rounded-xl bg-red-600/40 border border-red-300 p-3 text-white text-sm text-center">
                🍖 {starvingPets.map((p) => p.name).join(", ")} {starvingPets.length === 1 ? "está faminto" : "estão famintos"} e não pode{starvingPets.length === 1 ? "" : "m"} batalhar. Dê ração primeiro!
              </div>
            )}
            {starvingPets.length === 0 && hungryPets.length > 0 && (
              <div className="rounded-xl bg-amber-500/30 border border-amber-300 p-3 text-white text-sm text-center">
                🍖 {hungryPets.map((p) => `${p.name} (${Math.round((1 - hungerMultiplier(p.hunger ?? 100)) * 100)}%)`).join(", ")} com fome — vão lutar com stats reduzidos.
              </div>
            )}
            {!canFight && starvingPets.length === 0 && myTeam.length > 0 && (
              <div className="rounded-xl bg-red-500/30 border border-red-300 p-3 text-white text-sm text-center">
                ⚡ Algum pet do seu time está sem energia de batalha. Espere a regen (1/hora) ou compre energia na <button onClick={() => navigate({ to: "/shop" })} className="underline font-bold">loja</button>.
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={findOpponent}
                disabled={searching}
                data-tutorial="find-opponent"
                className="px-6 py-3 rounded-xl bg-white/20 text-white font-extrabold hover:bg-white/30 transition disabled:opacity-50"
              >
                {searching ? `🔍 Procurando oponente... ${searchCountdown}s` : "🎯 Buscar oponente"}
              </button>
              {opponent && !battleLog && (
                <button
                  onClick={() => fight()}
                  disabled={!canFight}
                  className="px-8 py-3 rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white font-extrabold shadow-xl hover:scale-105 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ⚔️ BATALHAR!
                </button>
              )}
            </div>

            {promo && !battleLog && (
              <div className="rounded-xl bg-gradient-to-r from-yellow-500/30 to-orange-500/30 border-2 border-yellow-300 p-3 text-white text-center">
                <div className="font-extrabold text-lg">⚡ SÉRIE DE PROMOÇÃO ({promo.type.toUpperCase()})</div>
                <div className="text-sm opacity-90">
                  Vença {promoNeeded(promo.type)} pra subir • {promo.wins}V / {promo.losses}D
                </div>
                <div className="flex gap-1 justify-center mt-2">
                  {Array.from({ length: promoNeeded(promo.type) * 2 - 1 }).map((_, i) => {
                    const isWin = i < promo.wins;
                    const isLoss = i >= promo.wins && i < promo.wins + promo.losses;
                    return (
                      <div key={i} className={`w-6 h-6 rounded-full border-2 ${
                        isWin ? "bg-green-400 border-green-200" :
                        isLoss ? "bg-red-500 border-red-200" :
                        "bg-white/10 border-white/40"
                      }`} />
                    );
                  })}
                </div>
              </div>
            )}
            </>)}


            {battleLog && opponent && (
              <div className="relative">
                <div className="flex justify-center mb-2">
                  <div className="px-4 py-1.5 rounded-full bg-black/70 backdrop-blur border border-white/30 text-white font-mono font-bold text-lg shadow-lg">
                    ⏱️ {Math.floor(battleTimer / 60)}:{String(battleTimer % 60).padStart(2, "0")}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-white">
                  <div className="rounded-xl bg-blue-500/15 border border-blue-300/30 p-2">
                    <SynergyBadges
                      title={`🟦 ${profile.username} (você)`}
                      onlyActive
                      compact
                      speciesIds={myTeam.map((m) => m.species)}
                    />
                  </div>
                  <div className="rounded-xl bg-red-500/15 border border-red-300/30 p-2">
                    <SynergyBadges
                      title={`🟥 ${opponent.ownerName}`}
                      onlyActive
                      compact
                      speciesIds={opponent.team.map((m) => m.species)}
                    />
                  </div>
                </div>
                <BattleScene
                  teamA={myTeam}
                  teamB={opponent.team}
                  log={battleLog}
                  step={shownLog.length}
                  playerAName={profile.username}
                  playerATier={getTier(profile.arena_points ?? 0).short}
                  playerARank={ranks.mine ?? undefined}
                  playerBName={opponent.ownerName}
                  playerBTier={getTier(opponent.arenaPoints).short}
                  playerBRank={ranks.opp ?? undefined}
                />

                {battleFinished && winner && (
                  <div className="absolute inset-0 z-30 flex items-start sm:items-center justify-center animate-fade-in overflow-y-auto py-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                      className={`relative px-5 sm:px-8 py-5 sm:py-6 rounded-3xl border-4 shadow-2xl text-center animate-scale-in max-w-2xl w-[95%] max-h-[92vh] overflow-y-auto ${
                        winner === "team_a"
                          ? "bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-200 text-yellow-950"
                          : winner === "draw"
                          ? "bg-gradient-to-br from-slate-300 to-slate-500 border-white text-slate-900"
                          : "bg-gradient-to-br from-red-600 to-rose-900 border-red-300 text-white"
                      }`}
                      style={{ textShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
                    >
                      <div className="text-5xl sm:text-6xl leading-none mb-1">
                        {winner === "team_a" ? "🏆" : winner === "draw" ? "🤝" : "💀"}
                      </div>
                      <div className="text-3xl sm:text-5xl font-black tracking-widest">
                        {winner === "team_a" ? "VITÓRIA!" : winner === "draw" ? "EMPATE!" : "DERROTA"}
                      </div>

                      {/* Recompensas */}
                      {rewards && (
                        <div className="mt-3 rounded-xl bg-black/40 border border-white/30 px-3 py-2 max-w-md mx-auto">
                          <div className="text-[10px] font-extrabold text-yellow-200 uppercase tracking-wider mb-1">Recompensas</div>
                          <div className="flex items-center justify-center gap-3 flex-wrap text-sm font-extrabold text-white">
                            <span>🪙 +{rewards.coins}</span>
                            <span>✨ +{rewards.xp} XP</span>
                            {rewards.gems > 0 && <span className="text-cyan-200">💎 +{rewards.gems}</span>}
                          </div>
                          <div className="mt-1.5 flex items-center justify-center gap-2 text-xs font-bold">
                            <span className={`px-2 py-0.5 rounded ${getTier(rewards.oldPoints).color}`}>{getTier(rewards.oldPoints).short}</span>
                            <span className={rewards.points >= 0 ? "text-green-300" : "text-red-300"}>
                              {rewards.points >= 0 ? `+${rewards.points}` : rewards.points} pts
                            </span>
                            <span className={`px-2 py-0.5 rounded ${getTier(rewards.newPoints).color}`}>{getTier(rewards.newPoints).short}</span>
                          </div>
                          {rewards.promoMsg && (
                            <div className="mt-2 text-xs font-extrabold bg-black/40 rounded-lg px-2 py-1.5 text-white">
                              {rewards.promoMsg}
                            </div>
                          )}
                        </div>
                      )}

                      {(() => {
                        type Stat = { name: string; species: string; skin: string; dmg: number; heal: number; taken: number; kills: number };
                        const sideA = new Map<string, Stat>();
                        const sideB = new Map<string, Stat>();
                        for (const m of myTeam) sideA.set(m.name, { name: m.name, species: m.species, skin: m.skin, dmg: 0, heal: 0, taken: 0, kills: 0 });
                        for (const m of opponent.team) sideB.set(m.name, { name: m.name, species: m.species, skin: m.skin, dmg: 0, heal: 0, taken: 0, kills: 0 });
                        for (const e of battleLog) {
                          const actSide = e.actor === "team_a" ? sideA : sideB;
                          const tgtSide = e.actor === "team_a" ? sideB : sideA;
                          if (e.damage === 0 && e.message.startsWith("💀")) {
                            const s = actSide.get(e.actorName); if (s) s.kills += 1; continue;
                          }
                          if (e.damage > 0) {
                            const s = actSide.get(e.actorName); if (s) s.dmg += e.damage;
                            const t = tgtSide.get(e.targetName); if (t) t.taken += e.damage;
                          } else if (e.damage < 0) {
                            const s = actSide.get(e.actorName); if (s) s.heal += -e.damage;
                          }
                        }
                        const mvpKey = (m: Map<string, Stat>) => {
                          let best: string | null = null; let score = -1;
                          for (const [k, s] of m) { const sc = s.dmg + s.heal; if (sc > score) { score = sc; best = k; } }
                          return best;
                        };
                        const mvpA = mvpKey(sideA);
                        const mvpB = mvpKey(sideB);
                        const Row = ({ s, isMvp }: { s: Stat; isMvp: boolean }) => {
                          const sp = SPECIES[s.species];
                          return (
                            <div className={`flex items-center gap-1.5 p-1.5 rounded-md bg-black/40 border min-w-0 ${isMvp ? "border-yellow-300/80" : "border-white/15"}`}>
                              {sp && <img src={sp.image} alt="" className="h-7 w-7 object-contain shrink-0" style={{ filter: skinFilter(s.skin) }} />}
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-[11px] font-bold text-white truncate flex items-center gap-1">
                                  {s.name}
                                  {isMvp && <span className="text-[8px] bg-yellow-400 text-yellow-950 px-1 rounded font-extrabold">MVP</span>}
                                </div>
                                <div className="text-[9px] text-white/90 font-medium leading-tight">
                                  ⚔️{Math.round(s.dmg)} 💚{Math.round(s.heal)} 🩸{Math.round(s.taken)} 💀{s.kills}
                                </div>
                              </div>
                            </div>
                          );
                        };
                        const SidePanel = ({ title, stats, mvp, accent }: { title: string; stats: Map<string, Stat>; mvp: string | null; accent: string }) => (
                          <div className={`rounded-xl bg-black/30 border ${accent} p-2`}>
                            <div className="text-[10px] font-extrabold text-yellow-200 uppercase tracking-wider mb-1 text-left">{title}</div>
                            <div className="space-y-1">
                              {Array.from(stats.entries()).map(([k, s]) => (
                                <Row key={k} s={s} isMvp={k === mvp} />
                              ))}
                            </div>
                          </div>
                        );
                        return (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                            <SidePanel title="Seu time" stats={sideA} mvp={mvpA} accent="border-blue-300/50" />
                            <SidePanel title="Inimigo" stats={sideB} mvp={mvpB} accent="border-red-300/50" />
                          </div>
                        );
                      })()}

                      {/* Log da batalha */}
                      <details className="mt-3 max-w-md mx-auto rounded-xl bg-black/40 border border-white/30 text-left text-white">
                        <summary className="cursor-pointer select-none px-3 py-2 text-xs font-extrabold flex items-center gap-2">
                          📜 Ver log completo da batalha
                        </summary>
                        <div className="space-y-1 max-h-60 overflow-y-auto px-3 pb-3 pt-1 text-[11px]">
                          {battleLog.map((e, idx) => (
                            <div
                              key={idx}
                              className={`px-2 py-1 rounded ${
                                e.actor === "team_a" ? "bg-blue-500/30" : "bg-red-500/30"
                              } ${e.crit ? "border-l-4 border-yellow-400" : ""}`}
                            >
                              {e.message}
                            </div>
                          ))}
                        </div>
                      </details>

                      <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                        <button
                          onClick={findOpponent}
                          disabled={searching || !canFight}
                          className="px-5 py-2.5 rounded-xl bg-black/80 text-white font-extrabold text-sm shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed border-2 border-white/40"
                        >
                          🎯 Próxima partida{autoRematch !== null && canFight ? ` (${autoRematch}s)` : ""}
                        </button>
                        <button
                          onClick={() => { setAutoRematch(null); navigate({ to: "/" }); }}
                          className="px-5 py-2.5 rounded-xl bg-white/90 text-slate-900 font-extrabold text-sm shadow-lg hover:scale-105 transition border-2 border-white/40"
                        >
                          🏠 Voltar pro pátio
                        </button>
                      </div>
                      {autoRematch !== null && canFight && (
                        <div className="mt-2 text-xs font-bold opacity-90">
                          ⏳ Buscando próximo adversário automaticamente em {autoRematch}s…
                          <button
                            onClick={() => setAutoRematch(null)}
                            className="ml-2 underline opacity-80 hover:opacity-100"
                          >
                            cancelar
                          </button>
                        </div>
                      )}
                      {autoRematch !== null && !canFight && (
                        <div className="mt-2 text-xs font-bold opacity-90">
                          ⚡ Sem energia de batalha — auto-busca pausada.
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            )}

            {battleLog && !battleFinished && (
              <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/30 p-4 text-white">
                {shownLog.length === battleLog.length ? (
                  <details className="text-sm">
                    <summary className="font-extrabold cursor-pointer flex items-center gap-2 select-none">📜 Ver log completo da batalha</summary>
                    <div className="space-y-1 max-h-72 overflow-y-auto mt-2">
                      {shownLog.map((e, idx) => (
                        <div
                          key={idx}
                          className={`px-3 py-1.5 rounded ${
                            e.actor === "team_a" ? "bg-blue-500/30" : "bg-red-500/30"
                          } ${e.crit ? "border-l-4 border-yellow-400" : ""}`}
                        >
                          {e.message}
                        </div>
                      ))}
                    </div>
                  </details>
                ) : (
                  <div className="text-center text-xs font-bold text-white/70 py-1">
                    ⚔️ Batalha em andamento... acompanhe as ações na arena acima.
                  </div>
                )}

                {battleFinished && rewards && opponent && (
                  <>
                    <BattleStats teamA={myTeam} teamB={opponent.team} log={battleLog} />
                    <div className={`mt-4 p-4 rounded-xl text-center font-extrabold ${winner === "team_a" ? "bg-green-500/40" : winner === "draw" ? "bg-yellow-500/40" : "bg-red-500/40"}`}>
                      {winner === "team_a" ? "🏆 VITÓRIA!" : winner === "draw" ? "🤝 EMPATE!" : "💀 Derrota..."}
                      <div className="text-sm font-normal mt-1">+🪙 {rewards.coins} • +✨ {rewards.xp} XP{rewards.gems > 0 && <> • <span className="text-cyan-200">+💎 {rewards.gems}</span></>}</div>
                      <div className="text-xs font-bold mt-1 flex items-center justify-center gap-2">
                        <span className={`px-2 py-0.5 rounded ${getTier(rewards.oldPoints).color}`}>{getTier(rewards.oldPoints).short}</span>
                        <span className={rewards.points >= 0 ? "text-green-300" : "text-red-300"}>
                          {rewards.points >= 0 ? `+${rewards.points}` : rewards.points} pts
                        </span>
                        <span className={`px-2 py-0.5 rounded ${getTier(rewards.newPoints).color}`}>{getTier(rewards.newPoints).short}</span>
                      </div>
                      {rewards.promoMsg && (
                        <div className="mt-2 text-sm font-extrabold bg-black/30 rounded-lg px-3 py-2">
                          {rewards.promoMsg}
                          {rewards.promoAfter && (
                            <div className="text-xs font-normal opacity-90 mt-1">
                              Faltam {promoNeeded(rewards.promoAfter.type) - rewards.promoAfter.wins} vitória(s)
                            </div>
                          )}
                        </div>
                      )}
                      {!isVip(profile.vip_until) && winner === "team_a" && (
                        <div className="mt-2 text-xs opacity-90">👑 VIP daria <b>+50% nas recompensas!</b></div>
                      )}
                      <button onClick={findOpponent} className="mt-3 px-4 py-2 bg-yellow-400 text-yellow-950 rounded-lg text-sm">Próxima batalha</button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function TeamPanel({ title, team, side, energies }: { title: string; team: FullMonster[]; side: "left" | "right"; energies?: { energy: number; nextRegenAt: Date | null }[] }) {
  // Frente (position 0) deve aparecer mais perto do oponente:
  // time da esquerda → Frente embaixo (inverter); time da direita → Frente em cima (ordem natural).
  const ordered = side === "left"
    ? [...team].map((m, i) => ({ m, i })).sort((a, b) => (b.m.team_position ?? 0) - (a.m.team_position ?? 0))
    : [...team].map((m, i) => ({ m, i })).sort((a, b) => (a.m.team_position ?? 0) - (b.m.team_position ?? 0));
  return (
    <div className={`rounded-2xl bg-white/10 backdrop-blur-md border-2 ${side === "left" ? "border-blue-300/50" : "border-red-300/50"} p-3 text-white`}>
      <h3 className="font-extrabold mb-2">{title}</h3>
      <div className="space-y-2">
        {ordered.map(({ m, i }) => {

          const sp = SPECIES[m.species];
          if (!sp) return null;
          const en = energies?.[i];
          const content = (
            <div className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${ELEMENT_COLORS[sp.element]} ring-2 ${RARITY_INFO[sp.rarity].ringColor} ${(m.rank ?? 1) >= MAX_RANK ? "rank-max-glow" : ""} ${side === "left" ? "hover:brightness-110 transition cursor-pointer" : ""}`}>
              <img src={sp.image} alt="" className="h-14 w-14 object-contain drop-shadow-lg" style={{ filter: skinFilter(m.skin) }} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate flex items-center gap-1 flex-wrap">
                  {m.name}
                  <span className={`px-1.5 py-0.5 rounded ${ROLE_INFO[sp.role].color} text-[9px]`}>
                    {ROLE_INFO[sp.role].emoji} {ROLE_INFO[sp.role].name}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded ${RARITY_INFO[sp.rarity].color} text-[9px] font-extrabold`}>
                    {RARITY_INFO[sp.rarity].emoji} {RARITY_INFO[sp.rarity].name}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-black/50 text-[9px] font-extrabold">
                    {["🛡️ Frente","⚔️ Meio","🏹 Trás"][m.team_position ?? 0]}
                  </span>
                  {getSpeciesCategories(m.species).map((cat) => (
                    <span key={cat} title={`${CATEGORY_INFO[cat].name} • +${CATEGORY_INFO[cat].statLabel}`} className="px-1 py-0.5 rounded bg-black/50 text-[10px]">
                      {CATEGORY_INFO[cat].emoji}
                    </span>
                  ))}
                </div>
                {(() => { const st = totalStats(m.species, m.rank ?? 1, { hp: m.hp ?? 0, atk: m.atk ?? 0, def: m.def ?? 0, spd: m.spd ?? 0, int: m.int ?? 0 }); return (
                  <div className="text-[10px] opacity-90">{rankStars(m.rank ?? 1)} • ❤️{st.hp} ⚔️{st.atk} 🛡️{st.def} 💨{st.spd} 🧠{st.int}</div>
                ); })()}
                {en && (
                  <div className={`text-[10px] font-bold mt-0.5 flex items-center gap-1 ${en.energy === 0 ? "text-red-200" : "text-yellow-100"}`}>
                    ⚡ {en.energy}/{MAX_BATTLE_ENERGY}
                    {en.nextRegenAt && (
                      <span className="opacity-70 font-normal">
                        (+1 em {Math.max(0, Math.ceil((en.nextRegenAt.getTime() - Date.now()) / 60000))}min)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
          return side === "left" ? (
            <Link key={m.id} to="/monster/$id" params={{ id: m.id }} className="block">
              {content}
            </Link>
          ) : (
            <div key={m.id}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
