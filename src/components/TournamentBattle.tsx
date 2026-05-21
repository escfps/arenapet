import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BattleScene } from "./BattleScene";
import { simulateBattle, toBattleMonster, type BattleLogEntry } from "@/lib/battle";
import type { MonsterRow } from "./MonsterCard";
import { getTier, SPECIES, skinFilter } from "@/lib/game-data";

type Team = (MonsterRow & { owner_id: string })[];

type Props = {
  matchId: string;
  p1Id: string;
  p2Id: string;
  p1Name: string;
  p2Name: string;
  mode: "play" | "watch";
  existingLog?: BattleLogEntry[] | null;
  existingWinner?: string | null;
  meId?: string | null;
  onFinished?: (winnerId: string) => void;
  onClose?: () => void;
};

async function fetchTeam(ownerId: string): Promise<Team> {
  const { data } = await supabase
    .from("monsters")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("in_team", true)
    .order("team_position", { ascending: true })
    .limit(3);
  return ((data as Team) ?? []).slice(0, 3);
}

async function fetchArenaInfo(ownerId: string): Promise<{ points: number; rank: number }> {
  const { data } = await supabase.from("profiles").select("arena_points").eq("id", ownerId).maybeSingle();
  const points = (data?.arena_points as number) ?? 0;
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).gt("arena_points", points);
  return { points, rank: (count ?? 0) + 1 };
}

type MvpStat = { name: string; species: string; skin: string; dmg: number; heal: number; kills: number };

function computeMvps(teamA: Team, teamB: Team, log: BattleLogEntry[]) {
  const mk = (t: Team) => {
    const m = new Map<string, MvpStat>();
    for (const x of t) m.set(x.name, { name: x.name, species: x.species, skin: x.skin, dmg: 0, heal: 0, kills: 0 });
    return m;
  };
  const a = mk(teamA);
  const b = mk(teamB);
  for (const e of log) {
    const actSide = e.actor === "team_a" ? a : b;
    if (e.damage === 0 && e.message.startsWith("💀")) {
      const s = actSide.get(e.actorName); if (s) s.kills += 1; continue;
    }
    if (e.damage > 0) {
      const s = actSide.get(e.actorName); if (s) s.dmg += e.damage;
    } else if (e.damage < 0) {
      const s = actSide.get(e.actorName); if (s) s.heal += -e.damage;
    }
  }
  const pick = (m: Map<string, MvpStat>) => Array.from(m.values()).sort((x, y) => (y.dmg + y.heal) - (x.dmg + x.heal))[0];
  return { mvpA: pick(a), mvpB: pick(b) };
}

export function TournamentBattle({
  matchId, p1Id, p2Id, p1Name, p2Name, mode, existingLog, existingWinner, meId, onFinished, onClose,
}: Props) {
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [log, setLog] = useState<BattleLogEntry[] | null>(null);
  const [winnerSide, setWinnerSide] = useState<"team_a" | "team_b" | "draw" | null>(null);
  const [step, setStep] = useState(0);
  const [arenaA, setArenaA] = useState<{ points: number; rank: number } | null>(null);
  const [arenaB, setArenaB] = useState<{ points: number; rank: number } | null>(null);
  const reportedRef = useRef(false);

  const meOnLeft = meId && (meId === p1Id);
  const leftOwner = meOnLeft || mode === "watch" ? p1Id : p1Id;
  const rightOwner = p2Id;

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [a, b, ai, bi] = await Promise.all([
        fetchTeam(leftOwner),
        fetchTeam(rightOwner),
        fetchArenaInfo(leftOwner),
        fetchArenaInfo(rightOwner),
      ]);
      if (cancel) return;
      setTeamA(a);
      setTeamB(b);
      setArenaA(ai);
      setArenaB(bi);
    })();
    return () => { cancel = true; };
  }, [leftOwner, rightOwner]);

  useEffect(() => {
    if (!teamA || !teamB || teamA.length < 3 || teamB.length < 3) return;
    if (log) return;
    if (existingLog && existingLog.length > 0) {
      setLog(existingLog);
      if (existingWinner) {
        setWinnerSide(existingWinner === p1Id ? "team_a" : existingWinner === p2Id ? "team_b" : "draw");
      }
      return;
    }
    const seed = matchId.split("").reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7) >>> 0;
    const result = simulateBattle(teamA.map(toBattleMonster), teamB.map(toBattleMonster), seed);
    setLog(result.log);
    setWinnerSide(result.winner);

    if (mode === "play" && !reportedRef.current && result.winner !== "draw") {
      reportedRef.current = true;
      const winnerId = result.winner === "team_a" ? p1Id : p2Id;
      (async () => {
        const { error } = await supabase.rpc("report_match_result", {
          p_match_id: matchId,
          p_winner_id: winnerId,
          p_log: result.log as unknown as never,
        });
        if (!error) onFinished?.(winnerId);
      })();
    }
  }, [teamA, teamB, existingLog, existingWinner, log, matchId, mode, p1Id, p2Id, onFinished]);

  useEffect(() => {
    if (!log) return;
    setStep(0);
    if (log.length === 0) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setStep(i);
      if (i >= log.length) clearInterval(id);
    }, 900);
    return () => clearInterval(id);
  }, [log]);

  const done = log && step >= log.length;

  if (!teamA || !teamB) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 text-white">
        Carregando times…
      </div>
    );
  }
  if (teamA.length < 3 || teamB.length < 3) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 text-white text-center p-4">
        <div>
          <p>Um dos jogadores não tem 3 pets no time. A partida será decidida automaticamente.</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 rounded bg-white/20">Fechar</button>
        </div>
      </div>
    );
  }

  const mvps = done && log ? computeMvps(teamA, teamB, log) : null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-4xl mx-auto p-3 sm:p-5">
        <div className="flex items-center justify-between text-white mb-3">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg bg-white/15 text-xs font-bold hover:bg-white/25">← Voltar</button>
          <div className="text-xs font-bold opacity-90">{mode === "play" ? "⚔️ Sua partida" : "👁 Assistindo"}</div>
        </div>
        <div className="relative">
          <BattleScene
            teamA={teamA}
            teamB={teamB}
            log={log ?? []}
            step={step}
            playerAName={p1Name}
            playerATier={arenaA ? getTier(arenaA.points).short : undefined}
            playerARank={arenaA?.rank}
            playerBName={p2Name}
            playerBTier={arenaB ? getTier(arenaB.points).short : undefined}
            playerBRank={arenaB?.rank}
          />
          {done && winnerSide && (
            <div className="absolute inset-0 flex items-center justify-center z-30 animate-fade-in">
              <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
              <div className={`relative px-7 py-5 rounded-3xl border-4 shadow-2xl text-center animate-scale-in ${
                winnerSide === "team_a"
                  ? "bg-gradient-to-br from-yellow-400 to-amber-600 border-yellow-200 text-yellow-950"
                  : winnerSide === "team_b"
                  ? "bg-gradient-to-br from-rose-600 to-red-900 border-rose-300 text-white"
                  : "bg-gradient-to-br from-slate-300 to-slate-500 border-white text-slate-900"
              }`}>
                <div className="text-5xl mb-1">{winnerSide === "draw" ? "🤝" : "🏆"}</div>
                <div className="text-3xl font-black tracking-wider">
                  {winnerSide === "draw" ? "EMPATE" : (winnerSide === "team_a" ? p1Name : p2Name).toUpperCase()}
                </div>
                <div className="text-xs mt-1 opacity-90">venceu a partida</div>
                {mvps && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md mx-auto">
                    {([{ s: mvps.mvpA, label: p1Name, accent: "border-blue-300/60" }, { s: mvps.mvpB, label: p2Name, accent: "border-red-300/60" }] as const).map((c, i) => {
                      if (!c.s) return null;
                      const sp = SPECIES[c.s.species];
                      return (
                        <div key={i} className={`flex items-center gap-2 p-2 rounded-lg bg-black/60 border ${c.accent} min-w-0`}>
                          {sp && <img src={sp.image} alt="" className="h-9 w-9 object-contain shrink-0" style={{ filter: skinFilter(c.s.skin) }} />}
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-[10px] font-extrabold text-yellow-300 leading-none">⭐ MVP • {c.label}</div>
                            <div className="text-xs font-bold text-white truncate">{c.s.name}</div>
                            <div className="text-[10px] text-white/90 font-medium leading-tight">
                              ⚔️ {Math.round(c.s.dmg)} • 💚 {Math.round(c.s.heal)} • 💀 {Math.round(c.s.kills)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <button onClick={onClose} className="mt-4 px-5 py-2 rounded-xl bg-black/70 text-white font-extrabold text-sm border-2 border-white/40 hover:scale-105 transition">
                  Voltar pra Copa
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
