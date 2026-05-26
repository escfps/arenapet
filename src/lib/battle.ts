import {
  SPECIES,
  ROLE_SKILLS,
  RARITY_INFO,
  defensiveMultiplier,
  totalStats,
  getSkill,
  hungerMultiplier,
  synergyStatBonuses,
  computeSynergies,
  CATEGORY_INFO,
  type Element,
  type Role,
  type Rarity,
} from "./game-data";

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
  crit: number;
  role: Role;
  rarity: Rarity;
  position: number; // 0 frontline, 1 middle, 2 backline
};

export type BattleLogEntry = {
  turn: number;
  actor: "team_a" | "team_b";
  actorName: string;
  targetName: string;
  targetNames?: string[];
  targetTeam?: "actor" | "opponent";
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
  crit?: number;
  rank?: number;
  hunger?: number;
  team_position?: number;
};

export function toBattleMonster(m: DBMonster): BattleMonster {
  const sp = SPECIES[m.species];
  const rank = m.rank ?? 1;
  const stats = totalStats(m.species, rank, {
    hp: m.hp ?? 0,
    atk: m.atk ?? 0,
    def: m.def ?? 0,
    spd: m.spd ?? 0,
    int: m.int ?? 0,
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
    crit: Math.max(0, m.crit ?? 0),
    role: sp?.role ?? "dps",
    rarity: sp?.rarity ?? "common",
    position: Math.max(0, Math.min(2, m.team_position ?? 0)),
  };
}

function getElement(species: string): Element {
  return SPECIES[species]?.element ?? "shadow";
}

// ===== PASSIVAS DAS FÊNIX MÍTICAS =====
// Fênix Vermelha: cada 10% HP perdido = +6% ATK (cap +60% com 1 HP)
function phoenixAtkBonus(attacker: Live): number {
  if (attacker.species !== "fenix_vermelha") return 1;
  const hpLostPct = 1 - attacker.current / Math.max(1, attacker.maxHp);
  return 1 + hpLostPct * 0.6;
}
// Fênix Negra: 2% do dano causado vira HP máx + cura (SÓ NA BATALHA, máx +50% do HP base)
function phoenixOnDamageDealt(attacker: Live, dmg: number): number {
  if (attacker.species !== "fenix_negra" || dmg <= 0) return 0;
  const cap = Math.round(attacker.hp * 1.5); // hp = base inicial; cap = 150% do base
  if (attacker.maxHp >= cap) return 0;
  const grow = Math.min(cap - attacker.maxHp, Math.max(1, Math.round(dmg * 0.02)));
  attacker.maxHp += grow;
  attacker.current = Math.min(attacker.maxHp, attacker.current + grow);
  return grow;
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
  burnDmg: number; // dano por turno enquanto burnTurns > 0
  burnTurns: number;
  bleedDmg: number; // dano físico por turno enquanto bleedTurns > 0
  bleedTurns: number;
  poisonDmg: number; // dano de veneno por turno enquanto poisonTurns > 0
  poisonTurns: number;
  blindTurns: number; // se >0, ataques básicos têm chance de errar
  sleepTurns: number; // se >0, pula o turno (dormindo zzz)
  freezeTurns: number; // se >0, pula o turno (congelado ❄️)
  silenceTurns: number; // se >0, próxima skill é anulada
  rageTurns: number; // berserker: +rageAtkMult e -rageDefDrop
  rageAtkMult: number;
  rageDefDrop: number;
  defBuffTurns: number; // bônus de DEF temporário (shield_ally)
  defBuffPct: number; // ex: 0.3 = +30% DEF
  defDebuffTurns: number; // redução de DEF temporária (ash_breath)
  defDebuffPct: number; // ex: 0.2 = -20% DEF
  atkDebuffTurns: number; // redução de ATK temporária (chill_heal)
  atkDebuffPct: number; // ex: 0.15 = -15% ATK
  spdBuffTurns: number; // bônus temporário de SPD (night_mark)
  spdBuffPct: number; // ex: 0.15 = +15% SPD
  dmgReductionTurns: number; // reduz todo dano recebido por X turnos (turtle_shell)
  dmgReductionPct: number; // ex: 0.2 = -20% de dano recebido
  stunTurns: number; // se >0, pula o turno (atordoado ⚡)
  thornsPct: number; // refletir % do dano recebido em ataques básicos
  killStacks: number; // T-Rex: acumulador permanente de kills (+15% ATK por kill)
  lastFallenAt: number; // turno em que morreu (pra revive_ally)
  markTurns: number; // 🏴 Marca da Morte: +25% dano sofrido e não pode esquivar
  markPassiveProcessed: boolean; // controle: passiva da Coruja Branca já processou morte
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

/** SPD efetivo considerando passivas dependentes de HP (ex: Urubu Carniceiro). */
function effectiveSpd(mon: Live): number {
  let s = mon.spd;
  if (mon.species === "urubu_carniceiro" && mon.maxHp > 0) {
    const lostPct = 1 - mon.current / mon.maxHp; // 0..1
    const steps = Math.min(10, Math.floor(lostPct * 10)); // cada 10% perdido
    s = Math.round(s * (1 + steps * 0.07));
  }
  if (mon.spdBuffTurns > 0 && mon.spdBuffPct > 0) {
    s = Math.round(s * (1 + mon.spdBuffPct));
  }
  return s;
}

/** Elefante Ancestral: PASSIVA — completamente imune a sono, marca, congelamento, silêncio, queimadura e cegueira durante toda a batalha. */
function isCCImmune(mon: Live): boolean {
  return mon.species === "elefante_ancestral";
}



function applyDamage(target: Live, raw: number): number {
  let dmg = raw;
  // 🏴 Marca da Morte: +25% de dano sofrido
  if (target.markTurns > 0) {
    dmg = Math.round(dmg * 1.25);
  }
  if (target.dmgReductionPct > 0) {
    dmg = Math.max(1, Math.round(dmg * (1 - target.dmgReductionPct)));
  }
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
    ...m,
    current: m.hp,
    maxHp: m.hp,
    healCd: 0,
    skillCd: 1,
    shield: 0,
    tauntTargetId: null,
    tauntTurns: 0,
    burnDmg: 0,
    burnTurns: 0,
    bleedDmg: 0,
    bleedTurns: 0,
    poisonDmg: 0,
    poisonTurns: 0,
    blindTurns: 0,
    sleepTurns: 0,
    freezeTurns: 0,
    silenceTurns: 0,
    rageTurns: 0,
    rageAtkMult: 0,
    rageDefDrop: 0,
    defBuffTurns: 0,
    defBuffPct: 0,
    defDebuffTurns: 0,
    defDebuffPct: 0,
    atkDebuffTurns: 0,
    atkDebuffPct: 0,
    dmgReductionTurns: 0,
    dmgReductionPct: 0,
    stunTurns: 0,
    thornsPct: m.species === "triceratops_colossal" ? 0.15 : m.species === "porco_espinho" ? 0.10 : 0,
    killStacks: 0,
    lastFallenAt: 0,
    markTurns: 0,
    markPassiveProcessed: false,
    spdBuffTurns: 0,
    spdBuffPct: 0,
  });
  const a: Live[] = teamA.map(mkLive);
  const b: Live[] = teamB.map(mkLive);
  const rand = rng(seed);

  // ===== SINERGIA POR CATEGORIA (aplica buffs no início da batalha) =====
  const bonusA = synergyStatBonuses(teamA.map((m) => m.species));
  const bonusB = synergyStatBonuses(teamB.map((m) => m.species));
  const applyTeamSynergy = (team: Live[], bonus: typeof bonusA) => {
    for (const m of team) {
      if (bonus.hp > 0) {
        const newMax = Math.max(1, Math.round(m.maxHp * (1 + bonus.hp / 100)));
        m.maxHp = newMax;
        m.current = newMax;
      }
      if (bonus.atk > 0) m.atk = Math.max(1, Math.round(m.atk * (1 + bonus.atk / 100)));
      if (bonus.def > 0) m.def = Math.max(1, Math.round(m.def * (1 + bonus.def / 100)));
      if (bonus.spd > 0) m.spd = Math.max(1, Math.round(m.spd * (1 + bonus.spd / 100)));
      if (bonus.int > 0) m.int = Math.max(1, Math.round(m.int * (1 + bonus.int / 100)));
    }
  };
  applyTeamSynergy(a, bonusA);
  applyTeamSynergy(b, bonusB);
  const critBonusA = bonusA.crit / 100;
  const critBonusB = bonusB.crit / 100;

  // Log inicial das sinergias ativas
  const logSynergies = (side: "team_a" | "team_b", speciesIds: string[]) => {
    const active = computeSynergies(speciesIds).filter((s) => s.active);
    if (active.length === 0) return;
    const desc = active
      .map(
        (s) =>
          `${CATEGORY_INFO[s.category].emoji} ${CATEGORY_INFO[s.category].name} +${s.bonusPct}% ${CATEGORY_INFO[s.category].statLabel}`,
      )
      .join(" • ");
    log.push({
      turn: 0,
      actor: side,
      actorName: "—",
      targetName: "—",
      damage: 0,
      crit: false,
      effective: 1,
      remainingHp: 0,
      message: `✨ Sinergia ${side === "team_a" ? "aliada" : "inimiga"}: ${desc}`,
    });
  };
  logSynergies(
    "team_a",
    teamA.map((m) => m.species),
  );
  logSynergies(
    "team_b",
    teamB.map((m) => m.species),
  );

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
          turn,
          actor: deadSide,
          actorName: dead.name,
          targetName: victim.name,
          damage: lethalDmg,
          crit: true,
          effective: 1,
          remainingHp: 0,
          targetShield: 0,
          message: `💣💥 ${dead.name} EXPLODIU ao morrer e levou ${victim.name} junto!`,
        });
        log.push({
          turn,
          actor: deadSide,
          actorName: dead.name,
          targetName: victim.name,
          damage: 0,
          crit: false,
          effective: 1,
          remainingHp: 0,
          message: `💀 ${victim.name} foi derrotado!`,
        });
        changed = true; // permite que a vítima (se for outro rato_bomba) também detone
      }
    }
  }

  // PASSIVA Coruja Branca "Olhos da Noite": ao morrer um inimigo marcado,
  // o aliado com menor HP da equipe da Coruja recupera 12% do HP máximo.
  function sweepOwlPassive() {
    const sides = [
      { team: a, opp: b, deadSide: "team_a" as const, healSide: "team_b" as const },
      { team: b, opp: a, deadSide: "team_b" as const, healSide: "team_a" as const },
    ];
    for (const { team, opp, healSide } of sides) {
      for (const dead of team) {
        if (dead.current > 0) continue;
        if (dead.markTurns <= 0) continue;
        if (dead.markPassiveProcessed) continue;
        dead.markPassiveProcessed = true;
        const owls = opp.filter((m) => m.species === "coruja_branca" && m.current > 0);
        if (owls.length === 0) continue;
        const aliveAllies = opp.filter((m) => m.current > 0);
        if (aliveAllies.length === 0) continue;
        const lowest = aliveAllies.reduce((x, y) =>
          x.current / x.maxHp < y.current / y.maxHp ? x : y,
        );
        const heal = Math.round(lowest.maxHp * 0.12);
        const before = lowest.current;
        lowest.current = Math.min(lowest.maxHp, lowest.current + heal);
        const healed = lowest.current - before;
        if (healed > 0) {
          log.push({
            turn,
            actor: healSide,
            actorName: owls[0].name,
            targetName: lowest.name,
            damage: 0,
            crit: false,
            effective: 1,
            remainingHp: lowest.current,
            message: `✨ Olhos da Noite: ${owls[0].name} curou ${lowest.name} em ${healed} HP (marca consumida em ${dead.name})`,
          });
        }
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
      .sort((x, y) => effectiveSpd(y.mon) - effectiveSpd(x.mon));

    for (const { mon: attacker, side } of order) {
      // Wrap em IIFE pra garantir que sweepDeathExplosions rode mesmo
      // quando alguma skill usa `continue` no meio (substituído por `return`).
      ((): void => {
        if (attacker.current <= 0) return;
        // tick sleep — dormindo pula o turno inteiro (não age, mas tampouco sofre DoTs novos)
        if (attacker.sleepTurns > 0) {
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: attacker.name,
            damage: 0,
            crit: false,
            effective: 1,
            remainingHp: attacker.current,
            message: `💤 ${attacker.name} está dormindo... zzz`,
          });
          attacker.sleepTurns -= 1;
          return;
        }
        // tick freeze — congelado pula o turno
        if (attacker.freezeTurns > 0) {
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: attacker.name,
            damage: 0,
            crit: false,
            effective: 1,
            remainingHp: attacker.current,
            message: `❄️ ${attacker.name} está congelado e não pode agir!`,
          });
          attacker.freezeTurns -= 1;
          return;
        }
        // tick stun — atordoado pula o turno
        if (attacker.stunTurns > 0) {
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: attacker.name,
            damage: 0,
            crit: false,
            effective: 1,
            remainingHp: attacker.current,
            message: `⚡ ${attacker.name} está atordoado e não pode agir!`,
          });
          attacker.stunTurns -= 1;
          return;
        }
        // tick taunt
        if (attacker.tauntTurns > 0) {
          attacker.tauntTurns -= 1;
          if (attacker.tauntTurns === 0) attacker.tauntTargetId = null;
        }
        // tick burn (DoT)
        if (attacker.burnTurns > 0 && attacker.current > 0) {
          applyDamage(attacker, attacker.burnDmg);
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: attacker.name,
            damage: attacker.burnDmg,
            crit: false,
            effective: 1,
            remainingHp: attacker.current,
            message: `🔥 ${attacker.name} sofreu ${attacker.burnDmg} de queimadura`,
          });
          attacker.burnTurns -= 1;
          if (attacker.current <= 0) {
            attacker.lastFallenAt = turn;
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: 0,
              message: `💀 ${attacker.name} foi consumido pelas chamas!`,
            });
            sweepDeathExplosions();
            sweepOwlPassive();
            return;
          }
        }
        // tick bleed (DoT físico — sangramento)
        if (attacker.bleedTurns > 0 && attacker.current > 0) {
          applyDamage(attacker, attacker.bleedDmg);
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: attacker.name,
            damage: attacker.bleedDmg,
            crit: false,
            effective: 1,
            remainingHp: attacker.current,
            message: `🩸 ${attacker.name} sangrou ${attacker.bleedDmg} de HP`,
          });
          attacker.bleedTurns -= 1;
          if (attacker.current <= 0) {
            attacker.lastFallenAt = turn;
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: 0,
              message: `💀 ${attacker.name} sucumbiu à hemorragia!`,
            });
            sweepDeathExplosions();
            sweepOwlPassive();
            return;
        }
        // tick poison (DoT venenoso — Escorpião)
        if (attacker.poisonTurns > 0 && attacker.current > 0) {
          let pdmg = attacker.poisonDmg;
          // Passiva Veneno Rastreador: +15% dano de veneno em alvos marcados
          if (attacker.markTurns > 0) pdmg = Math.max(1, Math.round(pdmg * 1.15));
          applyDamage(attacker, pdmg);
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: attacker.name,
            damage: pdmg,
            crit: false,
            effective: 1,
            remainingHp: attacker.current,
            message: `☠️ ${attacker.name} sofreu ${pdmg} de veneno`,
          });
          attacker.poisonTurns -= 1;
          if (attacker.current <= 0) {
            attacker.lastFallenAt = turn;
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: 0,
              message: `💀 ${attacker.name} foi consumido pelo veneno!`,
            });
            sweepDeathExplosions();
            sweepOwlPassive();
            return;
          }
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
        // tick def debuff
        if (attacker.defDebuffTurns > 0) {
          attacker.defDebuffTurns -= 1;
          if (attacker.defDebuffTurns === 0) attacker.defDebuffPct = 0;
        }
        // tick atk debuff
        if (attacker.atkDebuffTurns > 0) {
          attacker.atkDebuffTurns -= 1;
          if (attacker.atkDebuffTurns === 0) attacker.atkDebuffPct = 0;
        }
        // tick spd buff
        if (attacker.spdBuffTurns > 0) {
          attacker.spdBuffTurns -= 1;
          if (attacker.spdBuffTurns === 0) attacker.spdBuffPct = 0;
        }
        // tick dmg reduction
        if (attacker.dmgReductionTurns > 0) {
          attacker.dmgReductionTurns -= 1;
          if (attacker.dmgReductionTurns === 0) attacker.dmgReductionPct = 0;
        }
        // tick 🏴 Marca da Morte
        if (attacker.markTurns > 0) {
          attacker.markTurns -= 1;
        }
        const allies = side === "team_a" ? a : b;
        const enemies = side === "team_a" ? b : a;
        if (!enemies.some((e) => e.current > 0)) return;

        // PASSIVA Panda: cada turno cura o aliado com menos HP em INT × 0.8
        if (attacker.species === "panda") {
          const aliveAllies = allies.filter((m) => m.current > 0);
          const wounded = aliveAllies
            .filter((m) => m.current < m.maxHp)
            .sort((x, y) => x.current / x.maxHp - y.current / y.maxHp)[0];
          if (wounded) {
            const heal = Math.max(1, Math.round(attacker.int * 0.8 * RARITY_INFO[attacker.rarity].skillMult));
            const before = wounded.current;
            wounded.current = Math.min(wounded.maxHp, wounded.current + heal);
            const actual = wounded.current - before;
            if (actual > 0) {
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: wounded.name,
                damage: -actual,
                crit: false,
                effective: 1,
                remainingHp: wounded.current,
                message: `🌿 ${attacker.name} (Equilíbrio): curou ${wounded.name} em ${actual} HP`,
              });
            }
          }
        }

        // PASSIVA Orangotango: cada turno reduz 1 cd do aliado mais travado (maior skillCd) — nunca afeta ele mesmo
        if (attacker.species === "orangotango") {
          const candidates = allies.filter((m) => m.current > 0 && m.skillCd > 0 && m.id !== attacker.id);
          if (candidates.length) {
            const stuck = candidates.reduce((x, y) => (y.skillCd > x.skillCd ? y : x));
            stuck.skillCd = Math.max(0, stuck.skillCd - 1);
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: stuck.name,
                targetNames: [stuck.name],
                targetTeam: "actor",
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: stuck.current,
                message: `🦧 ${attacker.name} (Ritual Ancestral): reduziu cooldown de ${stuck.name} (-1 turno)`,
            });
          }
        }

        const skill = getSkill(attacker.species);
        const skillMult = RARITY_INFO[attacker.rarity].skillMult;
        const silenced = attacker.silenceTurns > 0;
        if (silenced) attacker.silenceTurns -= 1;
        const canUseSkill = attacker.skillCd <= 0 && !silenced;

        // ===== ACTIVE SKILLS =====
        if (canUseSkill) {
          attacker.skillCd = skill.cooldown;

          if (skill.kind === "team_heal") {
            const heal = Math.round((attacker.int * 1.8 + attacker.maxHp * 0.1) * skillMult);
            const targets = allies.filter((m) => m.current > 0);
            for (const t of targets) {
              t.current = Math.min(t.maxHp, t.current + heal);
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: "todos os aliados",
              damage: -heal,
              crit: false,
              effective: 1,
              remainingHp: 0,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}! Curou todos os aliados em ${heal} HP`,
            });
            return;
          }

          if (skill.kind === "heal_lowest") {
            const alive = allies.filter((m) => m.current > 0);
            const target = alive.slice().sort((a, b) => a.current / a.maxHp - b.current / b.maxHp)[0] ?? attacker;
            const heal = Math.round(attacker.int * 1.2 * skillMult);
            target.current = Math.min(target.maxHp, target.current + heal);
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: target.name,
              damage: -heal,
              crit: false,
              effective: 1,
              remainingHp: target.current,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}! Curou ${target.name} em ${heal} HP`,
            });
            return;
          }

          if (skill.kind === "shield_taunt") {
            const shield = Math.round(attacker.maxHp * 0.3 * skillMult);
            attacker.shield += shield;
            for (const e of enemies.filter((x) => x.current > 0)) {
              e.tauntTargetId = attacker.id;
              e.tauntTurns = 2;
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
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
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: t.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: t.current,
                targetShield: t.shield,
                message: `${skill.emoji} ${attacker.name} → ${t.name}: ${dmg} de dano arcano`,
              });
              if (t.current <= 0) {
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: t.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${t.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "aoe_strike_def_down") {
            const targets = enemies.filter((e) => e.current > 0);
            for (const t of targets) {
              const eff = defensiveMultiplier(getElement(attacker.species), t.species);
              const base = Math.max(1, attacker.atk * 1.3 - t.def * 0.5);
              const dmg = Math.max(1, Math.round(base * eff * skillMult));
              applyDamage(t, dmg);
              t.defDebuffPct = Math.max(t.defDebuffPct, 0.15);
              t.defDebuffTurns = Math.max(t.defDebuffTurns, 2);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: t.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: t.current,
                targetShield: t.shield,
                message: `${skill.emoji} ${attacker.name} → ${t.name}: ${dmg} de dano e -15% DEF (2 turnos)`,
              });
              if (t.current <= 0) {
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: t.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${t.name} foi derrotado!`,
                });
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
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name} em ${target.name}: ${dmg} de dano massivo!`,
              });
              if (target.current <= 0) {
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
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
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} CRÍTICO em ${target.name}!`,
              });
              if (target.current <= 0) {
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          // ===== NOVAS MECÂNICAS =====
          const effAtk =
            attacker.atk *
            (1 + attacker.rageAtkMult) *
            (1 + 0.15 * attacker.killStacks) *
            phoenixAtkBonus(attacker) *
            Math.max(0, 1 - attacker.atkDebuffPct);
          const effInt = attacker.int;
          const tgtEffDef = (t: Live) => t.def * (1 + t.defBuffPct) * Math.max(0, 1 - t.defDebuffPct);

          if (skill.kind === "lifesteal_strike") {
            const target = pickTarget(attacker, enemies);
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const dmgMult = attacker.species === "lobo_lua_sangrenta" ? 1.6 : 2.0;
              const lifestealPct =
                attacker.species === "lobo_lua_sangrenta" ? 0.40 :
                attacker.species === "jacare_ancestral" ? 0.30 :
                attacker.species === "tubarao_abissal" ? 0.25 :
                0.55;
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target));
              const dmg = Math.max(1, Math.round(base * eff * dmgMult * skillMult));
              applyDamage(target, dmg);
              const healed = Math.round(dmg * lifestealPct);
              attacker.current = Math.min(attacker.maxHp, attacker.current + healed);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano e roubou ${healed} HP!`,
              });
              if (healed > 0) {
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: attacker.name,
                  damage: -healed,
                  crit: false,
                  effective: 1,
                  remainingHp: attacker.current,
                  message: `🩸 ${attacker.name} recuperou ${healed} HP (Roubo de Vida)`,
                });
              }
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "execute") {
            const alive = enemies.filter((e) => e.current > 0);
            const target = alive.length
              ? alive.reduce((x, y) => (x.current / x.maxHp < y.current / y.maxHp ? x : y))
              : null;
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const lowHp = target.current / target.maxHp < 0.3;
              const mult = lowHp ? 3.0 : 1.75;
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target) * 0.5);
              const dmg = Math.max(1, Math.round(base * eff * mult * skillMult));
              applyDamage(target, dmg);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}${lowHp ? " — EXECUÇÃO!" : ""}: ${dmg} em ${target.name}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi executado!`,
                });
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
              if (!isCCImmune(target)) {
                target.burnDmg = Math.max(target.burnDmg, dot);
                target.burnTurns = Math.max(target.burnTurns, 3);
              }
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: baseHit,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${baseHit} de dano + 🔥 queimando ${dot}/turno por 3 turnos`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
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
              if (!isCCImmune(target)) {
                target.bleedDmg = Math.max(target.bleedDmg, dot);
                target.bleedTurns = Math.max(target.bleedTurns, 3);
              }
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: baseHit,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${baseHit} de dano + 🩸 sangrando ${dot}/turno por 3 turnos`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
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
                if (!isCCImmune(e)) e.blindTurns = Math.max(e.blindTurns, 1);
              }
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano + 😵‍💫 cegou TODOS inimigos (50% chance de errar por 3 turnos)`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "sleep_strike") {
            // Dano mágico no alvo + 80% chance de adormecer por 2 turnos
            const target = pickTarget(attacker, enemies);
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const dmg = Math.max(1, Math.round((effInt * 1.8 - tgtEffDef(target) * 0.4) * eff * skillMult));
              applyDamage(target, dmg);
              const slept = rand() < 0.8 && target.current > 0;
              if (slept && !isCCImmune(target)) target.sleepTurns = Math.max(target.sleepTurns, 2);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano${slept ? ` + 💤 ${target.name} adormeceu por 2 turnos!` : ""}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "freeze_strike") {
            // Dano gélido no alvo + 80% chance de congelar por 2 turnos
            const target = pickTarget(attacker, enemies);
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const dmg = Math.max(1, Math.round((effAtk * 1.6 - tgtEffDef(target) * 0.5) * eff * skillMult));
              applyDamage(target, dmg);
              const frozen = rand() < 0.8 && target.current > 0;
              if (frozen && !isCCImmune(target)) target.freezeTurns = Math.max(target.freezeTurns, 2);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano${frozen ? ` + ❄️ ${target.name} congelou por 2 turnos!` : ""}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "ash_breath") {
            // Dano mágico no alvo + reduz DEF em 20% por 2 turnos
            const target = pickTarget(attacker, enemies);
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const dmg = Math.max(1, Math.round((effInt * 1.5 - tgtEffDef(target) * 0.4) * eff * skillMult));
              applyDamage(target, dmg);
              if (target.current > 0) {
                target.defDebuffPct = Math.max(target.defDebuffPct, 0.2);
                target.defDebuffTurns = Math.max(target.defDebuffTurns, 2);
              }
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano${target.current > 0 ? ` + 🪨 DEF de ${target.name} -20% por 2 turnos` : ""}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "chill_heal") {
            // Cura o aliado mais ferido por INT*1.3 e reduz ATK do inimigo mais forte em 15% por 2 turnos
            const aliveAllies = allies.filter((m) => m.current > 0);
            const wounded =
              aliveAllies
                .filter((m) => m.current < m.maxHp)
                .sort((x, y) => x.current / x.maxHp - y.current / y.maxHp)[0] ?? aliveAllies[0];
            const heal = Math.round(effInt * 1.3 * skillMult);
            let healed = 0;
            if (wounded) {
              const before = wounded.current;
              wounded.current = Math.min(wounded.maxHp, wounded.current + heal);
              healed = wounded.current - before;
            }
            const aliveEnemies = enemies.filter((e) => e.current > 0);
            const strongest = aliveEnemies.length ? aliveEnemies.reduce((x, y) => (x.atk > y.atk ? x : y)) : null;
            if (strongest) {
              strongest.atkDebuffPct = Math.max(strongest.atkDebuffPct, 0.15);
              strongest.atkDebuffTurns = Math.max(strongest.atkDebuffTurns, 2);
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: wounded?.name ?? attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: wounded?.current ?? attacker.current,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: curou ${wounded?.name ?? "—"} em ${healed} HP${strongest ? ` + 🥶 ATK de ${strongest.name} -15% por 2 turnos` : ""}`,
            });
            return;
          }

          if (skill.kind === "frost_pounce") {
            // Crit garantido no inimigo mais fraco (menor HP atual) + 40% chance de congelar 1 turno
            const aliveEnemies = enemies.filter((e) => e.current > 0);
            const target = aliveEnemies.length ? aliveEnemies.reduce((x, y) => (x.current < y.current ? x : y)) : null;
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target) * 0.4);
              const dmg = Math.max(1, Math.round(base * eff * 1.8 * 1.7 * skillMult));
              applyDamage(target, dmg);
              const frozen = rand() < 0.4 && target.current > 0;
              if (frozen && !isCCImmune(target)) target.freezeTurns = Math.max(target.freezeTurns, 1);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} CRÍTICO em ${target.name}${frozen ? ` + ❄️ congelou por 1 turno!` : ""}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "turtle_shell") {
            // Escudo (30% HP máx) + reduz dano recebido em 20% por 2 turnos
            const shieldAmt = Math.round(attacker.maxHp * 0.3 * skillMult);
            attacker.shield = Math.max(attacker.shield, shieldAmt);
            attacker.dmgReductionPct = Math.max(attacker.dmgReductionPct, 0.2);
            attacker.dmgReductionTurns = Math.max(attacker.dmgReductionTurns, 2);
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              targetShield: attacker.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: 🛡️ +${shieldAmt} escudo e -20% dano recebido por 2 turnos`,
            });
            return;
          }

          if (skill.kind === "doom_curse") {
            // Maldição no inimigo com mais HP atual: -20% ATK e -20% DEF por 3 turnos
            const aliveEnemies = enemies.filter((e) => e.current > 0);
            const target = aliveEnemies.length ? aliveEnemies.reduce((x, y) => (x.current > y.current ? x : y)) : null;
            if (target) {
              target.atkDebuffPct = Math.max(target.atkDebuffPct, 0.2);
              target.atkDebuffTurns = Math.max(target.atkDebuffTurns, 3);
              target.defDebuffPct = Math.max(target.defDebuffPct, 0.2);
              target.defDebuffTurns = Math.max(target.defDebuffTurns, 3);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: 0,
                crit: false,
                effective: 1,
                remainingHp: target.current,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: 🪶 ${target.name} amaldiçoado (-20% ATK e DEF por 3 turnos)`,
              });
            }
            return;
          }

          if (skill.kind === "pounce_stun") {
            const aliveEnemies = enemies.filter((e) => e.current > 0);
            const target = aliveEnemies.length ? aliveEnemies.reduce((x, y) => (x.current < y.current ? x : y)) : null;
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target) * 0.4);
              const dmg = Math.max(1, Math.round(base * eff * 1.8 * 1.7 * skillMult));
              applyDamage(target, dmg);
              const stunChance = attacker.species === "pterossauro" ? 0.4 : 0.3;
              const stunned = rand() < stunChance && target.current > 0;
              if (stunned && !isCCImmune(target)) target.stunTurns = Math.max(target.stunTurns, 1);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} CRÍTICO em ${target.name}${stunned ? ` + ⚡ atordoou por 1 turno!` : ""}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "spectral_pounce") {
            const aliveEnemies = enemies.filter((e) => e.current > 0);
            const target = aliveEnemies.length ? aliveEnemies.reduce((x, y) => (x.current < y.current ? x : y)) : null;
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              // Escala de velocidade: +2% de dano por SPD a mais que o alvo, máx +60%
              const spdAdvantage = Math.max(0, effectiveSpd(attacker) - effectiveSpd(target));
              const spdBonus = Math.min(0.6, spdAdvantage * 0.02);
              const mult = 1.2 + spdBonus;
              const base = Math.max(1, effAtk * mult - tgtEffDef(target));
              const dmg = Math.max(1, Math.round(base * eff * skillMult));
              applyDamage(target, dmg);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} em ${target.name}${spdBonus > 0 ? ` (+${Math.round(spdBonus * 100)}% por velocidade)` : ""}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "lightning_charge") {
            const aliveEnemies = enemies.filter((e) => e.current > 0);
            const target = aliveEnemies.length ? aliveEnemies.reduce((x, y) => (x.atk > y.atk ? x : y)) : null;
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const base1 = Math.max(1, effAtk * 1.3 - tgtEffDef(target));
              const dmg1 = Math.max(1, Math.round(base1 * eff * skillMult));
              applyDamage(target, dmg1);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg1,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg1} em ${target.name}`,
              });
              // Segundo golpe se for mais rápido
              if (target.current > 0 && effectiveSpd(attacker) > effectiveSpd(target)) {
                const base2 = Math.max(1, effAtk * 0.7 - tgtEffDef(target));
                const dmg2 = Math.max(1, Math.round(base2 * eff * skillMult));
                applyDamage(target, dmg2);
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: dmg2,
                  crit: false,
                  effective: eff,
                  remainingHp: target.current,
                  targetShield: target.shield,
                  message: `⚡ ${attacker.name} é mais rápido e desfere um segundo golpe: ${dmg2} em ${target.name}`,
                });
              }
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "forest_balance") {
            const heal = Math.round(effInt * 1.5 * skillMult);
            for (const t of allies.filter((m) => m.current > 0)) {
              t.current = Math.min(t.maxHp, t.current + heal);
            }
            const shield = Math.round(attacker.maxHp * 0.25 * skillMult);
            attacker.shield += shield;
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: "todos os aliados",
              damage: -heal,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              targetShield: attacker.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: curou todos em ${heal} HP e ganhou ${shield} de escudo`,
            });
            return;
          }

          if (skill.kind === "crystal_resonance") {
            const heal = Math.round(effInt * 1.2 * skillMult);
            for (const t of allies.filter((m) => m.current > 0)) {
              t.current = Math.min(t.maxHp, t.current + heal);
              t.defBuffPct = Math.max(t.defBuffPct, 0.15);
              t.defBuffTurns = Math.max(t.defBuffTurns, 2);
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: "todos os aliados",
              damage: -heal,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: curou todos em ${heal} HP + 💎 DEF do time +15% por 2 turnos`,
            });
            return;
          }

          if (skill.kind === "cooldown_reduction") {
            const targets = allies.filter((m) => m.current > 0 && m.skillCd > 0 && m.id !== attacker.id);
            const reduced: string[] = [];
            for (const t of targets) {
              t.skillCd = Math.max(0, t.skillCd - 1);
              reduced.push(t.name);
            }
            const reducedStr = reduced.length ? reduced.join(", ") : "ninguém — todos aliados já estavam prontos";
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: reducedStr,
              targetNames: reduced,
              targetTeam: "actor",
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              message: reduced.length
                ? `${skill.emoji} ${attacker.name} usou ${skill.name} em ${reducedStr}: -1 turno de cooldown`
                : `${skill.emoji} ${attacker.name} usou ${skill.name}, mas não reduziu cooldown de ninguém`,
            });
            return;
          }

          if (skill.kind === "king_roar") {
            const aliveEnemies = enemies.filter((e) => e.current > 0);
            const target = aliveEnemies.length ? aliveEnemies.reduce((x, y) => (x.atk > y.atk ? x : y)) : null;
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target));
              const dmg = Math.max(1, Math.round(base * eff * 2.5 * skillMult));
              applyDamage(target, dmg);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} DEVASTADOR em ${target.name}!`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi devorado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "horn_charge") {
            const shield = Math.round(attacker.maxHp * 0.35 * skillMult);
            attacker.shield += shield;
            for (const e of enemies.filter((x) => x.current > 0)) {
              e.tauntTargetId = attacker.id;
              e.tauntTurns = 2;
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              targetShield: attacker.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}! Provocou todos e ganhou ${shield} de escudo (🦕 reflete 15% do dano)`,
            });
            return;
          }

          if (skill.kind === "thorn_burst") {
            const targets = enemies.filter((e) => e.current > 0);
            for (const t of targets) {
              const eff = defensiveMultiplier(getElement(attacker.species), t.species);
              const base = Math.max(1, attacker.atk - t.def * 0.5);
              const dmg = Math.max(1, Math.round(base * eff * 1.0 * skillMult));
              applyDamage(t, dmg);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: t.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: t.current,
                targetShield: t.shield,
                message: `${skill.emoji} ${attacker.name} → ${t.name}: ${dmg} de dano de espinhos`,
              });
              if (t.current <= 0) {
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: t.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${t.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "arcane_mark") {
            const targets = enemies.filter((e) => e.current > 0);
            const markedNames: string[] = [];
            const consumedNames: string[] = [];
            for (const t of targets) {
              const eff = defensiveMultiplier(getElement(attacker.species), t.species);
              const base = Math.max(1, attacker.int * 1.4 - t.def * 0.4);
              const wasMarked = t.markTurns > 0;
              const markBonus = wasMarked ? 1.5 : 1.0;
              const dmg = Math.max(1, Math.round(base * eff * markBonus * skillMult));
              applyDamage(t, dmg);
              if (wasMarked) {
                t.markTurns = 0; // consome a marca
                consumedNames.push(t.name);
              } else if (t.current > 0 && !isCCImmune(t)) {
                t.markTurns = 3; // aplica a marca por 3 turnos
                markedNames.push(t.name);
              }
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: t.name,
                damage: dmg,
                crit: wasMarked,
                effective: eff,
                remainingHp: t.current,
                targetShield: t.shield,
                message: `${skill.emoji} ${attacker.name} → ${t.name}: ${dmg} de dano arcano${wasMarked ? " 💥 (marca detonada +50%)" : " 🏴 (marcado)"}`,
              });
              if (t.current <= 0) {
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: t.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${t.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "night_mark") {
            // Coruja Branca: aplica 🏴 Marca da Morte em todos os inimigos por 2 turnos
            // e concede +15% SPD a todos os aliados por 2 turnos (efeito de revelar fraquezas).
            const targets = enemies.filter((e) => e.current > 0);
            const markedNames: string[] = [];
            for (const t of targets) {
              if (!isCCImmune(t)) {
                t.markTurns = Math.max(t.markTurns, 2);
                t.markPassiveProcessed = false;
                markedNames.push(t.name);
              }
            }
            const aliveAllies = allies.filter((m) => m.current > 0);
            for (const m of aliveAllies) {
              m.spdBuffPct = Math.max(m.spdBuffPct, 0.15);
              m.spdBuffTurns = Math.max(m.spdBuffTurns, 2);
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}: 🏴 marcou ${markedNames.length ? markedNames.join(", ") : "ninguém"} por 2 turnos + aliados ganham +15% SPD por 2 turnos`,
            });
            return;
          }



          if (skill.kind === "cleanse_shield") {
            const shield = Math.round(attacker.maxHp * 0.25 * skillMult);
            attacker.shield += shield;
            const cleansed: string[] = [];
            for (const m of allies.filter((x) => x.current > 0)) {
              const had =
                m.sleepTurns > 0 || m.freezeTurns > 0 || m.silenceTurns > 0 ||
                m.blindTurns > 0 || m.stunTurns > 0 || m.markTurns > 0 ||
                m.burnTurns > 0 || m.bleedTurns > 0 ||
                m.defDebuffTurns > 0 || m.atkDebuffTurns > 0;
              if (had) {
                m.sleepTurns = 0;
                m.freezeTurns = 0;
                m.silenceTurns = 0;
                m.blindTurns = 0;
                m.stunTurns = 0;
                m.markTurns = 0;
                m.burnTurns = 0; m.burnDmg = 0;
                m.bleedTurns = 0; m.bleedDmg = 0;
                m.defDebuffTurns = 0; m.defDebuffPct = 0;
                m.atkDebuffTurns = 0; m.atkDebuffPct = 0;
                cleansed.push(m.name);
              }
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              targetShield: attacker.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}! ${cleansed.length ? `Purificou ${cleansed.join(", ")} e ganhou` : "Ganhou"} ${shield} de escudo`,
            });
            return;
          }



          if (skill.kind === "terror_screech") {
            const targets = enemies.filter((e) => e.current > 0);
            for (const t of targets) {
              t.atkDebuffPct = Math.max(t.atkDebuffPct, 0.20);
              t.atkDebuffTurns = Math.max(t.atkDebuffTurns, 3); // 3 pra durar 2 turnos completos após o decremento inicial
            }
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              message: `${skill.emoji} ${attacker.name} soltou ${skill.name}! Todos os inimigos -20% ATK por 2 turnos 😱`,
            });
            return;
          }

          if (skill.kind === "spectral_hunger") {
            for (let hit = 0; hit < 2; hit++) {
              const aliveEnemies = enemies.filter((e) => e.current > 0);
              if (aliveEnemies.length === 0) break;
              const target = aliveEnemies.reduce((x, y) => (x.current < y.current ? x : y));
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const dmg = Math.max(1, Math.round(effInt * 2.2 * eff * skillMult));
              const wasAlive = target.current > 0;
              applyDamage(target, dmg);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} ${hit === 0 ? `usou ${skill.name}` : "devorou outro!"}: ${dmg} de dano espectral em ${target.name} (ignora DEF)`,
              });
              if (target.current <= 0) {
                if (wasAlive) target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi consumido!`,
                });
              } else {
                break; // só encadeia se matou
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
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: dmg,
                  crit: true,
                  effective: eff,
                  remainingHp: target.current,
                  targetShield: target.shield,
                  message: `${skill.emoji} ${attacker.name} ${skill.name} (golpe ${hit + 1}/2): ${dmg} em ${target.name}`,
                });
              }
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "corsair_volley") {
            for (let hit = 0; hit < 3; hit++) {
              const alive = enemies.filter((e) => e.current > 0);
              if (alive.length === 0) break;
              const target = alive[Math.floor(rand() * alive.length)];
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const base = Math.max(1, effAtk * 0.4 - tgtEffDef(target) * 0.5);
              const dmg = Math.max(1, Math.round(base * eff * skillMult));
              applyDamage(target, dmg);
              // 20% chance de aplicar sangramento, sem refrescar stack existente
              let bled = false;
              if (
                target.current > 0 &&
                target.bleedTurns === 0 &&
                !isCCImmune(target) &&
                rand() < 0.20
              ) {
                const dot = Math.max(1, Math.round(effAtk * 0.15 * skillMult));
                target.bleedDmg = dot;
                target.bleedTurns = 2;
                bled = true;
              }
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} ${skill.name} (rajada ${hit + 1}/3): ${dmg} em ${target.name}${bled ? " 🩸 (sangrando)" : ""}`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }



          if (skill.kind === "shield_ally") {
            const hurt =
              allies
                .filter((m) => m.current > 0 && m.current < m.maxHp)
                .sort((x, y) => x.current / x.maxHp - y.current / y.maxHp)[0] ??
              allies.find((m) => m.current > 0) ??
              attacker;
            const shield = Math.round(effInt * 1.4 * skillMult);
            hurt.shield += shield;
            hurt.defBuffPct = Math.max(hurt.defBuffPct, 0.3);
            hurt.defBuffTurns = Math.max(hurt.defBuffTurns, 2);
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: hurt.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: hurt.current,
              targetShield: hurt.shield,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name} em ${hurt.name}: +${shield} escudo e +30% DEF por 2 turnos`,
            });
            return;
          }

          if (skill.kind === "chain_lightning") {
            const aliveTargets = enemies
              .filter((e) => e.current > 0)
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
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: t.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: t.current,
                targetShield: t.shield,
                message: `${skill.emoji} ${attacker.name} ${skill.name} (salto ${i + 1}): ${dmg} em ${t.name}`,
              });
              if (t.current <= 0) {
                t.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: t.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${t.name} foi derrotado!`,
                });
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
              if (!isCCImmune(target)) target.silenceTurns = Math.max(target.silenceTurns, 2);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: false,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} em ${target.name} e 🤐 silenciou próxima skill`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi derrotado!`,
                });
              }
            }
            return;
          }

          if (skill.kind === "berserker_rage") {
            attacker.rageAtkMult = 0.65 * skillMult;
            attacker.rageDefDrop = 0.25;
            attacker.rageTurns = 3;
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              message: `${skill.emoji} ${attacker.name} usou ${skill.name}! +${Math.round(attacker.rageAtkMult * 100)}% ATK e -25% DEF por 3 turnos`,
            });
            return;
          }

          if (skill.kind === "revive_ally") {
            const fallen = allies.filter((m) => m.current <= 0).sort((x, y) => y.lastFallenAt - x.lastFallenAt)[0];
            if (fallen) {
              fallen.current = Math.round(fallen.maxHp * 0.4);
              fallen.shield = 0;
              fallen.burnTurns = 0;
              fallen.bleedTurns = 0;
              fallen.blindTurns = 0;
              fallen.sleepTurns = 0;
              fallen.freezeTurns = 0;
              fallen.silenceTurns = 0;
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: fallen.name,
                damage: -fallen.current,
                crit: false,
                effective: 1,
                remainingHp: fallen.current,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}! ✨ ${fallen.name} foi ressuscitado com ${fallen.current} HP`,
              });
            } else {
              // Sem ninguém pra ressuscitar — cura todo o time
              const heal = Math.round((effInt * 1.6 + attacker.maxHp * 0.1) * skillMult);
              for (const t of allies.filter((m) => m.current > 0)) {
                t.current = Math.min(t.maxHp, t.current + heal);
              }
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: "todos os aliados",
                damage: -heal,
                crit: false,
                effective: 1,
                remainingHp: 0,
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
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: 1,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} de dano VERDADEIRO em ${target.name}!`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi reduzido a pó!`,
                });
              }
            }
            return;
          }

          // ===== FÊNIX VERMELHA — Brasa Renascida =====
          // Golpe de fogo amplificado pela passiva (effAtk já inclui phoenixAtkBonus)
          if (skill.kind === "phoenix_rage") {
            const target = pickTarget(attacker, enemies);
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target));
              const dmg = Math.max(1, Math.round(base * eff * 2.0 * skillMult));
              applyDamage(target, dmg);
              const bonusPct = Math.round((phoenixAtkBonus(attacker) - 1) * 100);
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} em ${target.name} (🔥 +${bonusPct}% ATK por HP perdido!)`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} foi incinerado!`,
                });
              }
            }
            return;
          }

          // ===== FÊNIX NEGRA — Comunhão Sombria =====
          // Golpe sombrio: dano causado vira HP máx adicional + cura
          if (skill.kind === "phoenix_growth") {
            const target = pickTarget(attacker, enemies);
            if (target) {
              const eff = defensiveMultiplier(getElement(attacker.species), target.species);
              const base = Math.max(1, effAtk * 2 - tgtEffDef(target));
              const dmg = Math.max(1, Math.round(base * eff * 2.0 * skillMult));
              applyDamage(target, dmg);
              phoenixOnDamageDealt(attacker, dmg);
              const grown = Math.max(1, Math.round(dmg * 0.04));
              log.push({
                turn,
                actor: side,
                actorName: attacker.name,
                targetName: target.name,
                damage: dmg,
                crit: true,
                effective: eff,
                remainingHp: target.current,
                targetShield: target.shield,
                message: `${skill.emoji} ${attacker.name} usou ${skill.name}: ${dmg} em ${target.name} (🌑 absorveu +${grown} HP máx!)`,
              });
              if (target.current <= 0) {
                target.lastFallenAt = turn;
                log.push({
                  turn,
                  actor: side,
                  actorName: attacker.name,
                  targetName: target.name,
                  damage: 0,
                  crit: false,
                  effective: 1,
                  remainingHp: 0,
                  message: `💀 ${target.name} teve a essência devorada!`,
                });
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
            const heal = Math.round(
              (attacker.int * 2.2 + attacker.maxHp * 0.08) * RARITY_INFO[attacker.rarity].skillMult,
            );
            hurt.current = Math.min(hurt.maxHp, hurt.current + heal);
            attacker.healCd = 2;
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: hurt.name,
              damage: -heal,
              crit: false,
              effective: 1,
              remainingHp: hurt.current,
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
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: target.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: target.current,
              message: `😵‍💫 ${attacker.name} errou o ataque (cegueira)!`,
            });
            return;
          }
        }

        // Esquiva por velocidade: 5% base + 3.5% por ponto de SPD a mais que o atacante
        // mínimo 5% (sempre há chance), máximo 55%
        const spdDiff = effectiveSpd(target) - effectiveSpd(attacker);
        // PASSIVA Tigre Relâmpago: +4% de esquiva a cada 10 pontos de SPD
        const tigerDodgeBonus = target.species === "tigre_relampago"
          ? Math.floor(effectiveSpd(target) / 10) * 0.04
          : 0;
        const baseDodge = Math.max(0.05, Math.min(0.75, 0.05 + spdDiff * 0.035 + tigerDodgeBonus));
        // 🏴 Marca da Morte: zera a esquiva contra ataques básicos
        const dodgeChance = target.markTurns > 0 ? 0 : baseDodge;
        if (dodgeChance > 0 && rand() < dodgeChance) {
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: target.name,
            damage: 0,
            crit: false,
            effective: 1,
            remainingHp: target.current,
            message: `💨 ${target.name} esquivou do ataque! (${Math.round(dodgeChance * 100)}% de esquiva)`,
          });
          return;
        }

        const eff = defensiveMultiplier(getElement(attacker.species), target.species);
        const synCrit = side === "team_a" ? critBonusA : critBonusB;
        const baseCrit = attacker.role === "assassin" ? 0.35 : 0.12;
        const passiveCritFloor = attacker.species === "raposa_espectral" ? 0.3 : 0;
        const trainedCrit = (attacker.crit || 0) * 0.02;
        const critChance = Math.max(passiveCritFloor, Math.min(0.95, baseCrit + synCrit + trainedCrit));
        // PASSIVA Leopardo Fantasma: crítico garantido se for mais rápido que o alvo
        const leopardFaster = attacker.species === "leopardo_fantasma" && effectiveSpd(attacker) > effectiveSpd(target);
        const crit = leopardFaster || rand() < critChance;
        const defUsed = attacker.role === "mage" ? target.def * 0.4 : target.def;
        const atkStat = attacker.role === "mage" ? attacker.int : attacker.atk * phoenixAtkBonus(attacker);
        let base = Math.max(1, atkStat * 2 - defUsed);
        if (attacker.role === "dps") base *= 1.15;
        const variance = 0.85 + rand() * 0.3;
        const damage = Math.max(1, Math.round(base * eff * variance * (crit ? 1.7 : 1)));
        applyDamage(target, damage);
        const phoenixGrow = phoenixOnDamageDealt(attacker, damage);

        // PASSIVA Borboleta Sonífera: 50% de chance de adormecer o alvo por 2 turnos
        let sleptByPassive = false;
        if (attacker.species === "borboleta_sonifera" && target.current > 0 && !isCCImmune(target) && rand() < 0.5) {
          target.sleepTurns = Math.max(target.sleepTurns, 2);
          sleptByPassive = true;
        }
        // PASSIVA Urso Polar: 50% de chance de congelar o alvo por 2 turnos
        let frozenByPassive = false;
        if (attacker.species === "urso_polar" && target.current > 0 && !isCCImmune(target) && rand() < 0.5) {
          target.freezeTurns = Math.max(target.freezeTurns, 2);
          frozenByPassive = true;
        }
        // PASSIVA Leoa Trovão: 30% de chance de paralisar o alvo por 1 turno
        let stunnedByPassive = false;
        if (attacker.species === "leoa_trovao" && target.current > 0 && !isCCImmune(target) && rand() < 0.3) {
          target.stunTurns = Math.max(target.stunTurns, 1);
          stunnedByPassive = true;
        }

        // PASSIVA Lobo da Lua Sangrenta: cura 30% do dano causado a cada ataque básico
        let lifestealHealed = 0;
        if (attacker.species === "lobo_lua_sangrenta" && damage > 0) {
          lifestealHealed = Math.round(damage * 0.30);
          attacker.current = Math.min(attacker.maxHp, attacker.current + lifestealHealed);
        }

        // PASSIVA Triceratops Colossal: reflete 15% do dano recebido em ataques básicos
        let reflected = 0;
        if (target.thornsPct > 0 && damage > 0 && attacker.current > 0 && attacker.species !== target.species) {
          reflected = Math.max(1, Math.round(damage * target.thornsPct));
          applyDamage(attacker, reflected);
        }

        let msg = `${attacker.name} atacou ${target.name} causando ${damage} de dano`;
        if (crit) msg += " (CRÍTICO!)";
        if (attacker.role === "mage") msg += " 🔮";
        if (eff > 1) msg += " (super eficaz!)";
        else if (eff < 1) msg += " (pouco eficaz...)";
        if (phoenixGrow > 0) msg += ` 🌑 (+${phoenixGrow} HP máx)`;
        if (sleptByPassive) msg += ` 💤 ${target.name} adormeceu por 2 turnos!`;
        if (frozenByPassive) msg += ` ❄️ ${target.name} congelou por 2 turnos!`;
        if (stunnedByPassive) msg += ` ⚡ ${target.name} paralisou por 1 turno!`;
        if (lifestealHealed > 0) msg += ` 🩸 (+${lifestealHealed} HP roubado)`;
        if (reflected > 0) msg += ` ${target.species === "porco_espinho" ? "🦔" : "🦕"} (refletiu ${reflected})`;

        log.push({
          turn,
          actor: side,
          actorName: attacker.name,
          targetName: target.name,
          damage,
          crit,
          effective: eff,
          remainingHp: target.current,
          targetShield: target.shield,
          message: msg,
        });

        // Empurra evento de cura pro atacante pra atualizar a barra de vida na cena
        if (lifestealHealed > 0) {
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: attacker.name,
            damage: -lifestealHealed,
            crit: false,
            effective: 1,
            remainingHp: attacker.current,
            message: `🩸 ${attacker.name} recuperou ${lifestealHealed} HP (Roubo de Vida)`,
          });
        }

        if (target.current <= 0) {
          target.lastFallenAt = turn;
          if (attacker.species === "trex" && attacker.current > 0) {
            attacker.killStacks += 1;
            log.push({
              turn,
              actor: side,
              actorName: attacker.name,
              targetName: attacker.name,
              damage: 0,
              crit: false,
              effective: 1,
              remainingHp: attacker.current,
              message: `🦖 ${attacker.name} sente o rugido do rei: +15% ATK permanente (total +${attacker.killStacks * 15}%)`,
            });
          }
          log.push({
            turn,
            actor: side,
            actorName: attacker.name,
            targetName: target.name,
            damage: 0,
            crit: false,
            effective: 1,
            remainingHp: 0,
            message: `💀 ${target.name} foi derrotado!`,
          });
        }
      })();
      // PASSIVA Rato Bomba: detona explosão APÓS cada ator (skill ou ataque)
      sweepDeathExplosions();
      sweepOwlPassive();
    }
    turn += 1;
  }

  const aLiveMons = a.filter((m) => m.current > 0);
  const bLiveMons = b.filter((m) => m.current > 0);
  const aAlive = aLiveMons.length > 0;
  const bAlive = bLiveMons.length > 0;
  let winner: "team_a" | "team_b" | "draw";
  if (aAlive && bAlive) {
    // Tempo esgotado: decide por nº de pets vivos, depois por HP+escudo total
    const aCount = aLiveMons.length;
    const bCount = bLiveMons.length;
    const aTotalHp = aLiveMons.reduce((s, m) => s + m.current + m.shield, 0);
    const bTotalHp = bLiveMons.reduce((s, m) => s + m.current + m.shield, 0);
    let reason = "";
    if (aCount !== bCount) {
      winner = aCount > bCount ? "team_a" : "team_b";
      reason = `${aCount} vs ${bCount} pets vivos`;
    } else if (aTotalHp !== bTotalHp) {
      winner = aTotalHp > bTotalHp ? "team_a" : "team_b";
      reason = `HP+escudo total ${aTotalHp} vs ${bTotalHp}`;
    } else {
      // fallback extremamente raro: decide pelo HP máximo total
      const aMax = aLiveMons.reduce((s, m) => s + m.maxHp, 0);
      const bMax = bLiveMons.reduce((s, m) => s + m.maxHp, 0);
      winner = aMax >= bMax ? "team_a" : "team_b";
      reason = `desempate por HP máximo (${aMax} vs ${bMax})`;
    }
    log.push({
      turn,
      actor: winner,
      actorName: "—",
      targetName: "—",
      damage: 0,
      crit: false,
      effective: 1,
      remainingHp: 0,
      message: `⏱️ Tempo esgotado! Vitória do ${winner === "team_a" ? "Time A" : "Time B"} (${reason}).`,
    });
  } else {
    winner = aAlive ? "team_a" : "team_b";
  }
  return { winner, log };
}

/**
 * Reconstrói o vencedor a partir do estado visível do log até `step` entradas,
 * usando o mesmo critério de desempate de tempo esgotado:
 *   1) mais pets vivos
 *   2) maior HP+escudo total dos vivos
 *   3) maior HP máximo total
 * Usado quando o cronômetro da UI termina antes da animação acabar.
 */
export function computeWinnerFromVisibleLog(
  teamA: BattleMonster[],
  teamB: BattleMonster[],
  log: BattleLogEntry[],
  step: number,
): "team_a" | "team_b" {
  const visible = log.slice(0, Math.max(0, step));
  type S = { hp: number; shield: number; maxHp: number; dead: boolean };
  const mk = (t: BattleMonster[]) => {
    const m = new Map<string, S>();
    for (const x of t) m.set(x.name, { hp: x.hp, shield: 0, maxHp: x.hp, dead: false });
    return m;
  };
  const aState = mk(teamA);
  const bState = mk(teamB);

  for (const e of visible) {
    // morte declarada explicitamente na mensagem
    if (e.damage === 0 && /morreu|💀/.test(e.message)) {
      const s = aState.get(e.targetName) ?? bState.get(e.targetName);
      if (s) { s.hp = 0; s.shield = 0; s.dead = true; }
      continue;
    }
    // alvo no time do ator (heal/escudo em aliado, self-buff)
    const sameTeam = e.targetTeam === "actor" || e.damage < 0;
    const ownerMap =
      sameTeam
        ? (e.actor === "team_a" ? aState : bState)
        : (e.actor === "team_a" ? bState : aState);
    const s = ownerMap.get(e.targetName) ?? aState.get(e.targetName) ?? bState.get(e.targetName);
    if (!s) continue;
    if (typeof e.remainingHp === "number") {
      s.hp = Math.max(0, e.remainingHp);
      if (s.hp <= 0) s.dead = true;
    }
    if (typeof e.targetShield === "number") {
      s.shield = Math.max(0, e.targetShield);
    }
  }

  const aLive = [...aState.values()].filter((s) => !s.dead && s.hp > 0);
  const bLive = [...bState.values()].filter((s) => !s.dead && s.hp > 0);

  if (aLive.length === 0 && bLive.length > 0) return "team_b";
  if (bLive.length === 0 && aLive.length > 0) return "team_a";
  if (aLive.length !== bLive.length) return aLive.length > bLive.length ? "team_a" : "team_b";
  const aTotal = aLive.reduce((s, m) => s + m.hp + m.shield, 0);
  const bTotal = bLive.reduce((s, m) => s + m.hp + m.shield, 0);
  if (aTotal !== bTotal) return aTotal > bTotal ? "team_a" : "team_b";
  const aMax = [...aState.values()].reduce((s, m) => s + m.maxHp, 0);
  const bMax = [...bState.values()].reduce((s, m) => s + m.maxHp, 0);
  return aMax >= bMax ? "team_a" : "team_b";
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
