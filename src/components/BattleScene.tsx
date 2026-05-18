import { useEffect, useMemo, useState } from "react";
import type { BattleLogEntry } from "@/lib/battle";
import { SPECIES, ELEMENT_COLORS, skinFilter, totalStats } from "@/lib/game-data";
import type { MonsterRow } from "./MonsterCard";

type Team = (MonsterRow & { owner_id: string })[];
type HpMap = Map<string, { cur: number; max: number }>;
type Fx = { actor: string | null; target: string | null; dmg: number | null; crit: boolean };

export function BattleScene({
  teamA,
  teamB,
  log,
  step,
}: {
  teamA: Team;
  teamB: Team;
  log: BattleLogEntry[];
  step: number;
}) {
  const initialHp = useMemo<HpMap>(() => {
    const map: HpMap = new Map();
    for (const m of teamA) {
      const max = totalStats(m.species, m.rank ?? 1).hp;
      map.set(`a:${m.name}`, { cur: max, max });
    }
    for (const m of teamB) {
      const max = totalStats(m.species, m.rank ?? 1).hp;
      map.set(`b:${m.name}`, { cur: max, max });
    }
    return map;
  }, [teamA, teamB]);

  const [hp, setHp] = useState<HpMap>(initialHp);
  const [fx, setFx] = useState<Fx>({ actor: null, target: null, dmg: null, crit: false });

  useEffect(() => {
    setHp(new Map(initialHp));
    setFx({ actor: null, target: null, dmg: null, crit: false });
  }, [initialHp]);

  useEffect(() => {
    if (step <= 0 || step > log.length) return;
    const entry = log[step - 1];
    const actorSide: "a" | "b" = entry.actor === "team_a" ? "a" : "b";
    const actorKey = `a:${entry.actorName}`.replace(/^a:/, `${actorSide}:`);

    // Determine target side
    const isSelfOrAlly = entry.damage < 0 || entry.targetName === entry.actorName;
    const targetSide: "a" | "b" = isSelfOrAlly ? actorSide : actorSide === "a" ? "b" : "a";
    const targetKey =
      entry.targetName === "todos os aliados" ? null : `${targetSide}:${entry.targetName}`;

    setHp((prev) => {
      const next = new Map(prev);
      if (entry.targetName === "todos os aliados") {
        const allies = actorSide === "a" ? teamA : teamB;
        const healAmt = -entry.damage;
        for (const m of allies) {
          const k = `${actorSide}:${m.name}`;
          const cur = next.get(k);
          if (cur && cur.cur > 0) next.set(k, { ...cur, cur: Math.min(cur.max, cur.cur + healAmt) });
        }
      } else if (targetKey) {
        const cur = next.get(targetKey);
        if (cur) {
          if (entry.damage > 0) {
            next.set(targetKey, { ...cur, cur: Math.max(0, entry.remainingHp) });
          } else if (entry.damage < 0) {
            next.set(targetKey, { ...cur, cur: Math.min(cur.max, cur.cur + -entry.damage) });
          }
        }
      }
      return next;
    });

    setFx({ actor: actorKey, target: targetKey, dmg: entry.damage, crit: entry.crit });
    const t = setTimeout(
      () => setFx({ actor: null, target: null, dmg: null, crit: false }),
      650
    );
    return () => clearTimeout(t);
  }, [step, log, teamA, teamB]);

  return (
    <div className="rounded-2xl bg-gradient-to-b from-slate-900/70 to-indigo-950/70 backdrop-blur-md border border-white/20 p-4">
      <div className="grid grid-cols-2 gap-3">
        <SideColumn team={teamA} side="a" hp={hp} fx={fx} />
        <SideColumn team={teamB} side="b" hp={hp} fx={fx} mirrored />
      </div>
    </div>
  );
}

function SideColumn({
  team,
  side,
  hp,
  fx,
  mirrored,
}: {
  team: Team;
  side: "a" | "b";
  hp: HpMap;
  fx: Fx;
  mirrored?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 ${mirrored ? "items-end" : "items-start"}`}>
      {team.map((m) => {
        const sp = SPECIES[m.species];
        if (!sp) return null;
        const key = `${side}:${m.name}`;
        const h = hp.get(key) ?? { cur: 0, max: 1 };
        const pct = Math.max(0, Math.min(100, (h.cur / h.max) * 100));
        const dead = h.cur <= 0;
        const isActor = fx.actor === key && !dead;
        const isTarget = fx.target === key;
        const lunge = isActor ? (mirrored ? "-translate-x-3" : "translate-x-3") : "";
        const hpColor =
          pct > 50
            ? "from-green-400 to-emerald-500"
            : pct > 25
            ? "from-yellow-400 to-orange-500"
            : "from-red-500 to-rose-600";
        return (
          <div
            key={m.id}
            className={`relative w-full max-w-[200px] transition-all duration-200 ${
              dead ? "opacity-30 grayscale" : ""
            } ${lunge} ${isTarget ? "animate-battle-shake" : ""}`}
          >
            <div
              className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${
                ELEMENT_COLORS[sp.element]
              } ${isTarget ? "ring-4 ring-red-400" : ""} ${
                isActor ? "ring-4 ring-yellow-300" : ""
              } transition-all`}
            >
              <img
                src={sp.image}
                alt=""
                className="h-12 w-12 object-contain drop-shadow-lg"
                style={{ filter: skinFilter(m.skin) }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-white truncate">{m.name}</div>
                <div className="h-2 rounded-full bg-black/40 overflow-hidden mt-1">
                  <div
                    className={`h-full bg-gradient-to-r ${hpColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-white/90 font-bold">
                  {Math.round(h.cur)}/{h.max}
                </div>
              </div>
            </div>
            {isTarget && fx.dmg !== null && fx.dmg !== 0 && (
              <div
                key={`${fx.actor}-${fx.target}-${fx.dmg}`}
                className={`absolute -top-1 ${
                  mirrored ? "left-2" : "right-2"
                } font-extrabold text-xl pointer-events-none animate-battle-float ${
                  fx.dmg < 0
                    ? "text-green-300"
                    : fx.crit
                    ? "text-yellow-300"
                    : "text-red-300"
                }`}
                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
              >
                {fx.dmg < 0 ? `+${-fx.dmg}` : `-${fx.dmg}`}
                {fx.crit ? "!" : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
