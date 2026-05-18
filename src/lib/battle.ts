import { SPECIES, ROLE_SKILLS, RARITY_INFO, defensiveMultiplier, totalStats, type Element, type Role, type Rarity } from "./game-data";

export type BattleMonster = {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  rank: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
  role: Role;
  rarity: Rarity;
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
  targetShield?: number;
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
  hp: number;
  atk: number;
  def: number;
  spd: number;
  rank?: number;
};

export function toBattleMonster(m: DBMonster): BattleMonster {
  const sp = SPECIES[m.species];
  const rank = m.rank ?? 1;
  const stats = totalStats(m.species, rank);
  return {
    id: m.id,
    owner_id: m.owner_id,
    name: m.name,
    species: m.species,
    rank,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    spd: stats.spd,
    int: stats.int,
    role: sp?.role ?? "dps",
    rarity: sp?.rarity ?? "common",
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

type Live = BattleMonster & {
  current: number;
  maxHp: number;
  healCd: number;
  skillCd: number;
  shield: number;
  tauntTargetId: string | null;
  tauntTurns: number;
};

function pickTarget(attacker: Live, enemies: Live[]): Live | null {
  const alive = enemies.filter((e) => e.current > 0);
  if (alive.length === 0) return null;
  // Forced taunt target wins over everything else
  if (attacker.tauntTargetId && attacker.tauntTurns > 0) {
    const t = alive.find((e) => e.id === attacker.tauntTargetId);
    if (t) return t;
  }
  // Taunt: prefer tank if alive
  const tank = alive.find((e) => e.role === "tank");
  if (tank && attacker.role !== "assassin") return tank;
  // Assassin: lowest current HP
  if (attacker.role === "assassin") {
    return alive.reduce((a, b) => (a.current < b.current ? a : b));
  }
  return alive[0];
}

function applyDamage(target: Live, raw: number): number {
  let dmg = raw;
  if (target.shield > 0) {
    const absorbed = Math.min(target.shield, dmg);
    target.shield -= absorbed;
    dmg -= absorbed;
  }
  target.current = Math.max(0, target.current - dmg);
  return raw; // return original for log
}

export function simulateBattle(teamA: BattleMonster[], teamB: BattleMonster[], seed = Date.now()): BattleResult {
  const log: BattleLogEntry[] = [];
  const mkLive = (m: BattleMonster): Live => ({
    ...m, current: m.hp, maxHp: m.hp,
    healCd: 0, skillCd: 1, shield: 0,
    tauntTargetId: null, tauntTurns: 0,
  });
  const a: Live[] = teamA.map(mkLive);
  const b: Live[] = teamB.map(mkLive);
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
      // tick taunt
      if (attacker.tauntTurns > 0) {
        attacker.tauntTurns -= 1;
        if (attacker.tauntTurns === 0) attacker.tauntTargetId = null;
      }
      const allies = side === "team_a" ? a : b;
      const enemies = side === "team_a" ? b : a;
      if (!enemies.some((e) => e.current > 0)) break;

      const skill = ROLE_SKILLS[attacker.role];
      const skillMult = RARITY_INFO[attacker.rarity].skillMult;
      const canUseSkill = attacker.skillCd <= 0;

      // ===== ACTIVE SKILLS =====
      if (canUseSkill) {
        attacker.skillCd = skill.cooldown;

        if (skill.kind === "team_heal") {
          const heal = Math.round((attacker.int * 1.8 + attacker.maxHp * 0.10) * skillMult);
          const targets = allies.filter((m) => m.current > 0);
          for (const t of targets) {
            t.current = Math.min(t.maxHp, t.current + heal);
          }
          log.push({
            turn, actor: side, actorName: attacker.name, targetName: "todos os aliados",
            damage: -heal, crit: false, effective: 1, remainingHp: 0,
            message: `${skill.emoji} ${attacker.name} usou ${skill.name}! Curou todos os aliados em ${heal} HP`,
          });
          continue;
        }

        if (skill.kind === "shield_taunt") {
          const shield = Math.round(attacker.maxHp * 0.30 * skillMult);
          attacker.shield += shield;
          for (const e of enemies.filter((x) => x.current > 0)) {
            e.tauntTargetId = attacker.id;
            e.tauntTurns = 2;
          }
          log.push({
            turn, actor: side, actorName: attacker.name, targetName: attacker.name,
            damage: 0, crit: false, effective: 1, remainingHp: attacker.current,
            targetShield: attacker.shield,
            message: `${skill.emoji} ${attacker.name} usou ${skill.name}! Provocou todos e ganhou ${shield} de escudo`,
          });
          continue;
        }

        if (skill.kind === "aoe_magic") {
          const targets = enemies.filter((e) => e.current > 0);
          for (const t of targets) {
            const eff = defensiveMultiplier(getElement(attacker.species), t.species);
            const base = Math.max(1, attacker.int * 2.2 - t.def * 0.3);
            const dmg = Math.max(1, Math.round(base * eff * 1.2 * skillMult));
            applyDamage(t, dmg);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: t.name,
              damage: dmg, crit: false, effective: eff, remainingHp: t.current,
              targetShield: t.shield,
              message: `${skill.emoji} ${attacker.name} → ${t.name}: ${dmg} de dano arcano`,
            });
            if (t.current <= 0) {
              log.push({ turn, actor: side, actorName: attacker.name, targetName: t.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${t.name} foi derrotado!` });
            }
          }
          continue;
        }

        if (skill.kind === "heavy_strike") {
          const target = pickTarget(attacker, enemies);
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const base = Math.max(1, attacker.atk * 2 - target.def);
            const dmg = Math.max(1, Math.round(base * eff * 2.2 * skillMult));
            applyDamage(target, dmg);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: dmg, crit: true, effective: eff, remainingHp: target.current,
              targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name} em ${target.name}: ${dmg} de dano massivo!`,
            });
            if (target.current <= 0) {
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          continue;
        }

        if (skill.kind === "guaranteed_crit") {
          const alive = enemies.filter((e) => e.current > 0);
          const target = alive.length ? alive.reduce((x, y) => (x.current < y.current ? x : y)) : null;
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const base = Math.max(1, attacker.atk * 2 - target.def * 0.4);
            const dmg = Math.max(1, Math.round(base * eff * 1.8 * 1.7 * skillMult));
            applyDamage(target, dmg);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: dmg, crit: true, effective: eff, remainingHp: target.current,
              targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} CRÍTICO em ${target.name}!`,
            });
            if (target.current <= 0) {
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          continue;
        }
      }
      if (attacker.skillCd > 0) attacker.skillCd -= 1;

      // ===== PASSIVE: healer auto-heal =====
      if (attacker.role === "healer" && attacker.healCd <= 0) {
        const hurt = allies
          .filter((m) => m.current > 0 && m.current < m.maxHp)
          .sort((x, y) => x.current / x.maxHp - y.current / y.maxHp)[0];
        if (hurt) {
          const heal = Math.round((attacker.int * 2.2 + attacker.maxHp * 0.08) * RARITY_INFO[attacker.rarity].skillMult);
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

      // ===== BASIC ATTACK =====
      const target = pickTarget(attacker, enemies);
      if (!target) continue;

      const eff = defensiveMultiplier(getElement(attacker.species), target.species);
      const critChance = attacker.role === "assassin" ? 0.35 : 0.12;
      const crit = rand() < critChance;
      const defUsed = attacker.role === "mage" ? target.def * 0.4 : target.def;
      const atkStat = attacker.role === "mage" ? attacker.int : attacker.atk;
      let base = Math.max(1, atkStat * 2 - defUsed);
      if (attacker.role === "dps") base *= 1.15;
      const variance = 0.85 + rand() * 0.3;
      const damage = Math.max(1, Math.round(base * eff * variance * (crit ? 1.7 : 1)));
      applyDamage(target, damage);

      let msg = `${attacker.name} atacou ${target.name} causando ${damage} de dano`;
      if (crit) msg += " (CRÍTICO!)";
      if (attacker.role === "mage") msg += " 🔮";
      if (eff > 1) msg += " (super eficaz!)";
      else if (eff < 1) msg += " (pouco eficaz...)";

      log.push({
        turn, actor: side, actorName: attacker.name, targetName: target.name,
        damage, crit, effective: eff, remainingHp: target.current,
        targetShield: target.shield, message: msg,
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
