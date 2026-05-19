import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { ARENA_WIN_POINTS, ARENA_LOSS_POINTS } from "@/lib/game-data";
import { BattleDetailModal, type BattleRow } from "@/components/BattleDetailModal";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Histórico de Batalhas — ARENA PET" },
      { name: "description", content: "Veja suas batalhas recentes na arena." },
    ],
  }),
});

type OpponentMap = Record<string, { username: string; level: number }>;

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function HistoryPage() {
  const { userId, profile, loading } = useProfile();
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [opponents, setOpponents] = useState<OpponentMap>({});
  const [filter, setFilter] = useState<"all" | "wins" | "losses">("all");
  const [openLog, setOpenLog] = useState<BattleRow | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("battles")
        .select("*")
        .or(`attacker_id.eq.${userId},defender_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = (data ?? []) as BattleRow[];
      setBattles(rows);
      const ids = new Set<string>();
      rows.forEach((b) => {
        ids.add(b.attacker_id);
        ids.add(b.defender_id);
      });
      ids.delete(userId);
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,level")
          .in("id", Array.from(ids));
        const map: OpponentMap = {};
        (profs ?? []).forEach((p) => { map[p.id] = { username: p.username, level: p.level }; });
        setOpponents(map);
      }
    })();
  }, [userId]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white text-xl">📜 Carregando histórico...</div>;
  }

  const filtered = battles.filter((b) => {
    if (filter === "all") return true;
    const won = b.winner_id === userId;
    return filter === "wins" ? won : !won;
  });

  const wins = battles.filter((b) => b.winner_id === userId).length;
  const losses = battles.length - wins;

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(30,10,60,0.7),rgba(30,10,60,0.9)),url(${arenaBg})` }}
    >
      <HUD profile={profile} />

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-4">
        <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">📜 Histórico de Batalhas</h1>
          <p className="text-sm opacity-80 mt-1">Suas últimas {battles.length} batalhas • <b className="text-emerald-300">{wins}V</b> / <b className="text-rose-300">{losses}D</b></p>
          <div className="flex gap-2 mt-3">
            {(["all", "wins", "losses"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition ${
                  filter === f ? "bg-yellow-400 text-yellow-950" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {f === "all" ? "Todas" : f === "wins" ? "🏆 Vitórias" : "💀 Derrotas"}
              </button>
            ))}
          </div>
        </section>

        {filtered.length === 0 ? (
          <div className="text-center text-white/70 py-12">
            <div className="text-5xl mb-2">⚔️</div>
            <p className="font-bold">Nenhuma batalha ainda.</p>
            <Link to="/arena" className="inline-block mt-3 px-5 py-2 rounded-xl bg-gradient-to-b from-red-400 to-red-600 text-white font-extrabold shadow-lg hover:scale-105 transition">
              Ir pra Arena
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => {
              const won = b.winner_id === userId;
              const oppId = b.attacker_id === userId ? b.defender_id : b.attacker_id;
              const opp = opponents[oppId];
              const role = b.attacker_id === userId ? "Atacou" : "Defendeu";
              // Pega o delta de pontos certo pro lado em que você jogou.
              // Para batalhas antigas (sem coluna), cai no fallback dos constants.
              const myDelta = b.attacker_id === userId
                ? (b.attacker_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS))
                : (b.defender_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS));
              const deltaStr = myDelta >= 0 ? `+${myDelta}` : `${myDelta}`;
              return (
                <button
                  key={b.id}
                  onClick={() => setOpenLog(b)}
                  className={`w-full text-left rounded-2xl border-2 p-3 transition hover:scale-[1.01] flex items-center gap-3 ${
                    won
                      ? "border-emerald-400/60 bg-gradient-to-r from-emerald-900/60 to-emerald-700/30"
                      : "border-rose-400/60 bg-gradient-to-r from-rose-900/60 to-rose-700/30"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black shadow-lg ${
                    won ? "bg-emerald-400 text-emerald-950" : "bg-rose-400 text-rose-950"
                  }`}>
                    {won ? "🏆" : "💀"}
                  </div>
                  <div className="flex-1 min-w-0 text-white">
                    <div className="font-extrabold truncate">
                      {won ? "Vitória" : "Derrota"} vs {opp?.username ?? "Treinador"} <span className="text-xs opacity-70">Lv {opp?.level ?? "?"}</span>
                    </div>
                    <div className="text-[11px] opacity-80">{role} • {timeAgo(b.created_at)}</div>
                  </div>
                  <div className="text-right text-xs font-bold text-white">
                    <div className={myDelta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                      {deltaStr} 🏆
                    </div>
                    {won ? (
                      <>
                        <div className="text-yellow-300">+{b.coins_reward} 🪙</div>
                        <div className="text-cyan-300">+{b.xp_reward} XP</div>
                      </>
                    ) : (
                      <div className="text-white/50">—</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {openLog && (
        <BattleDetailModal battle={openLog} userId={userId!} onClose={() => setOpenLog(null)} />
      )}
    </main>
  );
}

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
    if (!sides[side].has(name)) {
      sides[side].set(name, { name, dmg: 0, heal: 0, taken: 0, kills: 0 });
    }
    return sides[side].get(name)!;
  };
  for (const e of log) {
    if (!e || !e.actor || !e.actorName) continue;
    const actor = ensure(e.actor, e.actorName);
    const enemySide: "team_a" | "team_b" = e.actor === "team_a" ? "team_b" : "team_a";
    const msg = e.message ?? "";
    const dmg = e.damage ?? 0;

    if (dmg === 0 && msg.startsWith("💀")) {
      actor.kills += 1;
      continue;
    }
    if (dmg > 0) {
      actor.dmg += dmg;
      if (e.targetName) {
        // self-damage like burns should count as taken on actor's own side
        const tgtSide = e.targetName === e.actorName ? e.actor : enemySide;
        const tgt = ensure(tgtSide, e.targetName);
        tgt.taken += dmg;
      }
    } else if (dmg < 0) {
      const heal = -dmg;
      if (e.targetName === "todos os aliados") {
        actor.heal += heal * Math.max(1, sides[e.actor].size);
      } else {
        actor.heal += heal;
      }
    }
  }
  return sides;
}

function BattleDetailModal({ battle, userId, onClose }: { battle: BattleRow; userId: string; onClose: () => void }) {
  const log = Array.isArray(battle.log) ? (battle.log as LogEntry[]) : [];
  const stats = computeStats(log);
  const playerSide: "team_a" | "team_b" = battle.attacker_id === userId ? "team_a" : "team_b";
  const enemySide: "team_a" | "team_b" = playerSide === "team_a" ? "team_b" : "team_a";
  const won = battle.winner_id === userId;
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={onClose}>
      <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-white/20 shadow-2xl p-5 text-white animate-in zoom-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-extrabold">📊 Estatísticas da batalha</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className={`rounded-2xl p-3 mb-3 ${won ? "bg-emerald-700/40 border-2 border-emerald-400/60" : "bg-rose-700/40 border-2 border-rose-400/60"}`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-2xl font-black">{won ? "🏆 Vitória" : "💀 Derrota"}</div>
              <div className="text-xs opacity-80">{new Date(battle.created_at).toLocaleString("pt-BR")} • {turns} turno{turns !== 1 ? "s" : ""}</div>
            </div>
            <div className="text-right text-sm font-bold">
              {(() => {
                const myDelta = battle.attacker_id === userId
                  ? (battle.attacker_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS))
                  : (battle.defender_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS));
                const s = myDelta >= 0 ? `+${myDelta}` : `${myDelta}`;
                return (
                  <div className={myDelta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {s} 🏆 pts
                  </div>
                );
              })()}
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
          <StatsPanel title="🟢 Seu time" stats={player} mvpName={mvp?.name ?? null} />
          <StatsPanel title="🔴 Inimigo" stats={enemy} mvpName={null} />
        </div>

        <details className="mt-4 rounded-xl bg-black/40 border border-white/10">
          <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-white/80 hover:text-white">📜 Ver log completo da batalha</summary>
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

