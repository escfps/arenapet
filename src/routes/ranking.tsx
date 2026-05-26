import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { getTier, nextTierProgress, SPECIES, RARITY_INFO, skinFilter, ARENA_WIN_POINTS, ARENA_LOSS_POINTS, rankStars, MAX_RANK } from "@/lib/game-data";
import { getPlayerBattles } from "@/lib/battles.functions";
import { getCurrentSeason, type SeasonInfo } from "@/lib/seasons.functions";
import { SEASON_REWARDS } from "@/lib/season-rewards";
import { BattleDetailModal, type BattleRow } from "@/components/BattleDetailModal";
import { SynergyBadges } from "@/components/SynergyBadges";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/ranking")({
  component: RankingPage,
});

function formatTimeLeft(endsAt: string): { days: number; hours: number; label: string } {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return { days: 0, hours: 0, label: "encerrando…" };
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return { days, hours, label: `${days} dia${days !== 1 ? "s" : ""}${hours > 0 ? ` e ${hours}h` : ""}` };
  return { days: 0, hours, label: `${hours}h` };
}

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
  const fetchSeason = useServerFn(getCurrentSeason);
  const [rows, setRows] = useState<Row[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [historyOf, setHistoryOf] = useState<Row | null>(null);
  const [season, setSeason] = useState<SeasonInfo | null>(null);

  useEffect(() => {
    fetchSeason().then(setSeason).catch(() => {});
  }, [fetchSeason]);

  useEffect(() => {
    async function load() {
      const { data } = await (supabase as any)
        .from("public_profiles")
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
            ⭐ Season {season ? `#${season.number}` : "#1"} ⭐
          </div>
          <h1 className="text-4xl font-extrabold drop-shadow-lg">🏆 Ranking</h1>
          <p className="opacity-80 text-sm">Top 100 jogadores da arena</p>
        </header>

        {/* Season banner: countdown + legendary slots */}
        {season && (
          <div className="rounded-2xl bg-gradient-to-br from-fuchsia-900/70 via-purple-900/70 to-indigo-900/70 backdrop-blur-md border-2 border-fuchsia-400/40 p-4 text-white shadow-xl">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">Season Atual</div>
                <div className="text-2xl font-extrabold drop-shadow">Season {season.number}</div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider opacity-80 font-bold">⏳ Termina em</div>
                <div className="text-xl font-extrabold text-amber-300 drop-shadow">
                  {formatTimeLeft(season.ends_at).label}
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-black/30 p-3 border border-white/10">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-extrabold flex items-center gap-1">🌟 Lendário — vagas exclusivas</span>
                <span className="text-sm font-extrabold text-amber-300">{season.legendary_filled}/{season.legendary_slots}</span>
              </div>
              <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400"
                  style={{ width: `${Math.min(100, (season.legendary_filled / season.legendary_slots) * 100)}%` }}
                />
              </div>
              <div className="text-[10px] opacity-80 mt-1">
                Só os 10 jogadores que se mantiverem no topo até o último dia da Season ganham Lendário. Se alguém te ultrapassar, você cai pra Mestre — a disputa vale até o fim! ⚔️
              </div>
            </div>
          </div>
        )}

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

        {/* Season rewards per tier */}
        <details className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-white overflow-hidden" open>
          <summary className="cursor-pointer select-none px-4 py-3 font-bold flex items-center justify-between hover:bg-white/5">
            <span>🎁 Recompensas da Season</span>
            <span className="text-[10px] opacity-70">enviadas automaticamente no fim</span>
          </summary>
          <div className="p-3 grid gap-2 sm:grid-cols-2">
            {SEASON_REWARDS.map((r) => (
              <div key={r.tier} className="rounded-xl bg-black/30 border border-white/10 p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`px-2 py-1 rounded text-xs font-extrabold ${r.color}`}>{r.emoji} {r.tier}</span>
                  <span className="text-sm font-extrabold text-cyan-200">💎 {r.gems}</span>
                </div>
                <div className="text-xs opacity-90">📦 {r.chests}</div>
                {r.extras && <div className="text-[11px] mt-1 text-amber-200 font-bold">✨ {r.extras}</div>}
              </div>
            ))}
          </div>
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
                    className={`flex items-center gap-3 p-3 ${isMe ? "bg-yellow-400/20" : ""}`}
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

    </main>
  );
}


