import { SPECIES, ROLE_SKILLS, RARITY_INFO, defensiveMultiplier, totalStats, getSkill, hungerMultiplier, type Element, type Role, type Rarity } from "./game-data";

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
  position: number; // 0 frontline, 1 middle, 2 backline
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
  winner: "team_a" | "team_b" | "draw";
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
  int?: number;
  rank?: number;
  hunger?: number;
  team_position?: number;
};

export function toBattleMonster(m: DBMonster): BattleMonster {
  const sp = SPECIES[m.species];
  const rank = m.rank ?? 1;
  const stats = totalStats(m.species, rank, {
    hp: m.hp ?? 0, atk: m.atk ?? 0, def: m.def ?? 0, spd: m.spd ?? 0, int: m.int ?? 0,
  });
  const mult = hungerMultiplier(m.hunger ?? 100);
  return {
    id: m.id,
    owner_id: m.owner_id,
    name: m.name,
    species: m.species,
    rank,
    hp: Math.max(1, Math.round(stats.hp * mult)),
    atk: Math.max(1, Math.round(stats.atk * mult)),
    def: Math.max(1, Math.round(stats.def * mult)),
    spd: Math.max(1, Math.round(stats.spd * mult)),
    int: Math.max(1, Math.round(stats.int * mult)),
    role: sp?.role ?? "dps",
    rarity: sp?.rarity ?? "common",
    position: Math.max(0, Math.min(2, m.team_position ?? 0)),
  };
}

function getElement(species: string): Element {
  return SPECIES[species]?.element ?? "shadow";
}

// ===== PASSIVAS DAS FÊNIX MÍTICAS =====
// Fênix Vermelha: cada 10% HP perdido = +12% ATK (cap +120% com 1 HP)
function phoenixAtkBonus(attacker: Live): number {
  if (attacker.species !== "fenix_vermelha") return 1;
  const hpLostPct = 1 - attacker.current / Math.max(1, attacker.maxHp);
  return 1 + hpLostPct * 1.2;
}
// Fênix Negra: 20% do dano causado vira HP máx adicional + cura
function phoenixOnDamageDealt(attacker: Live, dmg: number) {
  if (attacker.species !== "fenix_negra" || dmg <= 0) return;
  const grow = Math.max(1, Math.round(dmg * 0.20));
  attacker.maxHp += grow;
  attacker.current = Math.min(attacker.maxHp, attacker.current + grow);
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
  // novos
  burnDmg: number;       // dano por turno enquanto burnTurns > 0
  burnTurns: number;
  bleedDmg: number;      // dano físico por turno enquanto bleedTurns > 0
  bleedTurns: number;
  blindTurns: number;    // se >0, ataques básicos têm chance de errar
  silenceTurns: number;  // se >0, próxima skill é anulada
  rageTurns: number;     // berserker: +rageAtkMult e -rageDefDrop
  rageAtkMult: number;
  rageDefDrop: number;
  defBuffTurns: number;  // bônus de DEF temporário (shield_ally)
  defBuffPct: number;    // ex: 0.3 = +30% DEF
  lastFallenAt: number;  // turno em que morreu (pra revive_ally)
};

function pickTarget(attacker: Live, enemies: Live[]): Live | null {
  const alive = enemies.filter((e) => e.current > 0);
  if (alive.length === 0) return null;
  // Forced taunt target wins over everything else
  if (attacker.tauntTargetId && attacker.tauntTurns > 0) {
    const t = alive.find((e) => e.id === attacker.tauntTargetId);
    if (t) return t;
  }
  // Assassin ignores position — dives lowest HP
  if (attacker.role === "assassin") {
    return alive.reduce((a, b) => (a.current < b.current ? a : b));
  }
  // Taunt: tank still drags aggro even if behind
  const tank = alive.find((e) => e.role === "tank");
  if (tank) return tank;
  // Frontline first: lowest position number alive
  const minPos = Math.min(...alive.map((e) => e.position));
  const frontline = alive.filter((e) => e.position === minPos);
  return frontline[0];
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
    burnDmg: 0, burnTurns: 0, bleedDmg: 0, bleedTurns: 0, blindTurns: 0, silenceTurns: 0,
    rageTurns: 0, rageAtkMult: 0, rageDefDrop: 0,
    defBuffTurns: 0, defBuffPct: 0, lastFallenAt: 0,
  });
  const a: Live[] = teamA.map(mkLive);
  const b: Live[] = teamB.map(mkLive);
  const rand = rng(seed);

  let turn = 1;
  const MAX_TURNS = 30;
  const exploded = new Set<string>();

  // PASSIVA "Rato Bomba": ao morrer, explode e mata o inimigo com menos HP.
  // Chain-explosões são suportadas (se a vítima também for rato_bomba).
  function sweepDeathExplosions() {
    let changed = true;
    while (changed) {
      changed = false;
      const allMons: { mon: Live; side: "team_a" | "team_b" }[] = [
        ...a.map((mon) => ({ mon, side: "team_a" as const })),
        ...b.map((mon) => ({ mon, side: "team_b" as const })),
      ];
      for (const { mon: dead, side: deadSide } of allMons) {
        if (dead.species !== "rato_bomba") continue;
        if (dead.current > 0) continue;
        if (exploded.has(dead.id)) continue;
        exploded.add(dead.id);
        const enemyTeam = deadSide === "team_a" ? b : a;
        const enemySide: "team_a" | "team_b" = deadSide === "team_a" ? "team_b" : "team_a";
        const aliveEnemies = enemyTeam.filter((m) => m.current > 0);
        if (aliveEnemies.length === 0) continue;
        const victim = aliveEnemies.reduce((x, y) => (x.current < y.current ? x : y));
        const lethalDmg = Math.max(1, victim.current);
        victim.current = 0;
        victim.shield = 0;
        victim.lastFallenAt = turn;
        log.push({
          turn, actor: deadSide, actorName: dead.name, targetName: victim.name,
          damage: lethalDmg, crit: true, effective: 1, remainingHp: 0, targetShield: 0,
          message: `💣💥 ${dead.name} EXPLODIU ao morrer e levou ${victim.name} junto!`,
        });
        log.push({
          turn, actor: deadSide, actorName: dead.name, targetName: victim.name,
          damage: 0, crit: false, effective: 1, remainingHp: 0,
          message: `💀 ${victim.name} foi derrotado!`,
        });
        changed = true; // permite que a vítima (se for outro rato_bomba) também detone
      }
    }
  }

  while (a.some((m) => m.current > 0) && b.some((m) => m.current > 0) && turn <= MAX_TURNS) {
    type Actor = { mon: Live; side: "team_a" | "team_b" };
    const order: Actor[] = [
      ...a.map((mon) => ({ mon, side: "team_a" as const })),
      ...b.map((mon) => ({ mon, side: "team_b" as const })),
    ]
      .filter((x) => x.mon.current > 0)
      .sort((x, y) => y.mon.spd - x.mon.spd);

    for (const { mon: attacker, side } of order) {
      // Wrap em IIFE pra garantir que sweepDeathExplosions rode mesmo
      // quando alguma skill usa `continue` no meio (substituído por `return`).
      ((): void => {
      if (attacker.current <= 0) return;
      // tick taunt
      if (attacker.tauntTurns > 0) {
        attacker.tauntTurns -= 1;
        if (attacker.tauntTurns === 0) attacker.tauntTargetId = null;
      }
      // tick burn (DoT)
      if (attacker.burnTurns > 0 && attacker.current > 0) {
        applyDamage(attacker, attacker.burnDmg);
        log.push({
          turn, actor: side, actorName: attacker.name, targetName: attacker.name,
          damage: attacker.burnDmg, crit: false, effective: 1, remainingHp: attacker.current,
          message: `🔥 ${attacker.name} sofreu ${attacker.burnDmg} de queimadura`,
        });
        attacker.burnTurns -= 1;
        if (attacker.current <= 0) {
          attacker.lastFallenAt = turn;
          log.push({ turn, actor: side, actorName: attacker.name, targetName: attacker.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${attacker.name} foi consumido pelas chamas!` });
          sweepDeathExplosions();
          return;
        }
      }
      // tick bleed (DoT físico — sangramento)
      if (attacker.bleedTurns > 0 && attacker.current > 0) {
        applyDamage(attacker, attacker.bleedDmg);
        log.push({
          turn, actor: side, actorName: attacker.name, targetName: attacker.name,
          damage: attacker.bleedDmg, crit: false, effective: 1, remainingHp: attacker.current,
          message: `🩸 ${attacker.name} sangrou ${attacker.bleedDmg} de HP`,
        });
        attacker.bleedTurns -= 1;
        if (attacker.current <= 0) {
          attacker.lastFallenAt = turn;
          log.push({ turn, actor: side, actorName: attacker.name, targetName: attacker.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${attacker.name} sucumbiu à hemorragia!` });
          sweepDeathExplosions();
          return;
        }
      }
      // tick rage
      if (attacker.rageTurns > 0) {
        attacker.rageTurns -= 1;
        if (attacker.rageTurns === 0) {
          attacker.rageAtkMult = 0;
          attacker.rageDefDrop = 0;
        }
      }
      // tick def buff
      if (attacker.defBuffTurns > 0) {
        attacker.defBuffTurns -= 1;
        if (attacker.defBuffTurns === 0) attacker.defBuffPct = 0;
      }
      const allies = side === "team_a" ? a : b;
      const enemies = side === "team_a" ? b : a;
      if (!enemies.some((e) => e.current > 0)) return;

      const skill = getSkill(attacker.species);
      const skillMult = RARITY_INFO[attacker.rarity].skillMult;
      const silenced = attacker.silenceTurns > 0;
      if (silenced) attacker.silenceTurns -= 1;
      const canUseSkill = attacker.skillCd <= 0 && !silenced;

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
          return;
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
          return;
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
          return;
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
          return;
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
          return;
        }

        // ===== NOVAS MECÂNICAS =====
        const effAtk = attacker.atk * (1 + attacker.rageAtkMult);
        const effInt = attacker.int;
        const tgtEffDef = (t: Live) => t.def * (1 + t.defBuffPct);

        if (skill.kind === "lifesteal_strike") {
          const target = pickTarget(attacker, enemies);
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const base = Math.max(1, effAtk * 2 - tgtEffDef(target));
            const dmg = Math.max(1, Math.round(base * eff * 2.0 * skillMult));
            applyDamage(target, dmg);
            const healed = Math.round(dmg * 0.55);
            attacker.current = Math.min(attacker.maxHp, attacker.current + healed);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: dmg, crit: false, effective: eff, remainingHp: target.current, targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano e roubou ${healed} HP!`,
            });
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          return;
        }

        if (skill.kind === "execute") {
          const alive = enemies.filter((e) => e.current > 0);
          const target = alive.length ? alive.reduce((x, y) => (x.current / x.maxHp < y.current / y.maxHp ? x : y)) : null;
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const lowHp = target.current / target.maxHp < 0.3;
            const mult = lowHp ? 3.0 : 1.75;
            const base = Math.max(1, effAtk * 2 - tgtEffDef(target) * 0.5);
            const dmg = Math.max(1, Math.round(base * eff * mult * skillMult));
            applyDamage(target, dmg);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: dmg, crit: true, effective: eff, remainingHp: target.current, targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}${lowHp ? " — EXECUÇÃO!" : ""}: ${dmg} em ${target.name}`,
            });
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi executado!` });
            }
          }
          return;
        }

        if (skill.kind === "burn_dot") {
          const target = pickTarget(attacker, enemies);
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const baseHit = Math.max(1, Math.round((effInt * 1.4 + effAtk * 0.8) * eff * skillMult));
            applyDamage(target, baseHit);
            const dot = Math.max(1, Math.round((effInt * 0.6 + attacker.atk * 0.3) * skillMult));
            target.burnDmg = Math.max(target.burnDmg, dot);
            target.burnTurns = Math.max(target.burnTurns, 3);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: baseHit, crit: false, effective: eff, remainingHp: target.current, targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${baseHit} de dano + 🔥 queimando ${dot}/turno por 3 turnos`,
            });
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          return;
        }

        if (skill.kind === "bleed_dot") {
          const target = pickTarget(attacker, enemies);
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const baseHit = Math.max(1, Math.round((effAtk * 1.1 - tgtEffDef(target) * 0.6) * eff * skillMult));
            applyDamage(target, baseHit);
            const dot = Math.max(1, Math.round(effAtk * 0.35 * skillMult));
            target.bleedDmg = Math.max(target.bleedDmg, dot);
            target.bleedTurns = Math.max(target.bleedTurns, 3);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: baseHit, crit: false, effective: eff, remainingHp: target.current, targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${baseHit} de dano + 🩸 sangrando ${dot}/turno por 3 turnos`,
            });
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          return;
        }

        if (skill.kind === "blind_debuff") {
          // Aplica cegueira em TODOS os inimigos vivos + dano leve no alvo principal
          const target = pickTarget(attacker, enemies);
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const dmg = Math.max(1, Math.round((effAtk * 1.2 - tgtEffDef(target) * 0.5) * eff * skillMult));
            applyDamage(target, dmg);
            const alive = enemies.filter((e) => e.current > 0);
            for (const e of alive) {
              e.blindTurns = Math.max(e.blindTurns, 3);
            }
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: dmg, crit: false, effective: eff, remainingHp: target.current, targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano + 😵‍💫 cegou TODOS inimigos (50% chance de errar por 3 turnos)`,
            });
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          return;
        }




        if (skill.kind === "double_strike") {
          const alive = enemies.filter((e) => e.current > 0);
          const target = alive.length ? alive.reduce((x, y) => (x.atk > y.atk ? x : y)) : null;
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            for (let hit = 0; hit < 2 && target.current > 0; hit++) {
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target));
              const dmg = Math.max(1, Math.round(base * eff * 1.25 * skillMult));
              applyDamage(target, dmg);
              log.push({
                turn, actor: side, actorName: attacker.name, targetName: target.name,
                damage: dmg, crit: true, effective: eff, remainingHp: target.current, targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} ${skill.name} (golpe ${hit + 1}/2): ${dmg} em ${target.name}`,
              });
            }
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          return;
        }

        if (skill.kind === "shield_ally") {
          const hurt = allies
            .filter((m) => m.current > 0 && m.current < m.maxHp)
            .sort((x, y) => x.current / x.maxHp - y.current / y.maxHp)[0] ?? allies.find((m) => m.current > 0) ?? attacker;
          const shield = Math.round(effInt * 1.4 * skillMult);
          hurt.shield += shield;
          hurt.defBuffPct = Math.max(hurt.defBuffPct, 0.3);
          hurt.defBuffTurns = Math.max(hurt.defBuffTurns, 2);
          log.push({
            turn, actor: side, actorName: attacker.name, targetName: hurt.name,
            damage: 0, crit: false, effective: 1, remainingHp: hurt.current, targetShield: hurt.shield,
            message: `${skill.emoji} ${attacker.name} usou ${skill.name} em ${hurt.name}: +${shield} escudo e +30% DEF por 2 turnos`,
          });
          return;
        }

        if (skill.kind === "chain_lightning") {
          const aliveTargets = enemies.filter((e) => e.current > 0)
            .sort((x, y) => y.current - x.current)
            .slice(0, 3);
          const mults = [1.0, 0.6, 0.35];
          for (let i = 0; i < aliveTargets.length; i++) {
            const t = aliveTargets[i];
            const eff = defensiveMultiplier(getElement(attacker.species), t.species);
            const base = Math.max(1, effInt * 1.8 - t.def * 0.3);
            const dmg = Math.max(1, Math.round(base * eff * mults[i] * skillMult));
            applyDamage(t, dmg);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: t.name,
              damage: dmg, crit: false, effective: eff, remainingHp: t.current, targetShield: t.shield,
              message: `${skill.emoji} ${attacker.name} ${skill.name} (salto ${i + 1}): ${dmg} em ${t.name}`,
            });
            if (t.current <= 0) {
              t.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: t.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${t.name} foi derrotado!` });
            }
          }
          return;
        }

        if (skill.kind === "silence_disable") {
          const target = pickTarget(attacker, enemies);
          if (target) {
            const eff = defensiveMultiplier(getElement(attacker.species), target.species);
            const base = Math.max(1, effInt * 1.6 - target.def * 0.3);
            const dmg = Math.max(1, Math.round(base * eff * 1.1 * skillMult));
            applyDamage(target, dmg);
            target.silenceTurns = Math.max(target.silenceTurns, 2);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: dmg, crit: false, effective: eff, remainingHp: target.current, targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} em ${target.name} e 🤐 silenciou próxima skill`,
            });
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi derrotado!` });
            }
          }
          return;
        }

        if (skill.kind === "berserker_rage") {
          attacker.rageAtkMult = 0.65 * skillMult;
          attacker.rageDefDrop = 0.25;
          attacker.rageTurns = 3;
          log.push({
            turn, actor: side, actorName: attacker.name, targetName: attacker.name,
            damage: 0, crit: false, effective: 1, remainingHp: attacker.current,
            message: `${skill.emoji} ${attacker.name} usou ${skill.name}! +${Math.round(attacker.rageAtkMult * 100)}% ATK e -25% DEF por 3 turnos`,
          });
          return;
        }

        if (skill.kind === "revive_ally") {
          const fallen = allies.filter((m) => m.current <= 0).sort((x, y) => y.lastFallenAt - x.lastFallenAt)[0];
          if (fallen) {
            fallen.current = Math.round(fallen.maxHp * 0.40);
            fallen.shield = 0;
            fallen.burnTurns = 0; fallen.bleedTurns = 0; fallen.blindTurns = 0; fallen.silenceTurns = 0;
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: fallen.name,
              damage: -fallen.current, crit: false, effective: 1, remainingHp: fallen.current,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}! ✨ ${fallen.name} foi ressuscitado com ${fallen.current} HP`,
            });
          } else {
            // Sem ninguém pra ressuscitar — cura todo o time
            const heal = Math.round((effInt * 1.6 + attacker.maxHp * 0.10) * skillMult);
            for (const t of allies.filter((m) => m.current > 0)) {
              t.current = Math.min(t.maxHp, t.current + heal);
            }
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: "todos os aliados",
              damage: -heal, crit: false, effective: 1, remainingHp: 0,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}! Curou o time em ${heal} HP (ninguém caído)`,
            });
          }
          return;
        }

        if (skill.kind === "true_damage_nuke") {
          const target = pickTarget(attacker, enemies);
          if (target) {
            const scale = attacker.role === "mage" ? effInt * 2.5 : effAtk * 2.8;
            const dmg = Math.max(1, Math.round(scale * skillMult));
            applyDamage(target, dmg);
            log.push({
              turn, actor: side, actorName: attacker.name, targetName: target.name,
              damage: dmg, crit: true, effective: 1, remainingHp: target.current, targetShield: target.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano VERDADEIRO em ${target.name}!`,
            });
            if (target.current <= 0) {
              target.lastFallenAt = turn;
              log.push({ turn, actor: side, actorName: attacker.name, targetName: target.name, damage: 0, crit: false, effective: 1, remainingHp: 0, message: `💀 ${target.name} foi reduzido a pó!` });
            }
          }
          return;
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
          return;
        }
      }
      if (attacker.healCd > 0) attacker.healCd -= 1;

      // ===== BASIC ATTACK =====
      const target = pickTarget(attacker, enemies);
      if (!target) return;

      // Cegueira: 50% de chance de errar o ataque básico
      if (attacker.blindTurns > 0) {
        attacker.blindTurns -= 1;
        if (rand() < 0.5) {
          log.push({
            turn, actor: side, actorName: attacker.name, targetName: target.name,
            damage: 0, crit: false, effective: 1, remainingHp: target.current,
            message: `😵‍💫 ${attacker.name} errou o ataque (cegueira)!`,
          });
          return;
        }
      }

      // Esquiva por velocidade: 5% base + 3.5% por ponto de SPD a mais que o atacante
      // mínimo 5% (sempre há chance), máximo 55%
      const spdDiff = target.spd - attacker.spd;
      const dodgeChance = Math.max(0.05, Math.min(0.55, 0.05 + spdDiff * 0.035));
      if (rand() < dodgeChance) {
        log.push({
          turn, actor: side, actorName: attacker.name, targetName: target.name,
          damage: 0, crit: false, effective: 1, remainingHp: target.current,
          message: `💨 ${target.name} esquivou do ataque! (${Math.round(dodgeChance * 100)}% de esquiva)`,
        });
        return;
      }


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
      })();
      // PASSIVA Rato Bomba: detona explosão APÓS cada ator (skill ou ataque)
      sweepDeathExplosions();
    }
    turn += 1;
  }

  const aAlive = a.some((m) => m.current > 0);
  const bAlive = b.some((m) => m.current > 0);
  const winner: "team_a" | "team_b" | "draw" =
    aAlive && bAlive ? "draw" : aAlive ? "team_a" : "team_b";
  if (winner === "draw") {
    log.push({
      turn, actor: "team_a", actorName: "—", targetName: "—",
      damage: 0, crit: false, effective: 1, remainingHp: 0,
      message: "⏱️ Tempo esgotado! A batalha terminou em EMPATE.",
    });
  }
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
