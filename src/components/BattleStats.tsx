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
    const mk = (team: Team, side: "a" | "b"): Map<string, Stat> => {
      const m = new Map<string, Stat>();
      for (const mon of team) {
        m.set(`${side}:${mon.name}`, {
          name: mon.name,
          species: mon.species,
          skin: mon.skin,
          dmg: 0,
          heal: 0,
          taken: 0,
          kills: 0,
        });
      }
      return m;
    };
    const a = mk(teamA, "a");
    const b = mk(teamB, "b");

    for (const e of log) {
      const actorSide: "a" | "b" = e.actor === "team_a" ? "a" : "b";
      const actorMap = actorSide === "a" ? a : b;
      const actor = actorMap.get(`${actorSide}:${e.actorName}`);
      if (!actor) continue;

      // Kill messages have damage:0 and message starts with 💀
      if (e.damage === 0 && e.message.startsWith("💀")) {
        actor.kills += 1;
        continue;
      }

      if (e.damage > 0) {
        actor.dmg += e.damage;
        const enemySide: "a" | "b" = actorSide === "a" ? "b" : "a";
        const enemyMap = enemySide === "a" ? a : b;
        const target = enemyMap.get(`${enemySide}:${e.targetName}`);
        if (target) target.taken += e.damage;
      } else if (e.damage < 0) {
        const heal = -e.damage;
        if (e.targetName === "todos os aliados") {
          const allies = actorSide === "a" ? teamA : teamB;
          actor.heal += heal * allies.length;
        } else {
          actor.heal += heal;
        }
      }
    }

    // MVP = highest (dmg + heal) on team A (player side)
    let mvpKey: string | null = null;
    let mvpScore = -1;
    for (const [k, s] of a) {
      const score = s.dmg + s.heal;
      if (score > mvpScore) {
        mvpScore = score;
        mvpKey = k;
      }
    }

    return { a, b, mvpKey };
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
