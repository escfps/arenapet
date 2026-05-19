import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { TournamentBattle } from "@/components/TournamentBattle";
import { ChampionCelebration } from "@/components/ChampionCelebration";
import type { BattleLogEntry } from "@/lib/battle";
import arenaBg from "@/assets/arena-bg.jpg";
import { SPECIES } from "@/lib/game-data";

type ChampTeamPet = { species: string; team_position: number };

export const Route = createFileRoute("/tournament")({
  component: TournamentPage,
});

type ChampionReward = {
  coins: number;
  gems: number;
  rations: number;
  bonus_pet: { species: string; name: string; rarity: string } | null;
} | null;

type Tournament = {
  id: string;
  slot_at: string;
  status: "open" | "in_progress" | "finished";
  champion_id: string | null;
  finished_at: string | null;
  current_round: number;
  round_started_at: string | null;
  round_duration_seconds: number;
  champion_reward: ChampionReward;
};

type Entry = {
  id: string;
  tournament_id: string;
  user_id: string;
  is_bot: boolean;
  seed: number | null;
  power: number | null;
  eliminated_round: number | null;
};

type Match = {
  id: string;
  tournament_id: string;
  round: number;
  slot: number;
  p1_id: string | null;
  p2_id: string | null;
  winner_id: string | null;
  score: string | null;
  status: "pending" | "done";
  log: BattleLogEntry[] | null;
};

type ProfileLite = { id: string; username: string; is_bot: boolean };

const ROUND_NAMES: Record<number, string> = {
  1: "Oitavas de Final",
  2: "Quartas de Final",
  3: "Semifinal",
  4: "Final",
};

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function TournamentPage() {
  const { userId, profile, patch } = useProfile();
  const [activeT, setActiveT] = useState<Tournament | null>(null);
  const [lastT, setLastT] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profs, setProfs] = useState<Record<string, ProfileLite>>({});
  const [champs, setChamps] = useState<Array<{ user_id: string; wins: number; last_win_at: string; username: string }>>([]);
  const [champTeams, setChampTeams] = useState<Record<string, ChampTeamPet[]>>({});
  const [joining, setJoining] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<"current" | "last" | "leaderboard">("current");
  const [battleMatch, setBattleMatch] = useState<{ m: Match; mode: "play" | "watch" } | null>(null);
  const [celebrated, setCelebrated] = useState<Tournament | null>(null);


  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    // Active tournament: open or in_progress (prefer in_progress, then open)
    const { data: actRows } = await supabase
      .from("tournaments")
      .select("*")
      .in("status", ["open", "in_progress"])
      .order("slot_at", { ascending: true })
      .limit(2);
    const inProg = (actRows ?? []).find((t) => t.status === "in_progress") as Tournament | undefined;
    const open = (actRows ?? []).find((t) => t.status === "open") as Tournament | undefined;
    const active = (inProg ?? open ?? null) as Tournament | null;
    setActiveT(active);

    const { data: lastRows } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", "finished")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1);
    const last = (lastRows?.[0] as Tournament | undefined) ?? null;
    setLastT(last);

    const ids = [active?.id, last?.id, open?.id].filter(Boolean) as string[];
    if (ids.length > 0) {
      const [{ data: ents }, { data: ms }] = await Promise.all([
        supabase.from("tournament_entries").select("*").in("tournament_id", ids),
        supabase.from("tournament_matches").select("*").in("tournament_id", ids),
      ]);
      setEntries((ents as Entry[]) ?? []);
      setMatches((ms as Match[]) ?? []);

      const userIds = new Set<string>();
      (ents as Entry[] | null)?.forEach((e) => userIds.add(e.user_id));
      (ms as Match[] | null)?.forEach((m) => {
        if (m.p1_id) userIds.add(m.p1_id);
        if (m.p2_id) userIds.add(m.p2_id);
      });
      if (last?.champion_id) userIds.add(last.champion_id);
      if (active?.champion_id) userIds.add(active.champion_id);
      if (userIds.size > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, username, is_bot")
          .in("id", Array.from(userIds));
        const map: Record<string, ProfileLite> = {};
        (ps as ProfileLite[] | null)?.forEach((p) => (map[p.id] = p));
        setProfs((prev) => ({ ...prev, ...map }));
      }
    } else {
      setEntries([]);
      setMatches([]);
    }

    const { data: cs } = await supabase
      .from("tournament_champions")
      .select("user_id, wins, last_win_at")
      .order("wins", { ascending: false })
      .limit(50);
    if (cs && cs.length > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", cs.map((c) => c.user_id));
      const nameMap = new Map((ps ?? []).map((p) => [p.id as string, p.username as string]));
      setChamps(
        cs.map((c) => ({
          user_id: c.user_id as string,
          wins: c.wins as number,
          last_win_at: c.last_win_at as string,
          username: nameMap.get(c.user_id as string) ?? "Treinador",
        }))
      );
    } else {
      setChamps([]);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  // Pop the champion celebration when the user is the freshly crowned champion
  useEffect(() => {
    if (!userId || !lastT || lastT.champion_id !== userId) return;
    const key = `champion_seen_${lastT.id}`;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(key)) return;
    setCelebrated(lastT);
  }, [userId, lastT]);

  // Preview mode: visit /tournament#preview-win to see the champion celebration
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#preview-win") return;
    setCelebrated({
      id: "preview",
      slot_at: new Date().toISOString(),
      status: "finished",
      champion_id: userId ?? "preview-user",
      finished_at: new Date().toISOString(),
      current_round: 4,
      round_started_at: null,
      round_duration_seconds: 90,
      champion_reward: {
        coins: 3250,
        gems: 42,
        rations: 9,
        bonus_pet: { species: "dragon", name: "Dragão de Fogo", rarity: "epic" },
      },
    });
  }, [userId]);



  // Nudge the server tick when a round timer should have expired
  useEffect(() => {
    if (!activeT) return;
    if (activeT.status !== "in_progress" || !activeT.round_started_at) return;
    const expires = new Date(activeT.round_started_at).getTime() + activeT.round_duration_seconds * 1000;
    if (now > expires) {
      supabase.rpc("tournaments_tick").then(() => refresh());
    }
  }, [activeT, now]);

  // Also nudge when registration window of open tournament closes
  useEffect(() => {
    if (!activeT || activeT.status !== "open") return;
    const closes = new Date(activeT.slot_at).getTime() + 60_000;
    if (now > closes) supabase.rpc("tournaments_tick").then(() => refresh());
  }, [activeT, now]);

  const openSlotMs = activeT && activeT.status === "open" ? new Date(activeT.slot_at).getTime() : 0;
  const closesAtMs = openSlotMs + 60_000;
  const closesIn = closesAtMs - now;
  const startsIn = openSlotMs - now;
  const isRegistering = activeT && activeT.status === "open" && now >= openSlotMs && now < closesAtMs;
  const myEntry = activeT && userId ? entries.find((e) => e.tournament_id === activeT.id && e.user_id === userId) : null;

  const currentRoundMatches = useMemo(() => {
    if (!activeT || activeT.status !== "in_progress") return [];
    return matches
      .filter((m) => m.tournament_id === activeT.id && m.round === activeT.current_round)
      .sort((a, b) => a.slot - b.slot);
  }, [activeT, matches]);

  const myCurrentMatch = useMemo(() => {
    if (!userId) return null;
    return currentRoundMatches.find((m) => m.p1_id === userId || m.p2_id === userId) ?? null;
  }, [currentRoundMatches, userId]);

  const myActiveBracket = useMemo(() => {
    if (!activeT) return null;
    const ms = matches.filter((m) => m.tournament_id === activeT.id);
    const grouped: Record<number, Match[]> = {};
    ms.forEach((m) => {
      grouped[m.round] = grouped[m.round] ?? [];
      grouped[m.round].push(m);
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.slot - b.slot));
    return grouped;
  }, [activeT, matches]);

  const lastBracket = useMemo(() => {
    if (!lastT) return null;
    const ms = matches.filter((m) => m.tournament_id === lastT.id);
    const grouped: Record<number, Match[]> = {};
    ms.forEach((m) => {
      grouped[m.round] = grouped[m.round] ?? [];
      grouped[m.round].push(m);
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.slot - b.slot));
    return grouped;
  }, [lastT, matches]);

  async function join() {
    if (!activeT || joining) return;
    if (!profile || (profile.gems ?? 0) < 1) {
      toast.error("Você precisa de 1 💎 pra entrar");
      return;
    }
    setJoining(true);
    const { error } = await supabase.rpc("join_tournament", { p_tournament_id: activeT.id });
    setJoining(false);
    if (error) {
      toast.error(error.message ?? "Não foi possível inscrever");
      return;
    }
    patch?.({ gems: (profile.gems ?? 0) - 1 });
    toast.success("Inscrito na copa! 🏆");
    void refresh();
  }

  const pName = (id?: string | null) => (id ? profs[id]?.username ?? "…" : "—");
  const pIsBot = (id?: string | null) => (id ? profs[id]?.is_bot ?? false : false);

  const roundEndsAt = activeT?.round_started_at
    ? new Date(activeT.round_started_at).getTime() + activeT.round_duration_seconds * 1000
    : 0;
  const roundTimeLeft = roundEndsAt - now;

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando…</div>;
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundImage: `url(${arenaBg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/85 via-indigo-950/85 to-slate-950/90" />
      <div className="relative">
        <Toaster position="top-center" richColors />
        <HUD profile={profile} />
        <main className="max-w-5xl mx-auto px-3 py-4 space-y-4">
          <div className="text-center text-white">
            <h1 className="text-3xl font-extrabold drop-shadow-lg">🏆 Copa Pet</h1>
            <p className="text-sm opacity-80">Torneios de 32 a cada 10 minutos • MD1 ao vivo</p>
          </div>

          {/* Trophy banner */}
          {lastT?.champion_id && (
            <div className="rounded-2xl bg-gradient-to-r from-yellow-500/35 via-amber-400/40 to-yellow-500/35 border-2 border-yellow-300 px-4 py-3 text-center text-white shadow-lg">
              <div className="text-3xl">🏆</div>
              <div className="text-xs opacity-90">Campeão da última copa</div>
              <div className="text-lg font-extrabold text-yellow-100 drop-shadow">
                {pName(lastT.champion_id)}
              </div>
              {lastT.champion_id === userId && (
                <button
                  onClick={() => setCelebrated(lastT)}
                  className="mt-2 px-3 py-1 rounded-full bg-yellow-400 text-yellow-950 text-[11px] font-extrabold hover:scale-105 transition"
                >
                  👁 Ver minha vitória
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-center">
            {([
              ["current", "📥 Copa Atual"],
              ["last", "🥇 Última Copa"],
              ["leaderboard", "👑 Campeões"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                  tab === k ? "bg-yellow-400 text-yellow-950" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "current" && (
            <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white space-y-4">
              {!activeT ? (
                <div className="text-center text-sm opacity-80">Carregando próxima copa…</div>
              ) : activeT.status === "open" ? (
                <>
                  <div className="text-center">
                    <div className="text-xs opacity-80">Próxima copa</div>
                    <div className="text-2xl font-extrabold">
                      {new Date(activeT.slot_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {isRegistering ? (
                      <div className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-500/80 text-xs font-extrabold animate-pulse">
                        🟢 INSCRIÇÕES ABERTAS — fecham em {fmtCountdown(closesIn)}
                      </div>
                    ) : startsIn > 0 ? (
                      <div className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-500/80 text-xs font-extrabold">
                        ⏳ Abre em {fmtCountdown(startsIn)}
                      </div>
                    ) : (
                      <div className="mt-2 inline-block px-3 py-1 rounded-full bg-red-500/80 text-xs font-extrabold">
                        🔒 Inscrições encerradas
                      </div>
                    )}
                  </div>

                  <div className="text-center">
                    {myEntry ? (
                      <div className="px-4 py-2.5 rounded-xl bg-emerald-500/30 border border-emerald-400/60 text-sm font-extrabold">
                        ✅ Você está inscrito! Assim que fechar, a 1ª rodada começa.
                      </div>
                    ) : isRegistering ? (
                      <button
                        onClick={join}
                        disabled={joining}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 text-yellow-950 font-extrabold hover:scale-105 transition disabled:opacity-60"
                      >
                        {joining ? "Inscrevendo…" : "Entrar na Copa por 💎 1"}
                      </button>
                    ) : (
                      <div className="text-xs opacity-80">Aguarde abrir a próxima janela de inscrição.</div>
                    )}
                  </div>

                  <div className="rounded-xl bg-white/5 p-3 text-xs space-y-1">
                    <div>💎 <b>Inscrição:</b> 1 diamante</div>
                    <div>🥇 <b>Campeão</b> ganha: 1 Baú de Ouro</div>
                    <div>⏱️ <b>90 segundos</b> por rodada — quem não jogar perde por W.O.</div>
                    <div>📺 Terminou sua partida? Assista as outras enquanto a rodada não fecha</div>
                  </div>
                </>
              ) : activeT.status === "in_progress" ? (
                <>
                  <div className="text-center">
                    <div className="text-xs opacity-80">{ROUND_NAMES[activeT.current_round] ?? `Rodada ${activeT.current_round}`}</div>
                    <div className={`mt-1 inline-block px-4 py-1.5 rounded-full font-extrabold text-lg ${roundTimeLeft > 20000 ? "bg-emerald-500/80" : roundTimeLeft > 0 ? "bg-amber-500/80 animate-pulse" : "bg-red-600/80"}`}>
                      ⏱️ {fmtCountdown(Math.max(0, roundTimeLeft))}
                    </div>
                  </div>

                  {myCurrentMatch ? (
                    myCurrentMatch.status === "pending" ? (
                      <div className="rounded-xl bg-gradient-to-r from-red-500/30 to-rose-500/30 border-2 border-red-300 p-4 text-center">
                        <div className="text-sm font-bold mb-2">⚔️ Sua partida está pronta!</div>
                        <div className="text-xs opacity-90 mb-3">
                          Vs <b>{myCurrentMatch.p1_id === userId ? pName(myCurrentMatch.p2_id) : pName(myCurrentMatch.p1_id)}</b>
                          {pIsBot(myCurrentMatch.p1_id === userId ? myCurrentMatch.p2_id : myCurrentMatch.p1_id) && " 🤖"}
                        </div>
                        <button
                          onClick={() => setBattleMatch({ m: myCurrentMatch, mode: "play" })}
                          className="px-6 py-3 rounded-xl bg-gradient-to-b from-red-500 to-red-700 text-white font-extrabold shadow-xl hover:scale-105 transition"
                        >
                          ▶ JOGAR MINHA PARTIDA
                        </button>
                      </div>
                    ) : (
                      <div className={`rounded-xl border-2 p-3 text-center ${
                        myCurrentMatch.winner_id === userId
                          ? "bg-emerald-500/30 border-emerald-400"
                          : "bg-red-500/30 border-red-400"
                      }`}>
                        <div className="text-sm font-extrabold">
                          {myCurrentMatch.winner_id === userId ? "✅ Você passou de rodada!" : "❌ Você foi eliminado"}
                        </div>
                        <div className="text-xs opacity-90">Acompanhe as outras partidas abaixo enquanto a rodada não termina.</div>
                      </div>
                    )
                  ) : (
                    <div className="rounded-xl bg-white/5 p-3 text-center text-xs opacity-90">
                      Você não está nesta copa. Assista as partidas em andamento abaixo.
                    </div>
                  )}

                  {/* List of round matches */}
                  <div className="grid sm:grid-cols-2 gap-2">
                    {currentRoundMatches.map((m) => {
                      const isMine = m.id === myCurrentMatch?.id;
                      const winnerName = m.winner_id ? pName(m.winner_id) : null;
                      return (
                        <div key={m.id} className={`rounded-xl border p-3 text-xs ${
                          isMine ? "bg-yellow-400/15 border-yellow-300/70" : "bg-white/10 border-white/20"
                        }`}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="font-bold truncate">
                              <span className={m.winner_id === m.p1_id ? "text-emerald-300" : m.status === "done" ? "opacity-50 line-through" : ""}>
                                {m.p1_id === userId ? "👤 " : ""}{pName(m.p1_id)}{pIsBot(m.p1_id) && " 🤖"}
                              </span>
                              <span className="opacity-60 mx-1">vs</span>
                              <span className={m.winner_id === m.p2_id ? "text-emerald-300" : m.status === "done" ? "opacity-50 line-through" : ""}>
                                {m.p2_id === userId ? "👤 " : ""}{pName(m.p2_id)}{pIsBot(m.p2_id) && " 🤖"}
                              </span>
                            </div>
                          </div>
                          {m.status === "done" ? (
                            <div className="flex items-center justify-between">
                              <span className="text-emerald-300 font-bold">🏆 {winnerName}</span>
                              <button
                                onClick={() => setBattleMatch({ m, mode: "watch" })}
                                className="px-2 py-1 rounded bg-white/15 hover:bg-white/25 text-[10px] font-bold"
                              >
                                👁 Assistir replay
                              </button>
                            </div>
                          ) : isMine ? (
                            <button
                              onClick={() => setBattleMatch({ m, mode: "play" })}
                              className="w-full px-2 py-1.5 rounded bg-red-500/70 hover:bg-red-500 text-[10px] font-extrabold"
                            >
                              ▶ Jogar agora
                            </button>
                          ) : (
                            <button
                              onClick={() => setBattleMatch({ m, mode: "watch" })}
                              className="w-full px-2 py-1.5 rounded bg-white/15 hover:bg-white/25 text-[10px] font-bold"
                            >
                              👁 Assistir ao vivo
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Active bracket */}
                  {myActiveBracket && (
                    <div className="overflow-x-auto mt-2">
                      <div className="flex gap-3 min-w-fit">
                        {[1, 2, 3, 4].map((r) => (
                          <div key={r} className="flex-shrink-0 w-44">
                            <div className="text-[10px] font-extrabold opacity-80 text-center mb-1">{ROUND_NAMES[r]}</div>
                            <div className="space-y-2" style={{ paddingTop: `${(Math.pow(2, r - 1) - 1) * 18}px` }}>
                              {(myActiveBracket[r] ?? []).map((m) => {
                                const w = m.winner_id;
                                const mine = userId && (m.p1_id === userId || m.p2_id === userId);
                                return (
                                  <div key={m.id} className={`rounded-lg p-1.5 text-[10px] space-y-0.5 border ${mine ? "bg-yellow-400/20 border-yellow-300/70 ring-1 ring-yellow-300/60" : "bg-white/10 border-white/20"}`} style={{ marginBottom: `${(Math.pow(2, r) - 1) * 16}px` }}>
                                    <div className={`flex justify-between gap-1 px-1 py-0.5 rounded ${w === m.p1_id ? "bg-emerald-500/30 font-extrabold" : m.status === "done" ? "opacity-50" : ""}`}>
                                      <span className="truncate">{pName(m.p1_id)}{pIsBot(m.p1_id) && " 🤖"}</span>
                                    </div>
                                    <div className={`flex justify-between gap-1 px-1 py-0.5 rounded ${w === m.p2_id ? "bg-emerald-500/30 font-extrabold" : m.status === "done" ? "opacity-50" : ""}`}>
                                      <span className="truncate">{pName(m.p2_id)}{pIsBot(m.p2_id) && " 🤖"}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </section>
          )}

          {tab === "last" && (
            <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
              {!lastT ? (
                <div className="text-center text-sm opacity-80 py-10">Nenhuma copa finalizada ainda. Volte daqui a pouco!</div>
              ) : (
                <>
                  <div className="text-center mb-3">
                    <div className="text-xs opacity-80">Copa de {new Date(lastT.slot_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</div>
                    {lastT.champion_id ? (
                      <div className="mt-1 text-xl font-extrabold">
                        🏆 Campeão: <span className="text-yellow-300">{pName(lastT.champion_id)}</span>
                        
                      </div>
                    ) : (
                      <div className="mt-1 text-sm opacity-70">Sem campeão</div>
                    )}
                  </div>

                  {lastBracket && (
                    <div className="overflow-x-auto">
                      <div className="flex gap-3 min-w-fit">
                        {[1, 2, 3, 4].map((r) => (
                          <div key={r} className="flex-shrink-0 w-44">
                            <div className="text-[10px] font-extrabold opacity-80 text-center mb-1">{ROUND_NAMES[r]}</div>
                            <div className="space-y-2" style={{ paddingTop: `${(Math.pow(2, r - 1) - 1) * 18}px` }}>
                              {(lastBracket[r] ?? []).map((m) => {
                                const w = m.winner_id;
                                const mine = userId && (m.p1_id === userId || m.p2_id === userId);
                                return (
                                  <div key={m.id} className={`rounded-lg p-1.5 text-[10px] space-y-0.5 border ${mine ? "bg-yellow-400/20 border-yellow-300/70 ring-1 ring-yellow-300/60" : "bg-white/10 border-white/20"}`} style={{ marginBottom: `${(Math.pow(2, r) - 1) * 16}px` }}>
                                    <div className={`flex justify-between gap-1 px-1 py-0.5 rounded ${w === m.p1_id ? "bg-emerald-500/30 font-extrabold" : "opacity-70"}`}>
                                      <span className="truncate">{m.p1_id === userId ? "👤 " : ""}{pName(m.p1_id)}{pIsBot(m.p1_id) && " 🤖"}</span>
                                    </div>
                                    <div className={`flex justify-between gap-1 px-1 py-0.5 rounded ${w === m.p2_id ? "bg-emerald-500/30 font-extrabold" : "opacity-70"}`}>
                                      <span className="truncate">{m.p2_id === userId ? "👤 " : ""}{pName(m.p2_id)}{pIsBot(m.p2_id) && " 🤖"}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "leaderboard" && (
            <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
              <h2 className="text-lg font-extrabold text-center mb-3">👑 Hall dos Campeões</h2>
              {champs.length === 0 ? (
                <div className="text-center text-sm opacity-80 py-8">Ninguém venceu uma copa ainda. Pode ser você!</div>
              ) : (
                <ol className="space-y-1">
                  {champs.map((c, i) => (
                    <li key={c.user_id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${i === 0 ? "bg-yellow-500/30 border border-yellow-400/60" : i === 1 ? "bg-gray-300/20" : i === 2 ? "bg-amber-700/30" : "bg-white/5"}`}>
                      <span className="w-8 text-center font-extrabold">{i + 1}º</span>
                      <span className="flex-1 truncate font-bold">{i === 0 ? "👑 " : ""}{c.username}</span>
                      <span className="text-sm font-extrabold">{c.wins} 🏆</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </main>

        {battleMatch && battleMatch.m.p1_id && battleMatch.m.p2_id && (
          <TournamentBattle
            matchId={battleMatch.m.id}
            p1Id={battleMatch.m.p1_id}
            p2Id={battleMatch.m.p2_id}
            p1Name={pName(battleMatch.m.p1_id)}
            p2Name={pName(battleMatch.m.p2_id)}
            mode={battleMatch.mode}
            existingLog={battleMatch.m.log ?? null}
            existingWinner={battleMatch.m.winner_id}
            meId={userId}
            onFinished={() => { void refresh(); }}
            onClose={() => { setBattleMatch(null); void refresh(); }}
          />
        )}

        {celebrated && (
          <ChampionCelebration
            championName={celebrated.champion_id === userId ? (profile?.username ?? "Você") : pName(celebrated.champion_id)}
            reward={celebrated.champion_reward}
            onClose={() => {
              if (typeof window !== "undefined") {
                window.localStorage.setItem(`champion_seen_${celebrated.id}`, "1");
              }
              setCelebrated(null);
              void refresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
