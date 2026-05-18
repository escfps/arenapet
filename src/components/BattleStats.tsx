import { useMemo } from "react";
import type { BattleLogEntry } from "@/lib/battle";
import { SPECIES, skinFilter } from "@/lib/game-data";
import type { MonsterRow } from "./MonsterCard";

type Team = (MonsterRow & { owner_id: string })[];
type Stat = { name: string; species: string; skin: string; dmg: number; heal: number; taken: number; kills: number };

export function BattleStats({
  teamA,
  teamB,
  log,
}: {
  teamA: Team;
  teamB: Team;
  log: BattleLogEntry[];
}) {
  const { a, b, mvpKey } = useMemo(() => {
    // Stats per (side, id). Names may collide between teammates, so we share
    // aggregated stats across same-named teammates on the same side.
    const mk = (team: Team, side: "a" | "b") => {
      const byId = new Map<string, Stat>();
      const byName = new Map<string, Stat[]>();
      for (const mon of team) {
        const stat: Stat = {
          name: mon.name,
          species: mon.species,
          skin: mon.skin,
          dmg: 0,
          heal: 0,
          taken: 0,
          kills: 0,
        };
        byId.set(`${side}:${mon.id}`, stat);
        const arr = byName.get(mon.name) ?? [];
        arr.push(stat);
        byName.set(mon.name, arr);
      }
      return { byId, byName };
    };
    const a = mk(teamA, "a");
    const b = mk(teamB, "b");

    const addToName = (
      side: "a" | "b",
      name: string,
      apply: (s: Stat) => void,
    ) => {
      const map = side === "a" ? a.byName : b.byName;
      const arr = map.get(name);
      if (!arr || arr.length === 0) return;
      // If duplicate names, split contribution evenly so totals stay correct.
      const share = 1 / arr.length;
      for (const s of arr) {
        const before = { dmg: s.dmg, heal: s.heal, taken: s.taken, kills: s.kills };
        apply(s);
        s.dmg = before.dmg + (s.dmg - before.dmg) * share;
        s.heal = before.heal + (s.heal - before.heal) * share;
        s.taken = before.taken + (s.taken - before.taken) * share;
        s.kills = before.kills + (s.kills - before.kills) * share;
      }
    };

    for (const e of log) {
      const actorSide: "a" | "b" = e.actor === "team_a" ? "a" : "b";
      const enemySide: "a" | "b" = actorSide === "a" ? "b" : "a";

      if (e.damage === 0 && e.message.startsWith("💀")) {
        addToName(actorSide, e.actorName, (s) => { s.kills += 1; });
        continue;
      }

      if (e.damage > 0) {
        addToName(actorSide, e.actorName, (s) => { s.dmg += e.damage; });
        addToName(enemySide, e.targetName, (s) => { s.taken += e.damage; });
      } else if (e.damage < 0) {
        const heal = -e.damage;
        if (e.targetName === "todos os aliados") {
          const allies = actorSide === "a" ? teamA : teamB;
          addToName(actorSide, e.actorName, (s) => { s.heal += heal * allies.length; });
        } else {
          addToName(actorSide, e.actorName, (s) => { s.heal += heal; });
        }
      }
    }

    // Round shares
    for (const s of a.byId.values()) {
      s.dmg = Math.round(s.dmg); s.heal = Math.round(s.heal);
      s.taken = Math.round(s.taken); s.kills = Math.round(s.kills);
    }
    for (const s of b.byId.values()) {
      s.dmg = Math.round(s.dmg); s.heal = Math.round(s.heal);
      s.taken = Math.round(s.taken); s.kills = Math.round(s.kills);
    }

    let mvpKey: string | null = null;
    let mvpScore = -1;
    for (const [k, s] of a.byId) {
      const score = s.dmg + s.heal;
      if (score > mvpScore) { mvpScore = score; mvpKey = k; }
    }

    return { a: a.byId, b: b.byId, mvpKey };
  }, [teamA, teamB, log]);

  return (
    <div className="mt-3 grid md:grid-cols-2 gap-3 text-left">
      <SidePanel title="Seu time" stats={a} mvpKey={mvpKey} />
      <SidePanel title="Inimigo" stats={b} mvpKey={null} />
    </div>
  );
}

function SidePanel({
  title,
  stats,
  mvpKey,
}: {
  title: string;
  stats: Map<string, Stat>;
  mvpKey: string | null;
}) {
  return (
    <div className="rounded-xl bg-black/40 border border-white/20 p-3">
      <h4 className="font-extrabold text-white text-sm mb-2">{title}</h4>
      <div className="space-y-2">
        {Array.from(stats.entries()).map(([key, s]) => {
          const sp = SPECIES[s.species];
          const isMvp = key === mvpKey;
          return (
            <div
              key={key}
              className={`flex items-center gap-2 p-2 rounded-lg bg-white/5 ${
                isMvp ? "ring-2 ring-yellow-400" : ""
              }`}
            >
              {sp && (
                <img
                  src={sp.image}
                  alt=""
                  className="h-10 w-10 object-contain drop-shadow"
                  style={{ filter: skinFilter(s.skin) }}
                />
              )}
              <div className="flex-1 min-w-0">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
