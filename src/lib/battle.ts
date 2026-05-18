import { SPECIES, TYPE_CHART, totalStats, type Element, type Role } from "./game-data";

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
  role: Role;
};

export type BattleLogEntry = {
  turn: number;
  actor: "team_a" | "team_b";
  actorName: string;
  targetName: string;
  damage: number;
  crit: boolean;
  effective: number;
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
  const sp = SPECIES[m.species];
  const stats = totalStats(m.species, m.level);
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
    role: sp?.role ?? "dps",
  };
}

function getElement(species: string): Element {
  return SPECIES[species]?.element ?? "shadow";
}

function rng(seed: number) {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

type Live = BattleMonster & { current: number; maxHp: number; healCd: number };

function pickTarget(attacker: Live, enemies: Live[]): Live | null {
  const alive = enemies.filter((e) => e.current > 0);
  if (alive.length === 0) return null;
  // Taunt: prefer tank if alive
  const tank = alive.find((e) => e.role === "tank");
  if (tank && attacker.role !== "assassin") return tank;
  // Assassin: lowest current HP
  if (attacker.role === "assassin") {
    return alive.reduce((a, b) => (a.current < b.current ? a : b));
  }
  // default: first alive
  return alive[0];
}

export function simulateBattle(teamA: BattleMonster[], teamB: BattleMonster[], seed = Date.now()): BattleResult {
  const log: BattleLogEntry[] = [];
  const a: Live[] = teamA.map((m) => ({ ...m, current: m.hp, maxHp: m.hp, healCd: 0 }));
  const b: Live[] = teamB.map((m) => ({ ...m, current: m.hp, maxHp: m.hp, healCd: 0 }));
  const rand = rng(seed);

  let turn = 1;
  const MAX_TURNS = 30;

  while (a.some((m) => m.current > 0) && b.some((m) => m.current > 0) && turn <= MAX_TURNS) {
    type Actor = { mon: Live; side: "team_a" | "team_b" };
    const order: Actor[] = [
      ...a.map((mon) => ({ mon, side: "team_a" as const })),
      ...b.map((mon) => ({ mon, side: "team_b" as const })),
    ]
      .filter((x) => x.mon.current > 0)
      .sort((x, y) => y.mon.spd - x.mon.spd);

    for (const { mon: attacker, side } of order) {
      if (attacker.current <= 0) continue;
      const allies = side === "team_a" ? a : b;
      const enemies = side === "team_a" ? b : a;
      if (!enemies.some((e) => e.current > 0)) break;

      // Healer logic
      if (attacker.role === "healer" && attacker.healCd <= 0) {
        const hurt = allies
          .filter((m) => m.current > 0 && m.current < m.maxHp)
          .sort((x, y) => x.current / x.maxHp - y.current / y.maxHp)[0];
        if (hurt) {
          const heal = Math.round(attacker.atk * 2.2 + attacker.maxHp * 0.08);
          hurt.current = Math.min(hurt.maxHp, hurt.current + heal);
          attacker.healCd = 2;
          log.push({
            turn, actor: side, actorName: attacker.name, targetName: hurt.name,
            damage: -heal, crit: false, effective: 1, remainingHp: hurt.current,
            message: `✨ ${attacker.name} curou ${hurt.name} em ${heal} HP`,
          });
          continue;
        }
      }
      if (attacker.healCd > 0) attacker.healCd -= 1;

      const target = pickTarget(attacker, enemies);
      if (!target) continue;

      const eff = TYPE_CHART[getElement(attacker.species)]?.[getElement(target.species)] ?? 1;
      const critChance = attacker.role === "assassin" ? 0.35 : 0.12;
      const crit = rand() < critChance;
      const defUsed = attacker.role === "mage" ? target.def * 0.4 : target.def;
      let base = Math.max(1, attacker.atk * 2 - defUsed);
      if (attacker.role === "dps") base *= 1.15;
      const variance = 0.85 + rand() * 0.3;
      const damage = Math.max(1, Math.round(base * eff * variance * (crit ? 1.7 : 1)));
      target.current = Math.max(0, target.current - damage);

      let msg = `${attacker.name} atacou ${target.name} causando ${damage} de dano`;
      if (crit) msg += " (CRÍTICO!)";
      if (attacker.role === "mage") msg += " 🔮";
      if (eff > 1) msg += " (super eficaz!)";
      else if (eff < 1) msg += " (pouco eficaz...)";

      log.push({
        turn, actor: side, actorName: attacker.name, targetName: target.name,
        damage, crit, effective: eff, remainingHp: target.current, message: msg,
      });

      if (target.current <= 0) {
        log.push({
          turn, actor: side, actorName: attacker.name, targetName: target.name,
          damage: 0, crit: false, effective: 1, remainingHp: 0,
          message: `💀 ${target.name} foi derrotado!`,
        });
      }
    }
    turn += 1;
  }

  const aAlive = a.some((m) => m.current > 0);
  const winner: "team_a" | "team_b" = aAlive ? "team_a" : "team_b";
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
