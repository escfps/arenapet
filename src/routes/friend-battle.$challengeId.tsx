import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HUD } from "@/components/HUD";
import { BattleScene } from "@/components/BattleScene";
import { SynergyBadges } from "@/components/SynergyBadges";
import { useProfile } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { simulateBattle, toBattleMonster, type DBMonster, type BattleLogEntry } from "@/lib/battle";
import { getTier } from "@/lib/game-data";
import { getChallenge, saveChallengeResult } from "@/lib/friends.functions";

export const Route = createFileRoute("/friend-battle/$challengeId")({
  component: FriendBattlePage,
});

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

type Loaded = {
  challengerId: string;
  targetId: string;
  challengerName: string;
  targetName: string;
  challengerPoints: number;
  targetPoints: number;
  rawA: DBMonster[];
  rawB: DBMonster[];
  log: BattleLogEntry[];
  winnerId: string;
};

function FriendBattlePage() {
  const { challengeId } = Route.useParams();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const getChal = useServerFn(getChallenge);
  const saveResult = useServerFn(saveChallengeResult);

  const [status, setStatus] = useState<string>("Preparando batalha…");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [shownLog, setShownLog] = useState<BattleLogEntry[]>([]);
  const [battleTimer, setBattleTimer] = useState(120);
  const playbackStoppedRef = useRef(false);
  const battleFinished = !!loaded && (shownLog.length >= loaded.log.length || (battleTimer <= 0 && playbackStoppedRef.current));

  // Load challenge + teams + (simulate or fetch) log
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    (async () => {
      try {
        const c = await getChal({ data: { challengeId } });
        const [{ data: ta }, { data: tb }, { data: pa }, { data: pb }] = await Promise.all([
          supabase.from("monsters").select("*").eq("owner_id", c.challenger_id).eq("in_team", true).order("team_position"),
          supabase.from("monsters").select("*").eq("owner_id", c.target_id).eq("in_team", true).order("team_position"),
          supabase.from("profiles").select("username, arena_points").eq("id", c.challenger_id).single(),
          supabase.from("profiles").select("username, arena_points").eq("id", c.target_id).single(),
        ]);
        if (cancelled) return;
        if (!ta?.length || !tb?.length) {
          setStatus("Um dos jogadores não tem time montado.");
          return;
        }
        const teamA = (ta as DBMonster[]).map(toBattleMonster);
        const teamB = (tb as DBMonster[]).map(toBattleMonster);

        let log: BattleLogEntry[];
        let winnerId: string;
        if (c.winner_id && c.battle_log) {
          log = c.battle_log as BattleLogEntry[];
          winnerId = c.winner_id;
        } else {
          const seed = hashSeed(challengeId);
          const r = simulateBattle(teamA, teamB, seed);
          log = r.log;
          winnerId = r.winner === "team_b" ? c.target_id : c.challenger_id;
          // persist so the other side sees the same result
          saveResult({ data: { challengeId, winnerId, log } }).catch(() => {});
        }

        setLoaded({
          challengerId: c.challenger_id,
          targetId: c.target_id,
          challengerName: pa?.username ?? "Desafiante",
          targetName: pb?.username ?? "Alvo",
          challengerPoints: pa?.arena_points ?? 0,
          targetPoints: pb?.arena_points ?? 0,
          rawA: ta as DBMonster[],
          rawB: tb as DBMonster[],
          log,
          winnerId,
        });
      } catch (e) {
        if (!cancelled) setStatus((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, challengeId]);

  // Animated log playback (same rhythm as arena)
  useEffect(() => {
    if (!loaded) return;
    playbackStoppedRef.current = false;
    setShownLog([]);
    let i = 0;
    let cancelled = false;
    let timeoutId: number | undefined;
    function delayFor(entry: BattleLogEntry | undefined): number {
      if (!entry) return 2400;
      const m = entry.message ?? "";
      if (m.includes("EXECUÇÃO") || m.includes("VERDADEIRO") || m.includes("ressuscitado")) return 3400;
      if (entry.crit) return 2800;
      if (m.includes("escudo") || m.includes("queimando") || m.includes("silenciou") || m.includes("fúria")) return 2700;
      if (m.includes("salto") || m.includes("Curou todos") || m.includes("golpe ")) return 2600;
      if (m.includes("sofreu") && m.includes("queimadura")) return 1500;
      return 2400;
    }
    function tick() {
      if (cancelled || playbackStoppedRef.current) return;
      i += 1;
      setShownLog(loaded!.log.slice(0, i));
      if (i >= loaded!.log.length) return;
      const prev = loaded!.log[i - 1];
      const next = loaded!.log[i];
      const turnChange = prev && next && prev.turn !== next.turn ? 1200 : 0;
      timeoutId = window.setTimeout(tick, delayFor(next) + turnChange);
    }
    const initial = window.setTimeout(tick, delayFor(loaded.log[0]));
    return () => { cancelled = true; clearTimeout(initial); if (timeoutId) clearTimeout(timeoutId); };
  }, [loaded]);

  // Countdown
  useEffect(() => {
    if (!loaded) { setBattleTimer(120); return; }
    if (battleFinished) return;
    const id = setInterval(() => {
      setBattleTimer((t) => {
        if (t <= 1) { playbackStoppedRef.current = true; clearInterval(id); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [loaded, battleFinished]);

  const done = battleFinished;
  const iAmChallenger = !!loaded && profile?.id === loaded.challengerId;
  const iWon = !!loaded && loaded.winnerId === profile?.id;

  // Labels: render with challenger as team_a (matches log perspective)
  const aName = useMemo(() => loaded ? (iAmChallenger ? `${loaded.challengerName} (você)` : loaded.challengerName) : "", [loaded, iAmChallenger]);
  const bName = useMemo(() => loaded ? (!iAmChallenger ? `${loaded.targetName} (você)` : loaded.targetName) : "", [loaded, iAmChallenger]);

  if (!profile) return null;

  return (
    <div className="min-h-screen pb-20">
      <HUD profile={profile} />
      <div className="max-w-3xl mx-auto p-3 md:p-4">
        <Link to="/friends" className="text-white/70 text-sm">← Amigos</Link>
        <h1 className="text-2xl font-extrabold text-white my-3">⚔️ Batalha de Amigos</h1>

        {!loaded && <div className="text-white/80">{status}</div>}

        {loaded && (
          <div className="relative">
            <div className="flex justify-center mb-2">
              <div className="px-4 py-1.5 rounded-full bg-black/70 backdrop-blur border border-white/30 text-white font-mono font-bold text-lg shadow-lg">
                ⏱️ {Math.floor(battleTimer / 60)}:{String(battleTimer % 60).padStart(2, "0")}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-white">
              <div className="rounded-xl bg-blue-500/15 border border-blue-300/30 p-2">
                <SynergyBadges
                  title={`🟦 ${aName}`}
                  onlyActive
                  compact
                  speciesIds={loaded.rawA.map((m) => m.species)}
                />
              </div>
              <div className="rounded-xl bg-red-500/15 border border-red-300/30 p-2">
                <SynergyBadges
                  title={`🟥 ${bName}`}
                  onlyActive
                  compact
                  speciesIds={loaded.rawB.map((m) => m.species)}
                />
              </div>
            </div>

            <BattleScene
              teamA={loaded.rawA as any}
              teamB={loaded.rawB as any}
              log={loaded.log}
              step={shownLog.length}
              playerAName={loaded.challengerName}
              playerATier={getTier(loaded.challengerPoints).short}
              playerBName={loaded.targetName}
              playerBTier={getTier(loaded.targetPoints).short}
            />

            {done && (
              <div className="absolute inset-0 z-30 flex items-start sm:items-center justify-center animate-fade-in overflow-y-auto py-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                <div
                  className={`relative px-6 py-6 rounded-3xl border-4 shadow-2xl text-center animate-scale-in max-w-md w-[92%] ${
                    iWon
                      ? "bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-200 text-yellow-950"
                      : "bg-gradient-to-br from-red-600 to-rose-900 border-red-300 text-white"
                  }`}
                  style={{ textShadow: "0 2px 6px rgba(0,0,0,0.4)" }}
                >
                  <div className="text-6xl mb-1">{iWon ? "🏆" : "💀"}</div>
                  <div className="text-4xl font-black tracking-widest">
                    {iWon ? "VITÓRIA!" : "DERROTA"}
                  </div>
                  <div className="text-sm mt-2 font-bold opacity-90">
                    Batalha amistosa contra {iAmChallenger ? loaded.targetName : loaded.challengerName}
                  </div>
                  <button
                    onClick={() => navigate({ to: "/friends" })}
                    className="mt-4 px-5 py-2 rounded-xl bg-black/40 hover:bg-black/60 text-white font-extrabold border border-white/30"
                  >
                    Voltar pros amigos
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
