import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BattleScene } from "./BattleScene";
import { simulateBattle, toBattleMonster, type BattleLogEntry } from "@/lib/battle";
import type { MonsterRow } from "./MonsterCard";

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

export function TournamentBattle({
  matchId, p1Id, p2Id, p1Name, p2Name, mode, existingLog, existingWinner, meId, onFinished, onClose,
}: Props) {
  const [teamA, setTeamA] = useState<Team | null>(null);
  const [teamB, setTeamB] = useState<Team | null>(null);
  const [log, setLog] = useState<BattleLogEntry[] | null>(null);
  const [winnerSide, setWinnerSide] = useState<"team_a" | "team_b" | "draw" | null>(null);
  const [step, setStep] = useState(0);
  const reportedRef = useRef(false);

  // Determine which side is "A" (left) — meId on left when watching/playing if participating
  const meOnLeft = meId && (meId === p1Id);
  const leftOwner = meOnLeft || mode === "watch" ? p1Id : p1Id;
  const rightOwner = p2Id;

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [a, b] = await Promise.all([fetchTeam(leftOwner), fetchTeam(rightOwner)]);
      if (cancel) return;
      setTeamA(a);
      setTeamB(b);
    })();
    return () => { cancel = true; };
  }, [leftOwner, rightOwner]);

  // Compute or load log once teams are ready
  useEffect(() => {
    if (!teamA || !teamB || teamA.length < 3 || teamB.length < 3) return;
    if (log) return;
    if (existingLog && existingLog.length > 0) {
      setLog(existingLog);
      // Determine winner side from log: last alive
      if (existingWinner) {
        setWinnerSide(existingWinner === p1Id ? "team_a" : existingWinner === p2Id ? "team_b" : "draw");
      }
      return;
    }
    // simulate locally
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

  // Animate steps
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
            playerBName={p2Name}
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
