import { SPECIES, TYPE_CHART, totalStats, type Element } from "./game-data";

export type BattleMonster = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
};

export type BattleLogEntry = {
  turn: number;
  actor: "team_a" | "team_b";
  actorName: string;
  targetName: string;
  damage: number;
  crit: boolean;
  effective: number; // 1, 1.5, 0.7
  remainingHp: number;
  message: string;
};

export type BattleResult = {
  winner: "team_a" | "team_b";
  log: BattleLogEntry[];
};

export type DBMonster = {
  id: string;
  owner_id: string;
  species: string;
  name: string;
  level: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
};

export function toBattleMonster(m: DBMonster): BattleMonster {
  const stats = totalStats(m.species, m.level, { hp: m.hp - SPECIES[m.species]?.base.hp || 0, atk: 0, def: 0, spd: 0 });
  return {
    id: m.id,
    owner_id: m.owner_id,
    name: m.name,
    species: m.species,
    level: m.level,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
  };
}

function getElement(species: string): Element {
  return SPECIES[species]?.element ?? "shadow";
}

function rng(seed: number) {
  // simple deterministic-ish rng; ok for client display
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export function simulateBattle(teamA: BattleMonster[], teamB: BattleMonster[], seed = Date.now()): BattleResult {
  const log: BattleLogEntry[] = [];
  const a = teamA.map((m) => ({ ...m, current: m.hp }));
  const b = teamB.map((m) => ({ ...m, current: m.hp }));
  const rand = rng(seed);

  let turn = 1;
  let aIdx = 0;
  let bIdx = 0;
  const MAX_TURNS = 60;

  while (aIdx < a.length && bIdx < b.length && turn <= MAX_TURNS) {
    const atkA = a[aIdx];
    const atkB = b[bIdx];

    // turn order by speed
    const order: ("team_a" | "team_b")[] = atkA.spd >= atkB.spd ? ["team_a", "team_b"] : ["team_b", "team_a"];

    for (const side of order) {
      const attacker = side === "team_a" ? atkA : atkB;
      const defender = side === "team_a" ? atkB : atkA;
      if (attacker.current <= 0 || defender.current <= 0) continue;

      const eff = TYPE_CHART[getElement(attacker.species)]?.[getElement(defender.species)] ?? 1;
      const crit = rand() < 0.12;
      const base = Math.max(1, attacker.atk * 2 - defender.def);
      const variance = 0.85 + rand() * 0.3;
      const damage = Math.max(1, Math.round(base * eff * variance * (crit ? 1.7 : 1)));
      defender.current = Math.max(0, defender.current - damage);

      let msg = `${attacker.name} atacou ${defender.name} causando ${damage} de dano`;
      if (crit) msg += " (CRÍTICO!)";
      if (eff > 1) msg += " (super eficaz!)";
      else if (eff < 1) msg += " (pouco eficaz...)";

      log.push({
        turn,
        actor: side,
        actorName: attacker.name,
        targetName: defender.name,
        damage,
        crit,
        effective: eff,
        remainingHp: defender.current,
        message: msg,
      });

      if (defender.current <= 0) {
        log.push({
          turn, actor: side, actorName: attacker.name, targetName: defender.name,
          damage: 0, crit: false, effective: 1, remainingHp: 0,
          message: `💀 ${defender.name} foi derrotado!`,
        });
        if (side === "team_a") bIdx += 1;
        else aIdx += 1;
        break;
      }
    }
    turn += 1;
  }

  const winner: "team_a" | "team_b" = aIdx < a.length ? "team_a" : "team_b";
  return { winner, log };
}

export function computeRewards(playerLevel: number, won: boolean, isVip: boolean) {
  const baseCoins = won ? 50 + playerLevel * 10 : 15 + playerLevel * 3;
  const baseXp = won ? 25 + playerLevel * 5 : 8 + playerLevel * 2;
  const mult = isVip ? 1.5 : 1;
  return {
    coins: Math.round(baseCoins * mult),
    xp: Math.round(baseXp * mult),
  };
}
