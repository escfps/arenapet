// ============================================================
// SISTEMA DE GOLPES (estilo Pokémon clássico)
// 18 tipos · categorias Físico/Especial/Status · efeitos secundários
// ============================================================

export type PokeType =
  | "normal" | "fire" | "water" | "electric" | "grass" | "ice"
  | "fighting" | "poison" | "ground" | "flying" | "psychic" | "bug"
  | "rock" | "ghost" | "dragon" | "dark" | "steel" | "fairy";

export const POKE_TYPES: PokeType[] = [
  "normal","fire","water","electric","grass","ice","fighting","poison","ground",
  "flying","psychic","bug","rock","ghost","dragon","dark","steel","fairy",
];

export const TYPE_INFO: Record<PokeType, { name: string; emoji: string; color: string }> = {
  normal:   { name: "Normal",     emoji: "⚪", color: "bg-stone-400 text-stone-950" },
  fire:     { name: "Fogo",       emoji: "🔥", color: "bg-orange-500 text-white" },
  water:    { name: "Água",       emoji: "💧", color: "bg-sky-500 text-white" },
  electric: { name: "Elétrico",   emoji: "⚡", color: "bg-yellow-400 text-yellow-950" },
  grass:    { name: "Grama",      emoji: "🌿", color: "bg-emerald-500 text-white" },
  ice:      { name: "Gelo",       emoji: "❄️", color: "bg-cyan-300 text-cyan-950" },
  fighting: { name: "Lutador",    emoji: "🥊", color: "bg-red-600 text-white" },
  poison:   { name: "Veneno",     emoji: "☠️", color: "bg-purple-600 text-white" },
  ground:   { name: "Terrestre",  emoji: "🌎", color: "bg-amber-600 text-white" },
  flying:   { name: "Voador",     emoji: "🪽", color: "bg-indigo-300 text-indigo-950" },
  psychic:  { name: "Psíquico",   emoji: "🔮", color: "bg-fuchsia-500 text-white" },
  bug:      { name: "Inseto",     emoji: "🐛", color: "bg-lime-500 text-lime-950" },
  rock:     { name: "Pedra",      emoji: "🪨", color: "bg-yellow-700 text-white" },
  ghost:    { name: "Fantasma",   emoji: "👻", color: "bg-violet-700 text-white" },
  dragon:   { name: "Dragão",     emoji: "🐉", color: "bg-indigo-600 text-white" },
  dark:     { name: "Sombrio",    emoji: "🌑", color: "bg-neutral-800 text-white" },
  steel:    { name: "Aço",        emoji: "⚙️", color: "bg-slate-400 text-slate-950" },
  fairy:    { name: "Fada",       emoji: "✨", color: "bg-pink-400 text-pink-950" },
};

// ===== Tabela de efetividade (atacante -> defensor) =====
// Só as entradas diferentes de 1× são listadas.
export const POKE_TYPE_CHART: Record<PokeType, Partial<Record<PokeType, number>>> = {
  normal:   { rock: 0.5, steel: 0.5, ghost: 0 },
  fire:     { grass: 2, ice: 2, bug: 2, steel: 2, fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5 },
  water:    { fire: 2, ground: 2, rock: 2, water: 0.5, grass: 0.5, dragon: 0.5 },
  electric: { water: 2, flying: 2, electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0 },
  grass:    { water: 2, ground: 2, rock: 2, fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, dragon: 0.5, steel: 0.5 },
  ice:      { grass: 2, ground: 2, flying: 2, dragon: 2, fire: 0.5, water: 0.5, ice: 0.5, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison:   { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground:   { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying:   { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, steel: 0.5, dark: 0 },
  bug:      { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, poison: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5 },
  rock:     { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost:    { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel:    { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy:    { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

/** Multiplicador de um golpe do tipo `moveType` contra um defensor de 1 ou 2 tipos. */
export function typeMultiplier(moveType: PokeType, defTypes: PokeType[]): number {
  let m = 1;
  for (const t of defTypes) {
    m *= POKE_TYPE_CHART[moveType]?.[t] ?? 1;
  }
  return m;
}

export function effectivenessLabel(mult: number): string {
  if (mult === 0) return "Não afeta";
  if (mult >= 4) return "Super efetivo x4!";
  if (mult >= 2) return "Super efetivo!";
  if (mult <= 0.25) return "Quase não afeta";
  if (mult < 1) return "Pouco efetivo";
  return "Neutro";
}

// ===== Efeitos secundários =====
export type MoveEffectKind =
  | "burn"        // 🔥 queimar (DoT)
  | "paralyze"    // ⚡ paralisar (perde turno)
  | "freeze"      // ❄️ congelar
  | "poison"      // ☠️ envenenar (DoT)
  | "sleep"       // 😴 dormir
  | "confuse"     // 💫 confundir (pode se acertar)
  | "atk_down" | "def_down" | "spd_down"
  | "atk_up" | "def_up" | "spd_up"
  | "heal"        // 💚 recupera HP próprio
  | "shield"      // 🛡️ escudo
  | "crit"        // 💥 dano crítico garantido
  | "drain"       // 🩸 rouba HP (% do dano)
  | "cleanse"     // 🌀 remove debuffs próprios
  | "silence";    // 🤐 silencia (anula a skill do alvo)

export type MoveEffect = {
  kind: MoveEffectKind;
  chance?: number;  // 0..1 (default 1)
  turns?: number;   // duração
  value?: number;   // % (buff/debuff/heal/drain)
};

export type MoveCategory = "physical" | "special" | "status";
export type MoveTarget = "single" | "all" | "self" | "lowest" | "highest";

export type Move = {
  id: string;
  name: string;
  type: PokeType;
  category: MoveCategory;
  /** multiplicador de dano sobre o golpe base (1 = ataque normal). 0 para status. */
  power: number;
  /** turnos de recarga (0 = pode usar sempre). */
  cooldown: number;
  target: MoveTarget;
  effect?: MoveEffect;
  description: string;
};

const mv = (
  id: string, name: string, type: PokeType, category: MoveCategory,
  power: number, cooldown: number, description: string,
  effect?: MoveEffect, target: MoveTarget = "single",
): Move => ({ id, name, type, category, power, cooldown, target, effect, description });

// ===== Biblioteca de golpes =====
export const MOVES: Record<string, Move> = Object.fromEntries([
  // --- NORMAL ---
  mv("tackle", "Tackle", "normal", "physical", 0.95, 0, "Investida simples."),
  mv("quick_attack", "Quick Attack", "normal", "physical", 1.0, 0, "Golpe veloz que quase nunca falha."),
  mv("body_slam", "Body Slam", "normal", "physical", 1.35, 3, "Corpo inteiro no alvo; pode paralisar.", { kind: "paralyze", chance: 0.3, turns: 1 }),
  mv("hyper_beam", "Hyper Beam", "normal", "special", 1.9, 5, "Raio devastador de energia pura."),
  mv("slash", "Slash", "normal", "physical", 1.2, 2, "Corte preciso com alta chance de crítico.", { kind: "crit", chance: 0.5 }),
  mv("swords_dance", "Swords Dance", "normal", "status", 0, 4, "Aumenta muito o próprio Ataque.", { kind: "atk_up", turns: 3, value: 0.4 }, "self"),
  mv("growl", "Growl", "normal", "status", 0, 3, "Reduz o Ataque de todos os inimigos.", { kind: "atk_down", turns: 2, value: 0.2 }, "all"),
  mv("agility", "Agility", "normal", "status", 0, 4, "Aumenta muito a própria Velocidade.", { kind: "spd_up", turns: 3, value: 0.35 }, "self"),
  mv("harden", "Harden", "normal", "status", 0, 3, "Endurece o corpo e aumenta a Defesa.", { kind: "def_up", turns: 3, value: 0.35 }, "self"),
  mv("rest", "Rest", "normal", "status", 0, 5, "Recupera muito HP.", { kind: "heal", value: 0.4 }, "self"),
  mv("recover", "Recover", "normal", "status", 0, 4, "Recupera HP.", { kind: "heal", value: 0.3 }, "self"),
  mv("refresh", "Refresh", "normal", "status", 0, 4, "Limpa os próprios efeitos negativos.", { kind: "cleanse" }, "self"),

  // --- FOGO ---
  mv("ember", "Ember", "fire", "special", 0.95, 0, "Brasa que pode queimar.", { kind: "burn", chance: 0.15, turns: 2 }),
  mv("flame_charge", "Flame Charge", "fire", "physical", 1.05, 2, "Investida flamejante que aumenta a Velocidade.", { kind: "spd_up", turns: 2, value: 0.2 }),
  mv("flamethrower", "Flamethrower", "fire", "special", 1.3, 3, "Jato de fogo contínuo; pode queimar.", { kind: "burn", chance: 0.3, turns: 3 }),
  mv("fire_fang", "Fire Fang", "fire", "physical", 1.2, 2, "Mordida em brasa; pode queimar.", { kind: "burn", chance: 0.25, turns: 2 }),
  mv("fire_blast", "Fire Blast", "fire", "special", 1.6, 4, "Explosão de fogo em todos os inimigos.", { kind: "burn", chance: 0.2, turns: 2 }, "all"),
  mv("will_o_wisp", "Will-O-Wisp", "fire", "status", 0, 3, "Chama fantasma que queima o alvo.", { kind: "burn", turns: 3 }, "highest"),

  // --- ÁGUA ---
  mv("water_gun", "Water Gun", "water", "special", 0.95, 0, "Jato de água."),
  mv("aqua_tail", "Aqua Tail", "water", "physical", 1.3, 3, "Cauda em espiral d'água."),
  mv("waterfall", "Waterfall", "water", "physical", 1.2, 2, "Sobe a correnteza e golpeia.", { kind: "crit", chance: 0.3 }),
  mv("surf", "Surf", "water", "special", 1.45, 4, "Onda gigante que atinge todos.", undefined, "all"),
  mv("hydro_pump", "Hydro Pump", "water", "special", 1.7, 4, "Jato de altíssima pressão."),
  mv("bubble_beam", "Bubble Beam", "water", "special", 1.1, 2, "Bolhas velozes que reduzem a Velocidade.", { kind: "spd_down", chance: 0.5, turns: 2 }),

  // --- ELÉTRICO ---
  mv("thunder_shock", "Thunder Shock", "electric", "special", 0.95, 0, "Choque leve; pode paralisar.", { kind: "paralyze", chance: 0.15, turns: 1 }),
  mv("thunderbolt", "Thunderbolt", "electric", "special", 1.3, 3, "Descarga potente; pode paralisar.", { kind: "paralyze", chance: 0.25, turns: 1 }),
  mv("thunder", "Thunder", "electric", "special", 1.65, 4, "Trovão em todos os inimigos.", { kind: "paralyze", chance: 0.2, turns: 1 }, "all"),
  mv("electro_ball", "Electro Ball", "electric", "special", 1.25, 2, "Esfera elétrica; mais forte contra lentos."),
  mv("thunder_fang", "Thunder Fang", "electric", "physical", 1.2, 2, "Mordida elétrica; pode paralisar.", { kind: "paralyze", chance: 0.25, turns: 1 }),
  mv("nuzzle", "Nuzzle", "electric", "status", 0, 3, "Fricção nas bochechas: paralisa o alvo.", { kind: "paralyze", turns: 1 }, "highest"),
  mv("thunder_wave", "Thunder Wave", "electric", "status", 0, 3, "Onda elétrica que paralisa.", { kind: "paralyze", turns: 1 }, "highest"),

  // --- GRAMA ---
  mv("vine_whip", "Vine Whip", "grass", "physical", 0.95, 0, "Chicotada de cipós."),
  mv("razor_leaf", "Razor Leaf", "grass", "physical", 1.15, 2, "Folhas afiadas com alta chance de crítico.", { kind: "crit", chance: 0.4 }),
  mv("giga_drain", "Giga Drain", "grass", "special", 1.25, 3, "Suga a energia vital do alvo.", { kind: "drain", value: 0.5 }),
  mv("petal_blizzard", "Petal Blizzard", "grass", "physical", 1.4, 4, "Tempestade de pétalas em todos.", undefined, "all"),
  mv("solar_beam", "Solar Beam", "grass", "special", 1.75, 5, "Raio solar concentrado."),
  mv("sleep_powder", "Sleep Powder", "grass", "status", 0, 4, "Pó soporífero que faz o alvo dormir.", { kind: "sleep", turns: 2 }, "highest"),
  mv("synthesis", "Synthesis", "grass", "status", 0, 4, "Fotossíntese que recupera HP.", { kind: "heal", value: 0.32 }, "self"),
  mv("leech_seed", "Leech Seed", "grass", "status", 0, 3, "Semente que envenena e drena o alvo.", { kind: "poison", turns: 3 }, "highest"),

  // --- GELO ---
  mv("ice_shard", "Ice Shard", "ice", "physical", 1.0, 0, "Estilhaço de gelo veloz."),
  mv("ice_fang", "Ice Fang", "ice", "physical", 1.2, 2, "Mordida gélida; pode congelar.", { kind: "freeze", chance: 0.2, turns: 1 }),
  mv("ice_beam", "Ice Beam", "ice", "special", 1.3, 3, "Raio congelante.", { kind: "freeze", chance: 0.25, turns: 1 }),
  mv("blizzard", "Blizzard", "ice", "special", 1.6, 4, "Nevasca em todos os inimigos.", { kind: "freeze", chance: 0.2, turns: 1 }, "all"),
  mv("aurora_veil", "Aurora Veil", "ice", "status", 0, 4, "Véu de luz que aumenta a Defesa.", { kind: "def_up", turns: 3, value: 0.3 }, "self"),

  // --- LUTADOR ---
  mv("karate_chop", "Karate Chop", "fighting", "physical", 1.05, 0, "Golpe de caratê com chance de crítico.", { kind: "crit", chance: 0.3 }),
  mv("brick_break", "Brick Break", "fighting", "physical", 1.25, 2, "Quebra a guarda e reduz a Defesa.", { kind: "def_down", turns: 2, value: 0.2 }),
  mv("close_combat", "Close Combat", "fighting", "physical", 1.7, 4, "Combate total; baixa a própria Defesa.", { kind: "def_down", turns: 2, value: 0.15 }),
  mv("aura_sphere", "Aura Sphere", "fighting", "special", 1.35, 3, "Esfera de aura que nunca erra."),
  mv("bulk_up", "Bulk Up", "fighting", "status", 0, 4, "Aumenta Ataque e Defesa.", { kind: "atk_up", turns: 3, value: 0.3 }, "self"),

  // --- VENENO ---
  mv("acid", "Acid", "poison", "special", 1.0, 0, "Ácido corrosivo que reduz a Defesa.", { kind: "def_down", chance: 0.4, turns: 2, value: 0.15 }),
  mv("poison_fang", "Poison Fang", "poison", "physical", 1.15, 2, "Mordida tóxica.", { kind: "poison", chance: 0.5, turns: 3 }),
  mv("sludge_bomb", "Sludge Bomb", "poison", "special", 1.35, 3, "Bomba de lodo; pode envenenar.", { kind: "poison", chance: 0.4, turns: 3 }),
  mv("toxic", "Toxic", "poison", "status", 0, 3, "Veneno severo no alvo mais forte.", { kind: "poison", turns: 4 }, "highest"),
  mv("venoshock", "Venoshock", "poison", "special", 1.5, 4, "Choque tóxico em todos os inimigos.", { kind: "poison", chance: 0.3, turns: 2 }, "all"),

  // --- TERRESTRE ---
  mv("mud_slap", "Mud-Slap", "ground", "special", 0.95, 0, "Lama nos olhos; reduz a Velocidade.", { kind: "spd_down", chance: 0.5, turns: 2 }),
  mv("bulldoze", "Bulldoze", "ground", "physical", 1.15, 2, "Pisoteia o chão e reduz a Velocidade.", { kind: "spd_down", turns: 2 }),
  mv("dig", "Dig", "ground", "physical", 1.3, 3, "Cava e emerge com força."),
  mv("earthquake", "Earthquake", "ground", "physical", 1.6, 4, "Terremoto que atinge todos.", undefined, "all"),

  // --- VOADOR ---
  mv("gust", "Gust", "flying", "special", 0.95, 0, "Rajada de vento."),
  mv("wing_attack", "Wing Attack", "flying", "physical", 1.1, 0, "Golpe de asas."),
  mv("air_slash", "Air Slash", "flying", "special", 1.3, 3, "Lâmina de ar que pode confundir.", { kind: "confuse", chance: 0.3, turns: 2 }),
  mv("brave_bird", "Brave Bird", "flying", "physical", 1.65, 4, "Investida suicida em alta velocidade."),
  mv("roost", "Roost", "flying", "status", 0, 4, "Pousa e recupera HP.", { kind: "heal", value: 0.3 }, "self"),

  // --- PSÍQUICO ---
  mv("confusion", "Confusion", "psychic", "special", 1.0, 0, "Onda mental; pode confundir.", { kind: "confuse", chance: 0.25, turns: 2 }),
  mv("psybeam", "Psybeam", "psychic", "special", 1.2, 2, "Feixe psíquico; pode confundir.", { kind: "confuse", chance: 0.35, turns: 2 }),
  mv("psychic", "Psychic", "psychic", "special", 1.4, 3, "Poder mental que reduz a Defesa.", { kind: "def_down", chance: 0.4, turns: 2, value: 0.2 }),
  mv("psyshock", "Psyshock", "psychic", "special", 1.3, 3, "Onda que fere o corpo diretamente."),
  mv("psystrike", "Psystrike", "psychic", "special", 1.8, 5, "Golpe psíquico materializado; ignora defesa."),
  mv("dream_eater", "Dream Eater", "psychic", "special", 1.45, 4, "Devora sonhos e rouba HP.", { kind: "drain", value: 0.6 }),
  mv("hypnosis", "Hypnosis", "psychic", "status", 0, 4, "Hipnotiza o alvo, que adormece.", { kind: "sleep", turns: 2 }, "highest"),
  mv("calm_mind", "Calm Mind", "psychic", "status", 0, 4, "Acalma a mente: mais Ataque e Defesa.", { kind: "atk_up", turns: 3, value: 0.3 }, "self"),
  mv("barrier", "Barrier", "psychic", "status", 0, 4, "Barreira psíquica que absorve dano.", { kind: "shield", value: 0.3 }, "self"),

  // --- INSETO ---
  mv("bug_bite", "Bug Bite", "bug", "physical", 1.0, 0, "Mordida de insetos."),
  mv("fury_cutter", "Fury Cutter", "bug", "physical", 1.2, 2, "Cortes sucessivos.", { kind: "crit", chance: 0.35 }),
  mv("x_scissor", "X-Scissor", "bug", "physical", 1.35, 3, "Corte em X que causa sangramento.", { kind: "poison", chance: 0.25, turns: 2 }),
  mv("bug_buzz", "Bug Buzz", "bug", "special", 1.4, 3, "Zumbido que reduz a Defesa.", { kind: "def_down", chance: 0.4, turns: 2, value: 0.2 }),
  mv("string_shot", "String Shot", "bug", "status", 0, 3, "Teia que reduz a Velocidade de todos.", { kind: "spd_down", turns: 2 }, "all"),

  // --- PEDRA ---
  mv("rock_throw", "Rock Throw", "rock", "physical", 1.0, 0, "Atira uma pedra."),
  mv("rock_slide", "Rock Slide", "rock", "physical", 1.35, 3, "Avalanche em todos os inimigos.", undefined, "all"),
  mv("stone_edge", "Stone Edge", "rock", "physical", 1.55, 4, "Lâminas de pedra com crítico garantido.", { kind: "crit" }),
  mv("rock_polish", "Rock Polish", "rock", "status", 0, 4, "Polimento que aumenta a Velocidade.", { kind: "spd_up", turns: 3, value: 0.3 }, "self"),

  // --- FANTASMA ---
  mv("lick", "Lick", "ghost", "physical", 0.95, 0, "Lambida arrepiante; pode paralisar.", { kind: "paralyze", chance: 0.2, turns: 1 }),
  mv("shadow_punch", "Shadow Punch", "ghost", "physical", 1.2, 2, "Soco sombrio que nunca erra."),
  mv("shadow_ball", "Shadow Ball", "ghost", "special", 1.4, 3, "Esfera das sombras; reduz Defesa.", { kind: "def_down", chance: 0.4, turns: 2, value: 0.2 }),
  mv("shadow_claw", "Shadow Claw", "ghost", "physical", 1.25, 2, "Garra espectral com alta chance de crítico.", { kind: "crit", chance: 0.5 }),
  mv("curse", "Curse", "ghost", "status", 0, 4, "Maldição que envenena e enfraquece.", { kind: "poison", turns: 3 }, "highest"),
  mv("night_shade", "Night Shade", "ghost", "special", 1.3, 3, "Ilusão noturna que drena HP.", { kind: "drain", value: 0.4 }),

  // --- DRAGÃO ---
  mv("dragon_breath", "Dragon Breath", "dragon", "special", 1.05, 0, "Sopro dracônico; pode paralisar.", { kind: "paralyze", chance: 0.2, turns: 1 }),
  mv("dragon_claw", "Dragon Claw", "dragon", "physical", 1.3, 3, "Garras dracônicas."),
  mv("dragon_pulse", "Dragon Pulse", "dragon", "special", 1.4, 3, "Onda de energia ancestral."),
  mv("outrage", "Outrage", "dragon", "physical", 1.7, 4, "Fúria descontrolada; pode se confundir.", { kind: "confuse", chance: 0.2, turns: 1 }),
  mv("dragon_dance", "Dragon Dance", "dragon", "status", 0, 4, "Dança que aumenta Ataque e Velocidade.", { kind: "atk_up", turns: 3, value: 0.35 }, "self"),

  // --- SOMBRIO ---
  mv("bite", "Bite", "dark", "physical", 1.0, 0, "Mordida forte."),
  mv("crunch", "Crunch", "dark", "physical", 1.3, 3, "Mastiga e reduz a Defesa.", { kind: "def_down", chance: 0.5, turns: 2, value: 0.2 }),
  mv("dark_pulse", "Dark Pulse", "dark", "special", 1.35, 3, "Pulso de trevas; pode confundir.", { kind: "confuse", chance: 0.3, turns: 2 }),
  mv("night_slash", "Night Slash", "dark", "physical", 1.25, 2, "Corte noturno com crítico alto.", { kind: "crit", chance: 0.5 }),
  mv("foul_play", "Foul Play", "dark", "physical", 1.5, 4, "Usa a força do inimigo contra ele.", undefined, "highest"),
  mv("nasty_plot", "Nasty Plot", "dark", "status", 0, 4, "Plano maligno: Ataque muito maior.", { kind: "atk_up", turns: 3, value: 0.45 }, "self"),
  mv("snarl", "Snarl", "dark", "status", 0, 3, "Rosnado que reduz o Ataque de todos.", { kind: "atk_down", turns: 2, value: 0.2 }, "all"),

  // --- AÇO ---
  mv("metal_claw", "Metal Claw", "steel", "physical", 1.0, 0, "Garras de metal."),
  mv("iron_head", "Iron Head", "steel", "physical", 1.3, 3, "Cabeçada de ferro; pode atordoar.", { kind: "paralyze", chance: 0.3, turns: 1 }),
  mv("flash_cannon", "Flash Cannon", "steel", "special", 1.35, 3, "Canhão de luz; reduz Defesa.", { kind: "def_down", chance: 0.4, turns: 2, value: 0.2 }),
  mv("iron_defense", "Iron Defense", "steel", "status", 0, 4, "Defesa de ferro.", { kind: "def_up", turns: 3, value: 0.4 }, "self"),

  // --- FADA ---
  mv("fairy_wind", "Fairy Wind", "fairy", "special", 0.95, 0, "Brisa encantada."),
  mv("draining_kiss", "Draining Kiss", "fairy", "special", 1.15, 2, "Beijo que rouba HP.", { kind: "drain", value: 0.7 }),
  mv("dazzling_gleam", "Dazzling Gleam", "fairy", "special", 1.4, 4, "Brilho ofuscante em todos.", undefined, "all"),
  mv("moonblast", "Moonblast", "fairy", "special", 1.45, 3, "Poder da lua; reduz o Ataque.", { kind: "atk_down", chance: 0.4, turns: 2, value: 0.2 }),
  mv("moonlight", "Moonlight", "fairy", "status", 0, 4, "Luz da lua que recupera HP.", { kind: "heal", value: 0.33 }, "self"),
  mv("charm", "Charm", "fairy", "status", 0, 3, "Encanta e reduz o Ataque do mais forte.", { kind: "atk_down", turns: 3, value: 0.3 }, "highest"),

  // --- GOLPES CLÁSSICOS (Gen 1) ---
  mv("petal_dance", "Petal Dance", "grass", "special", 1.4, 4, "Dança de pétalas que atinge todos.", undefined, "all"),
  mv("water_pulse", "Water Pulse", "water", "special", 1.1, 2, "Pulso d'água que pode confundir.", { kind: "confuse", chance: 0.25, turns: 2 }, "single"),
  mv("struggle_bug", "Struggle Bug", "bug", "special", 1.0, 2, "Zumbido que reduz o ataque especial.", { kind: "atk_down", turns: 2, value: 0.15 }, "all"),
  mv("poison_sting", "Poison Sting", "poison", "physical", 0.95, 0, "Ferroada que pode envenenar.", { kind: "poison", chance: 0.3, turns: 2 }, "single"),
  mv("twineedle", "Twineedle", "bug", "physical", 1.2, 2, "Duas ferroadas; pode envenenar.", { kind: "poison", chance: 0.35, turns: 2 }, "single"),
  mv("poison_jab", "Poison Jab", "poison", "physical", 1.3, 3, "Estocada tóxica.", { kind: "poison", chance: 0.4, turns: 3 }, "single"),
  mv("aerial_ace", "Aerial Ace", "flying", "physical", 1.2, 2, "Ataque aéreo que nunca erra.", { kind: "crit", chance: 0.3 }, "single"),
  mv("hurricane", "Hurricane", "flying", "special", 1.65, 4, "Furacão que atinge todos e pode confundir.", { kind: "confuse", chance: 0.3, turns: 2 }, "all"),
  mv("hyper_fang", "Hyper Fang", "normal", "physical", 1.25, 2, "Mordida com presas afiadas.", { kind: "crit", chance: 0.25 }, "single"),
  mv("peck", "Peck", "flying", "physical", 0.95, 0, "Bicada rápida.", undefined, "single"),
  mv("drill_peck", "Drill Peck", "flying", "physical", 1.3, 3, "Bico giratório perfurante.", undefined, "single"),
  mv("thunder_punch", "Thunder Punch", "electric", "physical", 1.25, 2, "Soco elétrico; pode paralisar.", { kind: "paralyze", chance: 0.3, turns: 1 }, "single"),
  mv("double_kick", "Double Kick", "fighting", "physical", 1.1, 1, "Dois chutes em sequência.", undefined, "single"),
  mv("earth_power", "Earth Power", "ground", "special", 1.35, 3, "Energia da terra; reduz a Defesa.", { kind: "def_down", chance: 0.4, turns: 2, value: 0.2 }, "single"),
  mv("disarming_voice", "Disarming Voice", "fairy", "special", 1.05, 1, "Voz encantadora que nunca erra.", undefined, "single"),
  mv("play_rough", "Play Rough", "fairy", "physical", 1.3, 3, "Brincadeira bruta; pode baixar o Ataque.", { kind: "atk_down", chance: 0.4, turns: 2, value: 0.2 }, "single"),
  mv("hyper_voice", "Hyper Voice", "normal", "special", 1.4, 4, "Grito ensurdecedor em todos.", undefined, "all"),
  mv("pound", "Pound", "normal", "physical", 0.95, 0, "Pancada simples.", undefined, "single"),
  mv("absorb", "Absorb", "grass", "special", 0.95, 0, "Absorve energia e cura.", { kind: "drain", value: 0.35 }, "single"),
  mv("mega_drain", "Mega Drain", "grass", "special", 1.15, 2, "Drena bastante energia vital.", { kind: "drain", value: 0.45 }, "single"),
  mv("leech_life", "Leech Life", "bug", "physical", 1.15, 2, "Suga o sangue do alvo.", { kind: "drain", value: 0.5 }, "single"),
  mv("seed_bomb", "Seed Bomb", "grass", "physical", 1.25, 2, "Bombardeio de sementes duras.", undefined, "single"),
  mv("scratch", "Scratch", "normal", "physical", 0.95, 0, "Arranhão rápido.", undefined, "single"),
  mv("low_kick", "Low Kick", "fighting", "physical", 1.05, 1, "Rasteira nas pernas do alvo.", undefined, "single"),
  mv("cross_chop", "Cross Chop", "fighting", "physical", 1.4, 3, "Golpe cruzado com alta chance de crítico.", { kind: "crit", chance: 0.5 }, "single"),
  mv("rage_fist", "Rage Fist", "ghost", "physical", 1.35, 3, "Punho carregado de fúria espectral.", undefined, "single"),
  mv("flame_wheel", "Flame Wheel", "fire", "physical", 1.15, 2, "Roda de fogo; pode queimar.", { kind: "burn", chance: 0.25, turns: 2 }, "single"),
  mv("extreme_speed", "Extreme Speed", "normal", "physical", 1.5, 4, "Velocidade extrema: golpeia primeiro.", { kind: "spd_up", turns: 2, value: 0.25 }, "single"),
  mv("dynamic_punch", "Dynamic Punch", "fighting", "physical", 1.55, 4, "Soco brutal que confunde.", { kind: "confuse", chance: 0.6, turns: 2 }, "single"),
  mv("submission", "Submission", "fighting", "physical", 1.35, 3, "Arremesso violento.", undefined, "single"),
  mv("leaf_blade", "Leaf Blade", "grass", "physical", 1.35, 3, "Lâmina de folha; crítico frequente.", { kind: "crit", chance: 0.45 }, "single"),
  mv("sludge_wave", "Sludge Wave", "poison", "special", 1.45, 4, "Onda de lodo em todos.", { kind: "poison", chance: 0.3, turns: 3 }, "all"),
  mv("rock_tomb", "Rock Tomb", "rock", "physical", 1.1, 2, "Pedras que prendem e reduzem a Velocidade.", { kind: "spd_down", turns: 2, value: 0.25 }, "single"),
  mv("stomp", "Stomp", "normal", "physical", 1.15, 2, "Pisão pesado.", undefined, "single"),
  mv("flare_blitz", "Flare Blitz", "fire", "physical", 1.7, 4, "Investida em chamas devastadora.", { kind: "burn", chance: 0.3, turns: 3 }, "single"),
  mv("megahorn", "Megahorn", "bug", "physical", 1.5, 4, "Chifrada colossal.", undefined, "single"),
  mv("mud_bomb", "Mud Bomb", "ground", "special", 1.15, 2, "Bomba de lama que cega.", { kind: "spd_down", chance: 0.5, turns: 2 }, "single"),
  mv("sludge", "Sludge", "poison", "special", 1.1, 2, "Lodo tóxico.", { kind: "poison", chance: 0.35, turns: 2 }, "single"),
  mv("gunk_shot", "Gunk Shot", "poison", "physical", 1.6, 4, "Lixo tóxico atirado com força.", { kind: "poison", chance: 0.5, turns: 3 }, "single"),
  mv("icicle_spear", "Icicle Spear", "ice", "physical", 1.2, 2, "Lanças de gelo em sequência.", undefined, "single"),
  mv("razor_shell", "Razor Shell", "water", "physical", 1.25, 2, "Concha afiada que corta a Defesa.", { kind: "def_down", chance: 0.5, turns: 2, value: 0.2 }, "single"),
  mv("zen_headbutt", "Zen Headbutt", "psychic", "physical", 1.25, 2, "Cabeçada psíquica.", undefined, "single"),
  mv("crabhammer", "Crabhammer", "water", "physical", 1.4, 3, "Martelada de pinça; crítico alto.", { kind: "crit", chance: 0.5 }, "single"),
  mv("guillotine", "Guillotine", "normal", "physical", 1.6, 5, "Pinça guilhotina devastadora.", undefined, "single"),
  mv("spark", "Spark", "electric", "physical", 1.05, 1, "Faísca de contato; pode paralisar.", { kind: "paralyze", chance: 0.3, turns: 1 }, "single"),
  mv("explosion", "Explosion", "normal", "physical", 1.9, 5, "Explosão massiva em todos os inimigos.", undefined, "all"),
  mv("bullet_seed", "Bullet Seed", "grass", "physical", 1.1, 1, "Rajada de sementes.", undefined, "single"),
  mv("bone_club", "Bone Club", "ground", "physical", 1.1, 1, "Clavada de osso.", undefined, "single"),
  mv("bonemerang", "Bonemerang", "ground", "physical", 1.3, 3, "Osso arremessado que volta.", undefined, "single"),
  mv("high_jump_kick", "High Jump Kick", "fighting", "physical", 1.6, 4, "Joelhada aérea arriscada.", undefined, "single"),
  mv("blaze_kick", "Blaze Kick", "fire", "physical", 1.3, 3, "Chute flamejante; crítico alto.", { kind: "burn", chance: 0.3, turns: 2 }, "single"),
  mv("drain_punch", "Drain Punch", "fighting", "physical", 1.25, 3, "Soco que rouba energia.", { kind: "drain", value: 0.5 }, "single"),
  mv("ice_punch", "Ice Punch", "ice", "physical", 1.25, 2, "Soco congelante.", { kind: "freeze", chance: 0.25, turns: 1 }, "single"),
  mv("power_whip", "Power Whip", "grass", "physical", 1.5, 4, "Chicotada brutal de cipós.", undefined, "single"),
  mv("smog", "Smog", "poison", "special", 1.0, 1, "Fumaça tóxica.", { kind: "poison", chance: 0.4, turns: 2 }, "single"),
  mv("rock_blast", "Rock Blast", "rock", "physical", 1.15, 2, "Rajada de pedras.", undefined, "single"),
  mv("drill_run", "Drill Run", "ground", "physical", 1.3, 3, "Perfuração giratória.", { kind: "crit", chance: 0.3 }, "single"),
  mv("egg_bomb", "Egg Bomb", "normal", "physical", 1.35, 3, "Ovo explosivo.", undefined, "single"),
  mv("dizzy_punch", "Dizzy Punch", "normal", "physical", 1.2, 2, "Soco tonteante; pode confundir.", { kind: "confuse", chance: 0.3, turns: 2 }, "single"),
  mv("tri_attack", "Tri Attack", "normal", "special", 1.3, 3, "Três feixes: queima, congela ou paralisa.", { kind: "paralyze", chance: 0.35, turns: 1 }, "single"),
  mv("fire_punch", "Fire Punch", "fire", "physical", 1.25, 2, "Soco flamejante.", { kind: "burn", chance: 0.3, turns: 2 }, "single"),
  mv("take_down", "Take Down", "normal", "physical", 1.35, 3, "Investida com todo o corpo.", undefined, "single"),
  mv("splash", "Splash", "water", "physical", 0.6, 0, "Splash desesperado... quase inútil.", undefined, "single"),
  mv("pin_missile", "Pin Missile", "bug", "physical", 1.2, 2, "Agulhas disparadas em rajada.", undefined, "single"),
  mv("ancient_power", "Ancient Power", "rock", "special", 1.15, 2, "Poder ancestral que pode elevar o Ataque.", { kind: "atk_up", chance: 0.3, turns: 2, value: 0.2 }, "single"),
  mv("aqua_jet", "Aqua Jet", "water", "physical", 1.1, 1, "Jato aquático veloz.", { kind: "spd_up", chance: 0.4, turns: 2, value: 0.2 }, "single"),
  mv("transform", "Transform", "normal", "status", 0, 4, "Copia a forma do inimigo: sobe Ataque e Defesa.", { kind: "atk_up", turns: 3, value: 0.35 }, "self"),
].map((m) => [m.id, m]));

// ===== Moveset =====
export type Moveset = {
  types: PokeType[];       // 1 ou 2 tipos
  moves: string[];         // 4 golpes de dano
  status: string;          // 1 golpe de status
};

export function getMoveset(speciesId: string): Moveset | undefined {
  return MOVESETS[speciesId];
}

export function getTypes(speciesId: string): PokeType[] {
  return MOVESETS[speciesId]?.types ?? ["normal"];
}

/** Todos os golpes (dano + status) de uma espécie. */
export function getMoves(speciesId: string): Move[] {
  const ms = MOVESETS[speciesId];
  if (!ms) return [];
  return [...ms.moves, ms.status].map((id) => MOVES[id]).filter(Boolean);
}

/** Bônus STAB: golpe do mesmo tipo do pet dá +20%. */
export function stabBonus(move: Move, types: PokeType[]): number {
  return types.includes(move.type) ? 1.2 : 1;
}

// ===== Passivas exclusivas Shiny =====
export type ShinyPassiveKind =
  | "type_boost"      // +20% de dano com golpes do tipo principal
  | "status_immune"   // imune ao status do próprio tipo + 10% dano
  | "regen"           // regenera % do HP máx por turno
  | "first_strike"    // primeiro golpe da batalha é crítico
  | "vengeance"       // ganha ATK ao perder HP
  | "leech"           // cura % do dano causado
  | "thorns"          // reflete parte do dano recebido
  | "cc_master";      // +25% de chance nos efeitos secundários

export type ShinyPassive = {
  name: string;
  emoji: string;
  kind: ShinyPassiveKind;
  value: number;
  description: string;
};

export function getShinyPassive(speciesId: string): ShinyPassive | undefined {
  return SHINY_PASSIVES[speciesId];
}

// Mapas gerados (tipagem por espécie, movesets e passivas shiny)
export { MOVESETS, SHINY_PASSIVES } from "./movesets.generated";
import { MOVESETS, SHINY_PASSIVES } from "./movesets.generated";
