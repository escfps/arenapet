import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, ROLE_INFO, RARITY_INFO, MAX_RANK, skinFilter, isVip, xpForNextLevel, rankStars, totalStats, ARENA_WIN_POINTS, ARENA_LOSS_POINTS, getTier, divisionBounds, promoNeeded, type PromoSeries, computeBattleEnergy, MAX_BATTLE_ENERGY, hungerMultiplier, rollLevelUpRewards } from "@/lib/game-data";
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
  const [winner, setWinner] = useState<"team_a" | "team_b" | null>(null);
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
      const { data } = await supabase.from("monsters").select("*").eq("owner_id", userId).eq("in_team", true).order("team_position", { ascending: true });
      if (data) setMyTeam(data as FullMonster[]);
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

  async function findOpponent() {
    if (!userId || !profile || myTeam.length === 0) return;
    setSearching(true);
    setOpponent(null);
    setBattleLog(null);
    setWinner(null);
    setRewards(null);

    // fetch candidate monsters (no embed — no FK between monsters and profiles)
    const { data: mons } = await supabase
      .from("monsters")
      .select("*")
      .neq("owner_id", userId)
      .eq("in_team", true)
      .limit(200);

    setSearching(false);

    const allMons = (mons ?? []) as FullMonster[];
    if (allMons.length === 0) {
      toast("Ninguém disponível ainda. Convide amigos! 🎯", { icon: "👀" });
      return;
    }

    // fetch profiles for those owners
    const ownerIds = Array.from(new Set(allMons.map((m) => m.owner_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, level, vip_until, arena_points")
      .in("id", ownerIds);
    const profById = new Map((profs ?? []).map((p) => [p.id as string, p]));

    // group by owner
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

    // Matchmaking by arena_points: try progressively wider windows
    const myPts = profile.arena_points ?? 0;
    const allOwners = Object.keys(byOwner);
    const windows = [100, 200, 400, 800];
    let ownerList: string[] = [];
    for (const w of windows) {
      ownerList = allOwners.filter((id) => Math.abs(byOwner[id].arenaPoints - myPts) <= w);
      if (ownerList.length > 0) break;
    }
    // Fallback: pick the closest 5 by points
    if (ownerList.length === 0 && allOwners.length > 0) {
      ownerList = allOwners
        .slice()
        .sort((a, b) => Math.abs(byOwner[a].arenaPoints - myPts) - Math.abs(byOwner[b].arenaPoints - myPts))
        .slice(0, 5);
    }
    if (ownerList.length === 0) {
      toast("Ninguém disponível ainda. Convide amigos! 🎯", { icon: "👀" });
      return;
    }
    const chosen = ownerList[Math.floor(Math.random() * ownerList.length)];
    setOpponent({ ownerId: chosen, ownerName: byOwner[chosen].username, arenaPoints: byOwner[chosen].arenaPoints, team: byOwner[chosen].team.slice(0, 4) });
  }

  // Compute current energy for each team pet (with regen applied)
  const teamEnergies = myTeam.map((m) => computeBattleEnergy(m.battle_energy, m.battle_energy_at));
  const minEnergy = teamEnergies.length ? Math.min(...teamEnergies.map((e) => e.energy)) : 0;
  const starvingPets = myTeam.filter((m) => (m.hunger ?? 100) <= 0);
  const hungryPets = myTeam.filter((m) => (m.hunger ?? 100) > 0 && (m.hunger ?? 100) < 50);
  const canFight = myTeam.length > 0 && minEnergy >= 1 && starvingPets.length === 0;

  async function fight() {
    if (!profile || !userId || !opponent) return;
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
    const b = opponent.team.map(toBattleMonster);
    const result = simulateBattle(a, b);
    setBattleLog(result.log);
    setWinner(result.winner);
    const won = result.winner === "team_a";
    const rew = computeRewards(profile.level, won, isVip(profile.vip_until));

    // Arena points + promo series logic
    const oldPoints = profile.arena_points ?? 0;
    const promoBefore = promo;
    let newPoints = oldPoints;
    let delta = 0;
    let promoMsg: string | undefined;
    let nextPromo: PromoSeries | null = promo;

    if (promo) {
      // We're in a promotion series — wins/losses don't change points until resolved
      const updated: PromoSeries = { ...promo, wins: promo.wins + (won ? 1 : 0), losses: promo.losses + (won ? 0 : 1) };
      const need = promoNeeded(promo.type);
      if (updated.wins >= need) {
        // Promoted! Advance into the next division (1 pt past cap)
        const b = divisionBounds(oldPoints);
        newPoints = b ? b.end : oldPoints + 1;
        delta = newPoints - oldPoints;
        nextPromo = null;
        promoMsg = promo.type === "bo5" ? "👑 SUBIU DE TIER!" : "🎉 Promovido!";
      } else if (updated.losses >= need) {
        // Failed: drop a bit back into the division
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
      // Cap at division end and start a promotion series
      const b = divisionBounds(oldPoints);
      if (b && newPoints >= b.end) {
        newPoints = b.end - 1; // sit at 99/100 visually; promo starts
        delta = newPoints - oldPoints;
        nextPromo = { wins: 0, losses: 0, type: b.nextIsTierUp ? "bo5" : "bo3", targetFrom: oldPoints };
        promoMsg = b.nextIsTierUp ? "🔥 Série de tier MD5 iniciada!" : "⚡ Série de promoção MD3 iniciada!";
      }
    }

    savePromo(userId, nextPromo);

    setRewards({ ...rew, points: delta, oldPoints, newPoints, promoMsg, promoBefore, promoAfter: nextPromo });

    // persist
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

    // Recompensas de level-up (baú de madeira; ouro a cada 10)
    if (newLevel > profile.level) {
      const lvRew = rollLevelUpRewards(profile.level, newLevel);
      updates.coins = (updates.coins ?? profile.coins) + lvRew.coins;
      updates.gems = (profile.gems ?? 0) + lvRew.gems;
      await patch(updates);
      // rações
      if (lvRew.rations > 0) {
        const { data: rRow } = await supabase.from("inventory").select("quantity").eq("user_id", userId).eq("item_type", "ration").maybeSingle();
        await supabase.from("inventory").upsert(
          { user_id: userId, item_type: "ration", quantity: (rRow?.quantity ?? 0) + lvRew.rations },
          { onConflict: "user_id,item_type" }
        );
      }
      // pets sorteados
      if (lvRew.petSpecies.length > 0) {
        const rows = lvRew.petSpecies.map((sid) => {
          const sp = SPECIES[sid];
          return { owner_id: userId, species: sid, name: sp.name, hp: sp.base.hp, atk: sp.base.atk, def: sp.base.def, spd: sp.base.spd };
        });
        await supabase.from("monsters").insert(rows);
      }
      // toasts
      for (const lv of lvRew.levels) {
        const tier = lv === 100 ? "👑 Baú LENDÁRIO" : lv === 50 ? "🥇 Baú de OURO" : lv % 10 === 0 ? "🥈 Baú de PRATA" : "📦 Baú de Madeira";
        toast.success(`🎉 Level ${lv}! ${tier} aberto`, { duration: 4000 });
      }
      const parts: string[] = [];
      if (lvRew.coins) parts.push(`🪙 ${lvRew.coins}`);
      if (lvRew.gems) parts.push(`💎 ${lvRew.gems}`);
      if (lvRew.rations) parts.push(`🍖 ${lvRew.rations}`);
      if (lvRew.petSpecies.length) parts.push(`🥚 ${lvRew.petSpecies.length} pet${lvRew.petSpecies.length > 1 ? "s" : ""}`);
      if (parts.length) toast(`Recompensas: ${parts.join(" • ")}`, { duration: 5000 });
    } else {
      await patch(updates);
    }

    // Bot/opponent profile also gains/loses points (opposite outcome)
    const opponentDelta = won ? -ARENA_LOSS_POINTS : ARENA_WIN_POINTS;
    const { data: oppProfile } = await supabase
      .from("profiles")
      .select("arena_points")
      .eq("id", opponent.ownerId)
      .maybeSingle();
    if (oppProfile) {
      await supabase
        .from("profiles")
        .update({ arena_points: Math.max(0, (oppProfile.arena_points ?? 0) + opponentDelta) })
        .eq("id", opponent.ownerId);
    }

    await supabase.from("battles").insert({
      attacker_id: userId,
      defender_id: opponent.ownerId,
      winner_id: won ? userId : opponent.ownerId,
      log: JSON.parse(JSON.stringify(result.log)),
      coins_reward: rew.coins,
      xp_reward: rew.xp,
    });

    // Ração drop on win (70% chance, 1-2 rações) — feeds expedition system
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
      toast(`🍖 +${dropped} ração!`, { icon: "🎁" });
    }
  }


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
                {searching ? "🔍 Buscando..." : "🎯 Buscar oponente"}
              </button>
              {opponent && !battleLog && (
                <button
                  onClick={fight}
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
                    <div className={`mt-4 p-4 rounded-xl text-center font-extrabold ${winner === "team_a" ? "bg-green-500/40" : "bg-red-500/40"}`}>
                      {winner === "team_a" ? "🏆 VITÓRIA!" : "💀 Derrota..."}
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
  return (
    <div className={`rounded-2xl bg-white/10 backdrop-blur-md border-2 ${side === "left" ? "border-blue-300/50" : "border-red-300/50"} p-3 text-white`}>
      <h3 className="font-extrabold mb-2">{title}</h3>
      <div className="space-y-2">
        {team.map((m, i) => {
          const sp = SPECIES[m.species];
          if (!sp) return null;
          const en = energies?.[i];
          return (
            <div key={m.id} className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${ELEMENT_COLORS[sp.element]} ring-2 ${RARITY_INFO[sp.rarity].ringColor} ${(m.rank ?? 1) >= MAX_RANK ? "rank-max-glow" : ""}`}>
              <img src={sp.image} alt="" className="h-14 w-14 object-contain drop-shadow-lg" style={{ filter: skinFilter(m.skin) }} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate flex items-center gap-1">
                  {m.name}
                  <span className={`px-1.5 py-0.5 rounded ${ROLE_INFO[sp.role].color} text-[9px]`}>
                    {ROLE_INFO[sp.role].emoji} {ROLE_INFO[sp.role].name}
                  </span>
                </div>
                {(() => { const st = totalStats(m.species, m.rank ?? 1); return (
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
