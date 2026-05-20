import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { getTier, nextTierProgress, SPECIES, RARITY_INFO, skinFilter, ARENA_WIN_POINTS, ARENA_LOSS_POINTS, rankStars, MAX_RANK } from "@/lib/game-data";
import { getPlayerBattles } from "@/lib/battles.functions";
import { BattleDetailModal, type BattleRow } from "@/components/BattleDetailModal";
import { SynergyBadges } from "@/components/SynergyBadges";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
});

type TeamMon = {
  id: string;
  species: string;
  name: string;
  skin: string;
  rank: number;
};

type Row = {
  id: string;
  username: string;
  arena_points: number;
  wins: number;
  losses: number;
  level: number;
  team: TeamMon[];
};

function RankingPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const [rows, setRows] = useState<Row[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [historyOf, setHistoryOf] = useState<Row | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, arena_points, wins, losses, level")
        .order("arena_points", { ascending: false })
        .limit(100);
      const baseList = (data ?? []) as Omit<Row, "team">[];
      const ids = baseList.map((r) => r.id);
      const teamsByOwner: Record<string, TeamMon[]> = {};
      if (ids.length > 0) {
        const { data: mons } = await supabase
          .from("monsters")
          .select("id, owner_id, species, name, skin, rank, in_team")
          .in("owner_id", ids)
          .eq("in_team", true);
        for (const m of (mons ?? []) as Array<TeamMon & { owner_id: string }>) {
          (teamsByOwner[m.owner_id] ||= []).push({ id: m.id, species: m.species, name: m.name, skin: m.skin, rank: m.rank });
        }
      }
      const list: Row[] = baseList.map((r) => ({ ...r, team: (teamsByOwner[r.id] ?? []).slice(0, 3) }));
      setRows(list);
      if (profile) {
        const idx = list.findIndex((r) => r.id === profile.id);
        setMyRank(idx >= 0 ? idx + 1 : null);
      }
    }
    load();
  }, [profile]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  const myTier = getTier(profile.arena_points ?? 0, myRank ?? undefined);
  const progress = nextTierProgress(profile.arena_points ?? 0);

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(20,5,50,0.7),rgba(20,5,50,0.9)),url(${arenaBg})` }}
    >
      <HUD profile={profile} />
      <div className="max-w-3xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Home</button>

        <header className="text-center text-white">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-2 rounded-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white text-xs font-extrabold shadow-lg uppercase tracking-wider">
            ⭐ Season #1 ⭐
          </div>
          <h1 className="text-4xl font-extrabold drop-shadow-lg">🏆 Ranking</h1>
          <p className="opacity-80 text-sm">Top 100 jogadores da arena</p>
        </header>

        {/* Player tier card */}
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={`px-3 py-2 rounded-xl font-extrabold text-lg shadow-lg ${myTier.color}`}>
              {myTier.emoji} {myTier.short}
            </div>
            <div className="flex-1 min-w-[180px]">
              <div className="text-xs opacity-80">{profile.username}</div>
              <div className="font-bold">{profile.arena_points ?? 0} pts {myRank ? `• #${myRank}` : ""}</div>
              {progress && (
                <div className="mt-1">
                  <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, progress.pct))}%` }}
                    />
                  </div>
                  <div className="text-[10px] opacity-70 mt-0.5">
                    {Math.max(0, progress.next - (profile.arena_points ?? 0))} pts para subir
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tier reference */}
        <details className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white overflow-hidden" open>
          <summary className="cursor-pointer select-none px-4 py-3 font-bold flex items-center justify-between hover:bg-white/5">
            <span>📜 Elos & Pontuação</span>
            <span className="text-[10px] opacity-70">cada divisão = 100 pts</span>
          </summary>
          <ul className="divide-y divide-white/10 text-sm">
            {[
              { name: "Ferro",       emoji: "⛓️", range: "0 – 499",      color: "bg-zinc-600 text-white" },
              { name: "Bronze",      emoji: "🥉", range: "500 – 999",    color: "bg-amber-700 text-amber-50" },
              { name: "Prata",       emoji: "🥈", range: "1000 – 1499",  color: "bg-slate-400 text-slate-900" },
              { name: "Ouro",        emoji: "🥇", range: "1500 – 1999",  color: "bg-yellow-500 text-yellow-950" },
              { name: "Platina",     emoji: "💠", range: "2000 – 2499",  color: "bg-cyan-500 text-cyan-950" },
              { name: "Diamante",    emoji: "💎", range: "2500 – 2999",  color: "bg-sky-400 text-sky-950" },
              { name: "Mestre",      emoji: "🏆", range: "3000 – 3999",  color: "bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white" },
              { name: "Grão-Mestre", emoji: "🔥", range: "4000+",        color: "bg-gradient-to-r from-red-500 to-pink-600 text-white" },
              { name: "Lendário",    emoji: "👑", range: "Top 10 (4000+)", color: "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white" },
            ].map((t) => (
              <li key={t.name} className="flex items-center gap-3 px-4 py-2">
                <span className={`px-2 py-1 rounded text-xs font-extrabold ${t.color}`}>{t.emoji} {t.name}</span>
                <span className="text-xs opacity-80 ml-auto font-mono">{t.range} pts</span>
              </li>
            ))}
          </ul>
        </details>

        {/* Leaderboard */}
        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-6 text-center text-white/70">Ninguém no ranking ainda.</div>
          ) : (
            <ul className="divide-y divide-white/10">
              {rows.map((r, idx) => {
                const rank = idx + 1;
                const tier = getTier(r.arena_points ?? 0, rank);
                const isMe = r.id === profile.id;
                return (
                  <li
                    key={r.id}
                    onClick={() => setHistoryOf(r)}
                    className={`flex items-center gap-3 p-3 cursor-pointer ${isMe ? "bg-yellow-400/20 hover:bg-yellow-400/30" : "hover:bg-white/5"}`}
                  >
                    <div className={`w-10 text-center font-extrabold ${
                      rank === 1 ? "text-yellow-300 text-xl" :
                      rank === 2 ? "text-slate-200 text-lg" :
                      rank === 3 ? "text-amber-400 text-lg" :
                      "text-white/70"
                    }`}>
                      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate flex items-center gap-2">
                        {r.username}
                        {isMe && <span className="text-[9px] bg-yellow-400 text-yellow-950 px-1.5 rounded font-extrabold">VOCÊ</span>}
                      </div>
                      <div className="text-[10px] text-white/60">
                        Nv {r.level} • {r.wins}V/{r.losses}D
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        {r.team.length === 0 ? (
                          <span className="text-[10px] text-white/40 italic">Sem time</span>
                        ) : (
                          r.team.map((m) => {
                            const sp = SPECIES[m.species];
                            const rar = sp ? RARITY_INFO[sp.rarity] : null;
                            return (
                              <div
                                key={m.id}
                                title={`${m.name}${sp ? ` (${sp.name})` : ""} • ${rankStars(m.rank ?? 1)}`}
                                className="flex flex-col items-center gap-0.5"
                              >
                                <div className={`w-8 h-8 rounded-full bg-black/40 border ${rar ? rar.ringColor : "ring-white/20"} ring-1 overflow-hidden flex items-center justify-center ${(m.rank ?? 1) >= MAX_RANK ? "rank-max-glow" : ""}`}>
                                  {sp?.image ? (
                                    <img
                                      src={sp.image}
                                      alt={m.name}
                                      className="w-full h-full object-cover"
                                      style={{ filter: skinFilter(m.skin) }}
                                    />
                                  ) : (
                                    <span className="text-lg leading-none">❓</span>
                                  )}
                                </div>
                                <span className={`text-[8px] leading-none font-extrabold px-1 py-0.5 rounded ${(m.rank ?? 1) >= MAX_RANK ? "bg-gradient-to-r from-yellow-300 via-pink-400 to-violet-400 text-white" : "bg-amber-400/90 text-amber-950"}`}>
                                  {rankStars(m.rank ?? 1)}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {r.team.length >= 2 && (
                        <div className="mt-1">
                          <SynergyBadges speciesIds={r.team.map((m) => m.species)} onlyActive compact />
                        </div>
                      )}
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-extrabold ${tier.color}`}>
                      {tier.emoji} {tier.short}
                    </span>
                    <div className="w-16 text-right font-extrabold text-white">{r.arena_points ?? 0}</div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {historyOf && (
        <PlayerHistoryModal player={historyOf} viewerId={profile.id} onClose={() => setHistoryOf(null)} />
      )}
    </main>
  );
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function PlayerHistoryModal({ player, viewerId, onClose }: { player: Row; viewerId: string; onClose: () => void }) {
  const fetchBattles = useServerFn(getPlayerBattles);
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [opponents, setOpponents] = useState<Record<string, { username: string; level: number }>>({});
  const [loading, setLoading] = useState(true);
  const [openBattle, setOpenBattle] = useState<BattleRow | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchBattles({ data: { userId: player.id, limit: 30 } })
      .then((res) => {
        setBattles(res.battles as BattleRow[]);
        setOpponents(res.opponents);
      })
      .finally(() => setLoading(false));
  }, [player.id, fetchBattles]);

  const wins = battles.filter((b) => b.winner_id === player.id).length;
  const losses = battles.length - wins;

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-white/20 shadow-2xl p-5 text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-xl font-extrabold">📜 Histórico de {player.username}</h2>
            <p className="text-xs opacity-80">
              Nv {player.level} • {player.arena_points} pts • {wins}V/{losses}D nas últimas {battles.length}
            </p>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-white/60">Carregando batalhas…</div>
        ) : battles.length === 0 ? (
          <div className="py-12 text-center text-white/60">Esse jogador ainda não tem batalhas registradas.</div>
        ) : (
          <div className="space-y-2">
            {battles.map((b) => {
              const won = b.winner_id === player.id;
              const oppId = b.attacker_id === player.id ? b.defender_id : b.attacker_id;
              const opp = opponents[oppId];
              const role = b.attacker_id === player.id ? "Atacou" : "Defendeu";
              const delta = b.attacker_id === player.id
                ? (b.attacker_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS))
                : (b.defender_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS));
              return (
                <button
                  key={b.id}
                  onClick={() => setOpenBattle(b)}
                  className={`w-full text-left rounded-2xl border-2 p-3 transition hover:scale-[1.01] flex items-center gap-3 ${
                    won
                      ? "border-emerald-400/60 bg-gradient-to-r from-emerald-900/60 to-emerald-700/30"
                      : "border-rose-400/60 bg-gradient-to-r from-rose-900/60 to-rose-700/30"
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-black ${won ? "bg-emerald-400 text-emerald-950" : "bg-rose-400 text-rose-950"}`}>
                    {won ? "🏆" : "💀"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold truncate text-sm">
                      {won ? "V" : "D"} vs {opp?.username ?? "?"} <span className="text-[10px] opacity-70">Nv {opp?.level ?? "?"}</span>
                    </div>
                    <div className="text-[10px] opacity-80">{role} • {timeAgo(b.created_at)} • toque pra ver replay</div>
                  </div>
                  <div className={`text-xs font-extrabold ${delta >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                    {delta >= 0 ? `+${delta}` : delta} 🏆
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {openBattle && (
        <BattleDetailModal battle={openBattle} viewerId={viewerId} onClose={() => setOpenBattle(null)} />
      )}
    </div>
  );
}

