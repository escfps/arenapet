import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, ROLE_INFO, skinFilter, isVip, xpForNextLevel } from "@/lib/game-data";
import type { MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { simulateBattle, computeRewards, toBattleMonster, type BattleLogEntry } from "@/lib/battle";
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
  const [opponent, setOpponent] = useState<{ ownerId: string; ownerName: string; team: FullMonster[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[] | null>(null);
  const [winner, setWinner] = useState<"team_a" | "team_b" | null>(null);
  const [rewards, setRewards] = useState<{ coins: number; xp: number } | null>(null);
  const [shownLog, setShownLog] = useState<BattleLogEntry[]>([]);

  useEffect(() => {
    async function loadTeam() {
      if (!userId) return;
      const { data } = await supabase.from("monsters").select("*").eq("owner_id", userId).eq("in_team", true);
      if (data) setMyTeam(data as FullMonster[]);
    }
    if (userId) loadTeam();
  }, [userId]);

  // animate log
  useEffect(() => {
    if (!battleLog) return;
    setShownLog([]);
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setShownLog(battleLog.slice(0, i));
      if (i >= battleLog.length) clearInterval(interval);
    }, 800);
    return () => clearInterval(interval);
  }, [battleLog]);

  async function findOpponent() {
    if (!userId || !profile || myTeam.length === 0) return;
    setSearching(true);
    setOpponent(null);
    setBattleLog(null);
    setWinner(null);
    setRewards(null);

    // pick a random opponent profile (not self, has at least 1 monster in team)
    const minLvl = Math.max(1, profile.level - 3);
    const maxLvl = profile.level + 3;
    const { data: candidates } = await supabase
      .from("monsters")
      .select("*, profiles!inner(username, level, vip_until)")
      .neq("owner_id", userId)
      .eq("in_team", true)
      .gte("level", minLvl)
      .lte("level", maxLvl)
      .limit(50);

    setSearching(false);

    let opponents = candidates ?? [];
    if (opponents.length === 0) {
      // fallback: any opponent
      const { data: anyone } = await supabase
        .from("monsters")
        .select("*, profiles!inner(username, level, vip_until)")
        .neq("owner_id", userId)
        .eq("in_team", true)
        .limit(50);
      opponents = anyone ?? [];
    }

    if (opponents.length === 0) {
      toast("Ninguém disponível ainda. Convide amigos! 🎯", { icon: "👀" });
      return;
    }

    // group by owner_id
    const byOwner: Record<string, { team: FullMonster[]; profile: { username: string } }> = {};
    for (const m of opponents) {
      const ownerId = m.owner_id as string;
      const p = (m as unknown as { profiles: { username: string } }).profiles;
      if (!byOwner[ownerId]) byOwner[ownerId] = { team: [], profile: p };
      byOwner[ownerId].team.push(m as FullMonster);
    }
    const ownerIds = Object.keys(byOwner);
    const chosen = ownerIds[Math.floor(Math.random() * ownerIds.length)];
    setOpponent({ ownerId: chosen, ownerName: byOwner[chosen].profile.username, team: byOwner[chosen].team.slice(0, 4) });
  }

  async function fight() {
    if (!profile || !userId || !opponent) return;
    const a = myTeam.map(toBattleMonster);
    const b = opponent.team.map(toBattleMonster);
    const result = simulateBattle(a, b);
    setBattleLog(result.log);
    setWinner(result.winner);
    const won = result.winner === "team_a";
    const rew = computeRewards(profile.level, won, isVip(profile.vip_until));
    setRewards(rew);

    // persist
    const updates: Partial<typeof profile> = {
      coins: profile.coins + rew.coins,
      xp: profile.xp + rew.xp,
      wins: profile.wins + (won ? 1 : 0),
      losses: profile.losses + (won ? 0 : 1),
    };
    let newXp = updates.xp!;
    let newLevel = profile.level;
    while (newXp >= xpForNextLevel(newLevel)) {
      newXp -= xpForNextLevel(newLevel);
      newLevel += 1;
    }
    updates.xp = newXp;
    updates.level = newLevel;
    await patch(updates);

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
              <TeamPanel title="Seu time" team={myTeam} side="left" />
              {opponent ? (
                <TeamPanel title={`vs ${opponent.ownerName}`} team={opponent.team} side="right" />
              ) : (
                <div className="rounded-2xl bg-white/10 backdrop-blur-md border-2 border-dashed border-white/30 flex items-center justify-center p-8 text-white/70 text-center">
                  ❓<br/>Nenhum oponente ainda
                </div>
              )}
            </div>

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
                  className="px-8 py-3 rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white font-extrabold shadow-xl hover:scale-105 transition"
                >
                  ⚔️ BATALHAR!
                </button>
              )}
            </div>

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
                {shownLog.length === battleLog.length && rewards && (
                  <div className={`mt-4 p-4 rounded-xl text-center font-extrabold ${winner === "team_a" ? "bg-green-500/40" : "bg-red-500/40"}`}>
                    {winner === "team_a" ? "🏆 VITÓRIA!" : "💀 Derrota..."}
                    <div className="text-sm font-normal mt-1">+🪙 {rewards.coins} • +✨ {rewards.xp} XP</div>
                    {!isVip(profile.vip_until) && winner === "team_a" && (
                      <div className="mt-2 text-xs opacity-90">👑 VIP daria <b>+50% nas recompensas!</b></div>
                    )}
                    <button onClick={findOpponent} className="mt-3 px-4 py-2 bg-yellow-400 text-yellow-950 rounded-lg text-sm">Próxima batalha</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function TeamPanel({ title, team, side }: { title: string; team: FullMonster[]; side: "left" | "right" }) {
  return (
    <div className={`rounded-2xl bg-white/10 backdrop-blur-md border-2 ${side === "left" ? "border-blue-300/50" : "border-red-300/50"} p-3 text-white`}>
      <h3 className="font-extrabold mb-2">{title}</h3>
      <div className="space-y-2">
        {team.map((m) => {
          const sp = SPECIES[m.species];
          if (!sp) return null;
          return (
            <div key={m.id} className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${ELEMENT_COLORS[sp.element]}`}>
              <img src={sp.image} alt="" className="h-14 w-14 object-contain drop-shadow-lg" style={{ filter: skinFilter(m.skin) }} />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate flex items-center gap-1">
                  {m.name}
                  <span className={`px-1.5 py-0.5 rounded ${ROLE_INFO[sp.role].color} text-[9px]`}>
                    {ROLE_INFO[sp.role].emoji} {ROLE_INFO[sp.role].name}
                  </span>
                </div>
                <div className="text-[10px] opacity-90">Nv {m.level} • ❤️{m.hp} ⚔️{m.atk} 🛡️{m.def} 💨{m.spd}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
