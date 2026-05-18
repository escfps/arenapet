import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, ROLE_INFO, RARITY_INFO, MAX_RANK, skinFilter, isVip, xpForNextLevel, rankStars, totalStats, ARENA_WIN_POINTS, ARENA_LOSS_POINTS, getTier, divisionBounds, promoNeeded, type PromoSeries, computeBattleEnergy, MAX_BATTLE_ENERGY, hungerMultiplier, rollLevelUpRewards, tierPromotionChests, rollChest, CHESTS, tierRankIndex } from "@/lib/game-data";
import type { MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { simulateBattle, computeRewards, toBattleMonster, type BattleLogEntry } from "@/lib/battle";
import { BattleScene } from "@/components/BattleScene";
import { BattleStats } from "@/components/BattleStats";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/arena")({
  component: ArenaPage,
});

type FullMonster = MonsterRow & { owner_id: string };

function ArenaPage() {
  const navigate = useNavigate();
  const { userId, profile, patch, loading } = useProfile();
  const [myTeam, setMyTeam] = useState<FullMonster[]>([]);
  const [opponent, setOpponent] = useState<{ ownerId: string; ownerName: string; arenaPoints: number; team: FullMonster[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[] | null>(null);
  const [winner, setWinner] = useState<"team_a" | "team_b" | "draw" | null>(null);
  const [rewards, setRewards] = useState<{ coins: number; xp: number; points: number; oldPoints: number; newPoints: number; promoMsg?: string; promoBefore?: PromoSeries | null; promoAfter?: PromoSeries | null } | null>(null);
  const [shownLog, setShownLog] = useState<BattleLogEntry[]>([]);
  const [promo, setPromo] = useState<PromoSeries | null>(null);

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
    setShownLog([]);
    let i = 0;
    let cancelled = false;
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
      if (cancelled) return;
      i += 1;
      setShownLog(battleLog!.slice(0, i));
      if (i >= battleLog!.length) return;
      setTimeout(tick, delayFor(battleLog![i]));
    }
    const initial = setTimeout(tick, delayFor(battleLog[0]));
    return () => { cancelled = true; clearTimeout(initial); };
  }, [battleLog]);

  const [searchCountdown, setSearchCountdown] = useState(0);
  const [battleTimer, setBattleTimer] = useState(120);

  // Timer regressivo de 2min durante a batalha
  useEffect(() => {
    if (!battleLog) { setBattleTimer(120); return; }
    setBattleTimer(120);
    const done = shownLog.length >= battleLog.length;
    if (done) return;
    const id = setInterval(() => {
      setBattleTimer((t) => {
        if (t <= 1) {
          // Tempo esgotado: pula direto pro fim da animação pra concluir a batalha
          setShownLog(battleLog);
          clearInterval(id);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
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

    // Temporizador aleatório 1–13s pra simular a busca (evita ficar dando scout)
    const waitMs = (1 + Math.floor(Math.random() * 13)) * 1000;
    const startedAt = Date.now();
    setSearchCountdown(1);
    const tickId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      setSearchCountdown(Math.min(Math.ceil(waitMs / 1000), Math.max(1, Math.ceil(elapsed / 1000))));
    }, 250);

    // Busca os candidatos em paralelo com a espera
    const monsPromise = supabase
      .from("monsters")
      .select("*")
      .neq("owner_id", userId)
      .eq("in_team", true)
      .limit(200);

    await new Promise((r) => setTimeout(r, waitMs));
    window.clearInterval(tickId);
    setSearchCountdown(0);

    const { data: mons } = await monsPromise;

    const allMons = (mons ?? []) as FullMonster[];
    if (allMons.length === 0) {
      setSearching(false);
      toast("Ninguém disponível ainda. Convide amigos! 🎯", { icon: "👀" });
      return;
    }

    const ownerIds = Array.from(new Set(allMons.map((m) => m.owner_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, level, vip_until, arena_points, is_bot")
      .in("id", ownerIds);
    const profById = new Map((profs ?? []).map((p) => [p.id as string, p]));

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
    // Só considera oponentes com time COMPLETO (3 pets), pra evitar luta 3v2
    const allOwnersFull = Object.keys(byOwner).filter((id) => byOwner[id].team.length >= 3);
    // Cap de rank do oponente em tiers iniciais (proteção pra novatos)
    // Ferro: max rank 2 • Bronze: max rank 4 • Prata: max rank 6 • Ouro+: sem cap
    const myMaxRank = Math.max(1, ...myTeam.map((m) => m.rank ?? 1));
    let rankCap = 99;
    if (myPts < 500) rankCap = Math.max(2, myMaxRank + 1);
    else if (myPts < 1000) rankCap = Math.max(4, myMaxRank + 1);
    else if (myPts < 1500) rankCap = Math.max(6, myMaxRank + 2);
    const allOwnersCapped = allOwnersFull.filter((id) => {
      const maxR = Math.max(...byOwner[id].team.map((m) => m.rank ?? 1));
      return maxR <= rankCap;
    });
    const poolBase = allOwnersCapped.length > 0 ? allOwnersCapped : allOwnersFull;
    const allOwners = poolBase.filter((id) => !recent.includes(id));
    const windows = [100, 200, 400, 800];
    let ownerList: string[] = [];
    for (const w of windows) {
      ownerList = allOwners.filter((id) => Math.abs(byOwner[id].arenaPoints - myPts) <= w);
      if (ownerList.length > 0) break;
    }
    if (ownerList.length === 0 && allOwners.length > 0) {
      ownerList = allOwners
        .slice()
        .sort((a, b) => Math.abs(byOwner[a].arenaPoints - myPts) - Math.abs(byOwner[b].arenaPoints - myPts))
        .slice(0, 5);
    }
    // fallback: se sobrou ninguém após excluir recentes, libera os recentes (respeitando o cap se possível)
    if (ownerList.length === 0 && poolBase.length > 0) {
      ownerList = poolBase
        .slice()
        .sort((a, b) => Math.abs(byOwner[a].arenaPoints - myPts) - Math.abs(byOwner[b].arenaPoints - myPts))
        .slice(0, 5);
    }
    if (ownerList.length === 0) {
      setSearching(false);
      toast("Ninguém com time completo agora. Tente em instantes! 🎯", { icon: "👀" });
      return;
    }
    const chosen = ownerList[Math.floor(Math.random() * ownerList.length)];
    // grava nos recentes (mantém últimos 5)
    try {
      const updated = [chosen, ...recent.filter((id) => id !== chosen)].slice(0, 5);
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

    // Arena points + promo series logic
    const oldPoints = profile.arena_points ?? 0;
    const promoBefore = promo;
    let newPoints = oldPoints;
    let delta = 0;
    let promoMsg: string | undefined;
    let nextPromo: PromoSeries | null = promo;
    let levelUpToasts: Array<() => void> = [];
    let rationToast: (() => void) | null = null;

    if (isDraw) {
      // Empate: sem mudança de pontos, vitórias, derrotas ou recompensas.
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
        delta = won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS;
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
        updates.gems = (profile.gems ?? 0) + lvRew.gems;
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
            return { owner_id: userId, species: sid, name: sp.name, hp: sp.base.hp, atk: sp.base.atk, def: sp.base.def, spd: sp.base.spd };
          });
          await supabase.from("monsters").insert(rows);
        }
        for (const lv of lvRew.levels) {
          const tier = lv === 100 ? "👑 Baú LENDÁRIO" : lv === 50 ? "🥇 Baú de OURO" : lv % 10 === 0 ? "🥈 Baú de PRATA" : "📦 Baú de Madeira";
          levelUpToasts.push(() => toast.success(`🎉 Level ${lv}! ${tier} aberto`, { duration: 4000 }));
        }
        const parts: string[] = [];
        if (lvRew.coins) parts.push(`🪙 ${lvRew.coins}`);
        if (lvRew.gems) parts.push(`💎 ${lvRew.gems}`);
        if (lvRew.rations) parts.push(`🍖 ${lvRew.rations}`);
        if (lvRew.petSpecies.length) parts.push(`🥚 ${lvRew.petSpecies.length} pet${lvRew.petSpecies.length > 1 ? "s" : ""}`);
        if (parts.length) levelUpToasts.push(() => toast(`Recompensas: ${parts.join(" • ")}`, { duration: 5000 }));
      } else {
        await patch(updates);
      }

      const opponentDelta = won ? -ARENA_LOSS_POINTS : ARENA_WIN_POINTS;
      const { data: oppProfile } = await supabase
        .from("profiles")
        .select("arena_points, wins, losses")
        .eq("id", opp.ownerId)
        .maybeSingle();
      if (oppProfile) {
        await supabase
          .from("profiles")
          .update({
            arena_points: Math.max(0, (oppProfile.arena_points ?? 0) + opponentDelta),
            wins: (oppProfile.wins ?? 0) + (won ? 0 : 1),
            losses: (oppProfile.losses ?? 0) + (won ? 1 : 0),
          })
          .eq("id", opp.ownerId);
      }

      await supabase.from("battles").insert({
        attacker_id: userId,
        defender_id: opp.ownerId,
        winner_id: won ? userId : opp.ownerId,
        log: JSON.parse(JSON.stringify(result.log)),
        coins_reward: rew.coins,
        xp_reward: rew.xp,
      });

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

      // Baús de promoção de TIER (apenas na PRIMEIRA vez que o jogador atinge cada tier)
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
          for (const tk of tiersToRoll) {
            const r = rollChest(tk);
            bonusCoins += r.coins;
            bonusGems += r.gems;
            bonusRations += r.rations;
            if (r.petSpecies) bonusPets.push(r.petSpecies);
          }

          // Aplica no DB
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
              return { owner_id: userId, species: sid, name: sp.name, hp: sp.base.hp, atk: sp.base.atk, def: sp.base.def, spd: sp.base.spd };
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
        // marca o tier máximo atingido pra não pagar baú de novo
        await supabase.from("profiles").update({ highest_tier_rank: newTierIdx }).eq("id", userId);
      }
    }

    setRewards({ ...rew, points: delta, oldPoints, newPoints, promoMsg, promoBefore, promoAfter: nextPromo });
    setBattleLog(result.log);
    setWinner(result.winner);
    levelUpToasts.forEach((fn) => fn());
    if (rationToast) rationToast();
  }

  // Avisar se o jogador tentar sair durante a animação da batalha
  // (o resultado já está salvo no DB, mas evita confusão)
  useEffect(() => {
    if (!battleLog) return;
    const animationDone = shownLog.length >= battleLog.length;
    if (animationDone) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "Batalha em andamento! O resultado já foi registrado.";
      return e.returnValue;
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [battleLog, shownLog.length]);



  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(20,5,50,0.6),rgba(20,5,50,0.8)),url(${arenaBg})` }}
    >
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />

      <div className="max-w-4xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Pátio</button>

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

            {battleLog && opponent && (
              <div className="relative">
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-full bg-black/70 backdrop-blur border border-white/30 text-white font-mono font-bold text-lg shadow-lg">
                  ⏱️ {Math.floor(battleTimer / 60)}:{String(battleTimer % 60).padStart(2, "0")}
                </div>
                <BattleScene
                  teamA={myTeam}
                  teamB={opponent.team}
                  log={battleLog}
                  step={shownLog.length}
                  playerAName={profile.username}
                  playerATier={getTier(profile.arena_points ?? 0).name}
                  playerBName={opponent.ownerName}
                  playerBTier={getTier(opponent.arenaPoints).name}
                />
              </div>
            )}

            {battleLog && (
              <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/30 p-4 text-white">
                <h3 className="font-extrabold mb-2 flex items-center gap-2">📜 Log da batalha</h3>
                <div className="space-y-1 text-sm max-h-72 overflow-y-auto">
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
                {shownLog.length === battleLog.length && rewards && opponent && (
                  <>
                    <BattleStats teamA={myTeam} teamB={opponent.team} log={battleLog} />
                    <div className={`mt-4 p-4 rounded-xl text-center font-extrabold ${winner === "team_a" ? "bg-green-500/40" : winner === "draw" ? "bg-yellow-500/40" : "bg-red-500/40"}`}>
                      {winner === "team_a" ? "🏆 VITÓRIA!" : winner === "draw" ? "🤝 EMPATE!" : "💀 Derrota..."}
                      <div className="text-sm font-normal mt-1">+🪙 {rewards.coins} • +✨ {rewards.xp} XP</div>
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
          return (
            <div key={m.id} className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${ELEMENT_COLORS[sp.element]} ring-2 ${RARITY_INFO[sp.rarity].ringColor} ${(m.rank ?? 1) >= MAX_RANK ? "rank-max-glow" : ""}`}>
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
        })}
      </div>
    </div>
  );
}
