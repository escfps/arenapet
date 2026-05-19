import { ARENA_WIN_POINTS, ARENA_LOSS_POINTS } from "@/lib/game-data";

export type BattleRow = {
  id: string;
  attacker_id: string;
  defender_id: string;
  winner_id: string;
  coins_reward: number;
  xp_reward: number;
  created_at: string;
  log: unknown;
  attacker_points_delta?: number | null;
  defender_points_delta?: number | null;
};

type LogEntry = {
  turn?: number;
  actor?: "team_a" | "team_b";
  actorName?: string;
  targetName?: string;
  damage?: number;
  crit?: boolean;
  message?: string;
};

type PetStat = { name: string; dmg: number; heal: number; taken: number; kills: number };

function computeStats(log: LogEntry[]) {
  const sides: Record<"team_a" | "team_b", Map<string, PetStat>> = {
    team_a: new Map(),
    team_b: new Map(),
  };
  const ensure = (side: "team_a" | "team_b", name: string) => {
    if (!sides[side].has(name)) sides[side].set(name, { name, dmg: 0, heal: 0, taken: 0, kills: 0 });
    return sides[side].get(name)!;
  };
  for (const e of log) {
    if (!e || !e.actor || !e.actorName) continue;
    const actor = ensure(e.actor, e.actorName);
    const enemySide: "team_a" | "team_b" = e.actor === "team_a" ? "team_b" : "team_a";
    const msg = e.message ?? "";
    const dmg = e.damage ?? 0;
    if (dmg === 0 && msg.startsWith("💀")) { actor.kills += 1; continue; }
    if (dmg > 0) {
      actor.dmg += dmg;
      if (e.targetName) {
        const tgtSide = e.targetName === e.actorName ? e.actor : enemySide;
        const tgt = ensure(tgtSide, e.targetName);
        tgt.taken += dmg;
      }
    } else if (dmg < 0) {
      const heal = -dmg;
      if (e.targetName === "todos os aliados") actor.heal += heal * Math.max(1, sides[e.actor].size);
      else actor.heal += heal;
    }
  }
  return sides;
}

export function BattleDetailModal({ battle, viewerId, onClose }: { battle: BattleRow; viewerId: string; onClose: () => void }) {
  const log = Array.isArray(battle.log) ? (battle.log as LogEntry[]) : [];
  const stats = computeStats(log);
  // viewerId may be the attacker, defender, or a third party (admin/spectator).
  // Default to attacker's perspective when the viewer isn't a participant.
  const isParticipant = battle.attacker_id === viewerId || battle.defender_id === viewerId;
  const playerSide: "team_a" | "team_b" = battle.defender_id === viewerId ? "team_b" : "team_a";
  const enemySide: "team_a" | "team_b" = playerSide === "team_a" ? "team_b" : "team_a";
  const refUserId = playerSide === "team_a" ? battle.attacker_id : battle.defender_id;
  const won = battle.winner_id === refUserId;
  const turns = log.reduce((m, e) => Math.max(m, e.turn ?? 0), 0);

  const player = Array.from(stats[playerSide].values());
  const enemy = Array.from(stats[enemySide].values());
  const mvp = player.reduce<PetStat | null>((best, p) => {
    const score = p.dmg + p.heal;
    if (!best || score > best.dmg + best.heal) return p;
    return best;
  }, null);
  const totalDmg = player.reduce((s, p) => s + p.dmg, 0);
  const totalHeal = player.reduce((s, p) => s + p.heal, 0);
  const totalTaken = player.reduce((s, p) => s + p.taken, 0);

  const myDelta = playerSide === "team_a"
    ? (battle.attacker_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS))
    : (battle.defender_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS));

  return (
    <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-white/20 shadow-2xl p-5 text-white animate-in zoom-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold">📊 Replay da batalha</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className={`rounded-2xl p-3 mb-3 ${won ? "bg-emerald-700/40 border-2 border-emerald-400/60" : "bg-rose-700/40 border-2 border-rose-400/60"}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-2xl font-black">{won ? "🏆 Vitória" : "💀 Derrota"} {!isParticipant && <span className="text-xs opacity-70">(do atacante)</span>}</div>
              <div className="text-xs opacity-80">{new Date(battle.created_at).toLocaleString("pt-BR")} • {turns} turno{turns !== 1 ? "s" : ""}</div>
            </div>
            <div className="text-right text-sm font-bold">
              <div className={myDelta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                {myDelta >= 0 ? `+${myDelta}` : myDelta} 🏆 pts
              </div>
              {won && (
                <>
                  <div className="text-yellow-300">+{battle.coins_reward} 🪙</div>
                  <div className="text-cyan-300">+{battle.xp_reward} XP</div>
                </>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="bg-black/40 rounded-lg py-1.5">
              <div className="text-[10px] opacity-70 font-bold">DANO TOTAL</div>
              <div className="text-lg font-extrabold text-orange-300">{totalDmg}</div>
            </div>
            <div className="bg-black/40 rounded-lg py-1.5">
              <div className="text-[10px] opacity-70 font-bold">CURA TOTAL</div>
              <div className="text-lg font-extrabold text-emerald-300">{totalHeal}</div>
            </div>
            <div className="bg-black/40 rounded-lg py-1.5">
              <div className="text-[10px] opacity-70 font-bold">DANO LEVADO</div>
              <div className="text-lg font-extrabold text-rose-300">{totalTaken}</div>
            </div>
          </div>
          {mvp && (mvp.dmg + mvp.heal) > 0 && (
            <div className="mt-3 rounded-lg bg-gradient-to-r from-yellow-500/40 to-amber-500/30 border border-yellow-400/60 p-2 text-sm">
              <span className="font-extrabold text-yellow-300">⭐ MVP:</span>{" "}
              <b>{mvp.name}</b> — {mvp.dmg} dano, {mvp.heal} cura, {mvp.kills} abate{mvp.kills === 1 ? "" : "s"}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <StatsPanel title={isParticipant ? "🟢 Seu time" : "🟢 Atacante"} stats={player} mvpName={mvp?.name ?? null} />
          <StatsPanel title={isParticipant ? "🔴 Inimigo" : "🔴 Defensor"} stats={enemy} mvpName={null} />
        </div>

        <details className="mt-4 rounded-xl bg-black/40 border border-white/10" open>
          <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-white/80 hover:text-white">📜 Replay turno a turno</summary>
          <div className="px-3 pb-3 space-y-0.5 text-xs font-mono max-h-80 overflow-y-auto">
            {log.length === 0 ? (
              <div className="text-white/50 italic">Sem detalhes salvos.</div>
            ) : (
              log.map((line, i) => (
                <div key={i} className="text-white/90">
                  {line.turn ? <span className="text-white/40">T{line.turn} </span> : null}
                  {line.message ?? JSON.stringify(line)}
                </div>
              ))
            )}
          </div>
        </details>
      </div>
    </div>
  );
}

function StatsPanel({ title, stats, mvpName }: { title: string; stats: PetStat[]; mvpName: string | null }) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/20 p-3">
      <h4 className="font-extrabold text-white text-sm mb-2">{title}</h4>
      {stats.length === 0 ? (
        <div className="text-white/50 italic text-xs">Sem dados.</div>
      ) : (
        <div className="space-y-2">
          {stats.map((s) => {
            const isMvp = s.name === mvpName;
            return (
              <div key={s.name} className={`p-2 rounded-lg bg-white/5 ${isMvp ? "ring-2 ring-yellow-400" : ""}`}>
                <div className="font-bold text-xs text-white truncate flex items-center gap-1">
                  {s.name}
                  {isMvp && <span className="text-[9px] bg-yellow-400 text-yellow-950 px-1.5 py-0.5 rounded font-extrabold">MVP ⭐</span>}
                </div>
                <div className="grid grid-cols-2 gap-x-2 text-[10px] text-white/90 mt-0.5 font-medium">
                  <span>⚔️ {s.dmg} dano</span>
                  <span>💚 {s.heal} cura</span>
                  <span>🩸 {s.taken} levou</span>
                  <span>💀 {s.kills} abate{s.kills === 1 ? "" : "s"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
