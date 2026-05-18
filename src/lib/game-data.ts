import flarepupImg from "@/assets/monsters/flarepup.png";
import aquakittyImg from "@/assets/monsters/aquakitty.png";
import leafoxImg from "@/assets/monsters/leafox.png";
import voltbunImg from "@/assets/monsters/voltbun.png";
import shadepupImg from "@/assets/monsters/shadepup.png";
import steamcubImg from "@/assets/monsters/steamcub.png";
import emberleafImg from "@/assets/monsters/emberleaf.png";
import sparkpupImg from "@/assets/monsters/sparkpup.png";
import cinderwispImg from "@/assets/monsters/cinderwisp.png";
import mossfinImg from "@/assets/monsters/mossfin.png";
import stormtadImg from "@/assets/monsters/stormtad.png";
import tidewraithImg from "@/assets/monsters/tidewraith.png";
import voltsproutImg from "@/assets/monsters/voltsprout.png";
import nightbloomImg from "@/assets/monsters/nightbloom.png";
import voidsparkImg from "@/assets/monsters/voidspark.png";
import rockpupImg from "@/assets/monsters/rockpup.png";
import magmaboulderImg from "@/assets/monsters/magmaboulder.png";
import mudpawImg from "@/assets/monsters/mudpaw.png";
import crystalspriteImg from "@/assets/monsters/crystalsprite.png";
import oncaSombriaImg from "@/assets/monsters/onca_sombria.png";
import leaoDouradoImg from "@/assets/monsters/leao_dourado.png";
import tigreInfernalImg from "@/assets/monsters/tigre_infernal.png";
import panteraNegraImg from "@/assets/monsters/pantera_negra.png";
import panteraAureaImg from "@/assets/monsters/pantera_aurea.png";
import dragaoBrancoImg from "@/assets/monsters/dragao_branco.png";
import dragaoNegroImg from "@/assets/monsters/dragao_negro.png";

export type Element = "fire" | "water" | "grass" | "electric" | "shadow" | "earth";
export type Role = "tank" | "dps" | "assassin" | "mage" | "healer";
export type Rarity = "common" | "rare" | "super_rare" | "epic" | "legendary" | "mythic";

export type Species = {
  id: string;
  name: string;
  element: Element;
  secondaryElement?: Element; // hybrids have two
  role: Role;
  rarity: Rarity;
  emoji: string;
  image: string;
  description: string;
  base: { hp: number; atk: number; def: number; spd: number; int: number };
};

export const ROLE_INFO: Record<Role, { name: string; emoji: string; description: string; color: string }> = {
  tank: { name: "Tank", emoji: "🛡️", description: "Provoca: inimigos atacam ele primeiro. Muito HP/DEF.", color: "bg-blue-500" },
  dps: { name: "DPS", emoji: "⚔️", description: "Dano consistente alto (+15% de dano).", color: "bg-orange-500" },
  assassin: { name: "Assassino", emoji: "🗡️", description: "Crítico em 35% dos golpes e mira no mais fraco.", color: "bg-purple-500" },
  mage: { name: "Mago", emoji: "🔮", description: "Dano mágico escala com 🧠 INT e ignora 60% da DEF.", color: "bg-fuchsia-500" },
  healer: { name: "Healer", emoji: "✨", description: "Cura escala com 🧠 INT. A cada 2 turnos cura o aliado mais ferido.", color: "bg-emerald-500" },
};

export const RARITY_INFO: Record<Rarity, { name: string; emoji: string; color: string; ringColor: string; statMult: number; skillMult: number }> = {
  common:     { name: "Comum",      emoji: "✦",       color: "bg-slate-400 text-white",                                                       ringColor: "ring-slate-300",   statMult: 0.80, skillMult: 0.85 },
  rare:       { name: "Raro",       emoji: "✦✦",     color: "bg-amber-500 text-amber-950",                                                   ringColor: "ring-amber-400",   statMult: 1.00, skillMult: 1.00 },
  super_rare: { name: "Super Raro", emoji: "✦✦✦",   color: "bg-cyan-500 text-white",                                                         ringColor: "ring-cyan-400",    statMult: 1.15, skillMult: 1.15 },
  epic:       { name: "Épico",      emoji: "✦✦✦✦", color: "bg-gradient-to-r from-violet-500 to-purple-600 text-white",                     ringColor: "ring-violet-400",  statMult: 1.30, skillMult: 1.35 },
  legendary:  { name: "Lendário",   emoji: "✦✦✦✦✦", color: "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white",                    ringColor: "ring-fuchsia-400", statMult: 1.50, skillMult: 1.55 },
  mythic:     { name: "Mítico",     emoji: "✦✦✦✦✦✦", color: "bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 text-white",      ringColor: "ring-cyan-300",    statMult: 1.75, skillMult: 1.85 },
};

// ===== Skills (1 por role, escala com raridade) =====
export type SkillKind = "shield_taunt" | "heavy_strike" | "guaranteed_crit" | "aoe_magic" | "team_heal";

export type Skill = {
  name: string;
  emoji: string;
  description: string;
  kind: SkillKind;
  cooldown: number; // turnos
};

export const ROLE_SKILLS: Record<Role, Skill> = {
  tank: {
    name: "Provocação Brutal", emoji: "🛡️", kind: "shield_taunt", cooldown: 4,
    description: "Provoca todos os inimigos por 2 turnos e ganha escudo (30% do HP máx).",
  },
  dps: {
    name: "Investida Devastadora", emoji: "💥", kind: "heavy_strike", cooldown: 3,
    description: "Golpe pesado: 2.2× o dano normal num alvo único.",
  },
  assassin: {
    name: "Lâmina Sombria", emoji: "🗡️", kind: "guaranteed_crit", cooldown: 3,
    description: "Ataque garantido CRÍTICO no inimigo mais fraco, ignorando 60% da DEF.",
  },
  mage: {
    name: "Detonação Arcana", emoji: "🔮", kind: "aoe_magic", cooldown: 4,
    description: "Explosão mágica que atinge TODOS os inimigos (1.2× dano cada, ignora defesa).",
  },
  healer: {
    name: "Bênção Restauradora", emoji: "✨", kind: "team_heal", cooldown: 4,
    description: "Cura todos os aliados vivos (~INT×1.8 + 10% HP máx).",
  },
};

export const SPECIES: Record<string, Species> = {
  // ===== PUROS (raros) =====
  flarepup: {
    id: "flarepup", name: "Flarepup", element: "fire", role: "dps", rarity: "rare",
    emoji: "🔥", image: flarepupImg,
    description: "Raposinha de fogo puro. DPS clássico de dano alto.",
    base: { hp: 55, atk: 15, def: 8, spd: 12, int: 7 },
  },
  aquakitty: {
    id: "aquakitty", name: "Aquakitty", element: "water", role: "healer", rarity: "rare",
    emoji: "💧", image: aquakittyImg,
    description: "Gatinho aquático puro. Cura o time a cada 2 turnos.",
    base: { hp: 60, atk: 9, def: 11, spd: 13, int: 20 },
  },
  leafox: {
    id: "leafox", name: "Leafox", element: "grass", role: "tank", rarity: "rare",
    emoji: "🌿", image: leafoxImg,
    description: "Raposa-folha pura. Tank: provoca e absorve dano.",
    base: { hp: 80, atk: 8, def: 18, spd: 8, int: 8 },
  },
  voltbun: {
    id: "voltbun", name: "Voltbun", element: "electric", role: "assassin", rarity: "rare",
    emoji: "⚡", image: voltbunImg,
    description: "Coelhinho elétrico puro. Assassino veloz com muito crit.",
    base: { hp: 48, atk: 13, def: 8, spd: 18, int: 6 },
  },
  shadepup: {
    id: "shadepup", name: "Shadepup", element: "shadow", role: "mage", rarity: "rare",
    emoji: "🌙", image: shadepupImg,
    description: "Lobinho das sombras puro. Mago: dano ignora defesa.",
    base: { hp: 55, atk: 16, def: 9, spd: 12, int: 22 },
  },

  // ===== MESTIÇOS (comuns) — combinações 2 a 2 dos 5 elementos =====
  steamcub: {
    id: "steamcub", name: "Steamcub", element: "fire", secondaryElement: "water", role: "tank", rarity: "common",
    emoji: "♨️", image: steamcubImg,
    description: "Ursinho de vapor. Tank meio fogo, meio água.",
    base: { hp: 70, atk: 9, def: 14, spd: 9, int: 8 },
  },
  emberleaf: {
    id: "emberleaf", name: "Emberleaf", element: "fire", secondaryElement: "grass", role: "dps", rarity: "common",
    emoji: "🍂", image: emberleafImg,
    description: "Raposa de folhas em brasa. DPS de outono.",
    base: { hp: 52, atk: 13, def: 9, spd: 12, int: 7 },
  },
  sparkpup: {
    id: "sparkpup", name: "Sparkpup", element: "fire", secondaryElement: "electric", role: "assassin", rarity: "common",
    emoji: "⚡🔥", image: sparkpupImg,
    description: "Filhote chamuscado e elétrico. Assassino rápido.",
    base: { hp: 46, atk: 12, def: 8, spd: 16, int: 6 },
  },
  cinderwisp: {
    id: "cinderwisp", name: "Cinderwisp", element: "fire", secondaryElement: "shadow", role: "mage", rarity: "common",
    emoji: "👻🔥", image: cinderwispImg,
    description: "Fantasminha de brasa. Mago ofensivo.",
    base: { hp: 50, atk: 14, def: 9, spd: 11, int: 22 },
  },
  mossfin: {
    id: "mossfin", name: "Mossfin", element: "water", secondaryElement: "grass", role: "healer", rarity: "common",
    emoji: "🐸", image: mossfinImg,
    description: "Sapinho do brejo. Healer rústico.",
    base: { hp: 58, atk: 8, def: 12, spd: 10, int: 20 },
  },
  stormtad: {
    id: "stormtad", name: "Stormtad", element: "water", secondaryElement: "electric", role: "mage", rarity: "common",
    emoji: "⚡💧", image: stormtadImg,
    description: "Girino-relâmpago. Mago elétrico.",
    base: { hp: 48, atk: 13, def: 8, spd: 14, int: 22 },
  },
  tidewraith: {
    id: "tidewraith", name: "Tidewraith", element: "water", secondaryElement: "shadow", role: "assassin", rarity: "common",
    emoji: "🌊👻", image: tidewraithImg,
    description: "Fantasma das marés. Assassino furtivo.",
    base: { hp: 44, atk: 12, def: 8, spd: 16, int: 6 },
  },
  voltsprout: {
    id: "voltsprout", name: "Voltsprout", element: "grass", secondaryElement: "electric", role: "healer", rarity: "common",
    emoji: "🌱⚡", image: voltsproutImg,
    description: "Broto voltaico. Healer com punch.",
    base: { hp: 54, atk: 9, def: 11, spd: 12, int: 20 },
  },
  nightbloom: {
    id: "nightbloom", name: "Nightbloom", element: "grass", secondaryElement: "shadow", role: "mage", rarity: "common",
    emoji: "🌸🌙", image: nightbloomImg,
    description: "Flor noturna. Mago de controle.",
    base: { hp: 52, atk: 13, def: 10, spd: 10, int: 22 },
  },
  voidspark: {
    id: "voidspark", name: "Voidspark", element: "electric", secondaryElement: "shadow", role: "assassin", rarity: "common",
    emoji: "🌑⚡", image: voidsparkImg,
    description: "Orbe de raios sombrios. Assassino caótico.",
    base: { hp: 44, atk: 13, def: 7, spd: 17, int: 6 },
  },

  // ===== TERRA =====
  rockpup: {
    id: "rockpup", name: "Rockpup", element: "earth", role: "tank", rarity: "rare",
    emoji: "🪨", image: rockpupImg,
    description: "Cãozinho de pedregulho puro. Tank rochoso com defesa absurda.",
    base: { hp: 85, atk: 9, def: 20, spd: 7, int: 8 },
  },
  magmaboulder: {
    id: "magmaboulder", name: "Magmaboulder", element: "earth", secondaryElement: "fire", role: "tank", rarity: "common",
    emoji: "🌋", image: magmaboulderImg,
    description: "Rocha vulcânica. Tank que queima quem encosta.",
    base: { hp: 75, atk: 11, def: 16, spd: 7, int: 8 },
  },
  mudpaw: {
    id: "mudpaw", name: "Mudpaw", element: "earth", secondaryElement: "water", role: "dps", rarity: "common",
    emoji: "🟫", image: mudpawImg,
    description: "Golem de lama. DPS pesado que afunda os inimigos.",
    base: { hp: 60, atk: 14, def: 12, spd: 8, int: 7 },
  },
  crystalsprite: {
    id: "crystalsprite", name: "Crystalsprite", element: "earth", secondaryElement: "electric", role: "mage", rarity: "common",
    emoji: "💎", image: crystalspriteImg,
    description: "Geodo mágico cristalino. Mago de cristal com raios.",
    base: { hp: 52, atk: 12, def: 11, spd: 10, int: 21 },
  },

  // ===== EVENTO (lendários — só caem no Ovo de Evento) =====
  onca_sombria: {
    id: "onca_sombria", name: "Onça Sombria", element: "shadow", role: "assassin", rarity: "legendary",
    emoji: "🐆", image: oncaSombriaImg,
    description: "Onça-pintada das sombras. Crítico letal nos mais fracos.",
    base: { hp: 62, atk: 17, def: 10, spd: 16, int: 10 },
  },
  leao_dourado: {
    id: "leao_dourado", name: "Leão Dourado", element: "earth", role: "dps", rarity: "legendary",
    emoji: "🦁", image: leaoDouradoImg,
    description: "Rei dourado. Dano consistente avassalador.",
    base: { hp: 68, atk: 18, def: 13, spd: 11, int: 9 },
  },
  tigre_infernal: {
    id: "tigre_infernal", name: "Tigre Infernal", element: "fire", role: "dps", rarity: "legendary",
    emoji: "🔥", image: tigreInfernalImg,
    description: "Tigre de chamas eternas. Investida devastadora em fogo.",
    base: { hp: 64, atk: 19, def: 10, spd: 14, int: 10 },
  },
  pantera_negra: {
    id: "pantera_negra", name: "Pantera Negra", element: "shadow", role: "assassin", rarity: "legendary",
    emoji: "🐈‍⬛", image: panteraNegraImg,
    description: "Olhos vermelhos no escuro. Mortal e ágil.",
    base: { hp: 60, atk: 18, def: 10, spd: 17, int: 11 },
  },
  pantera_aurea: {
    id: "pantera_aurea", name: "Pantera Áurea", element: "shadow", role: "mage", rarity: "legendary",
    emoji: "✨", image: panteraAureaImg,
    description: "Olhos dourados — variante ultra-rara da Pantera Negra. Mago sombrio supremo.",
    base: { hp: 65, atk: 14, def: 12, spd: 15, int: 24 },
  },

  // ===== MÍTICOS (classe suprema — só em eventos especiais) =====
  dragao_branco: {
    id: "dragao_branco", name: "Dragão Branco", element: "water", role: "healer", rarity: "mythic",
    emoji: "🐉", image: dragaoBrancoImg,
    description: "Dragão místico de escamas brancas e olhos de safira. Cura divina que ressoa pelo time.",
    base: { hp: 80, atk: 16, def: 16, spd: 14, int: 26 },
  },
  dragao_negro: {
    id: "dragao_negro", name: "Dragão Negro", element: "shadow", role: "dps", rarity: "mythic",
    emoji: "🐲", image: dragaoNegroImg,
    description: "Dragão obsidiana de olhos vermelhos. Dano apocalíptico que devasta inimigos.",
    base: { hp: 75, atk: 24, def: 14, spd: 15, int: 14 },
  },
};

export const ELEMENT_COLORS: Record<Element, string> = {
  fire: "from-red-400 to-orange-500",
  water: "from-cyan-400 to-blue-500",
  grass: "from-emerald-400 to-green-600",
  electric: "from-yellow-300 to-amber-500",
  shadow: "from-purple-500 to-fuchsia-700",
  earth: "from-amber-700 to-stone-600",
};

export const ELEMENT_NAMES: Record<Element, string> = {
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  electric: "Elétrico",
  shadow: "Sombra",
  earth: "Terra",
};

// Type effectiveness (multiplier on damage)
export const TYPE_CHART: Record<Element, Partial<Record<Element, number>>> = {
  fire: { grass: 1.5, water: 0.7, fire: 0.8, earth: 0.7 },
  water: { fire: 1.5, grass: 0.7, water: 0.8, earth: 1.5 },
  grass: { water: 1.5, fire: 0.7, grass: 0.8, earth: 1.5 },
  electric: { water: 1.5, grass: 0.7, electric: 0.8, earth: 0.5 },
  shadow: { shadow: 0.8 },
  earth: { fire: 1.5, electric: 1.5, grass: 0.7, water: 0.7, earth: 0.8 },
};

// ===== Items =====
export type Item = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  priceCoins?: number;
  priceGems?: number;
  effect: { hunger?: number; energy?: number; happiness?: number; xp?: number; hp?: number };
};

export const ITEMS: Record<string, Item> = {
  ration: { id: "ration", name: "Ração", emoji: "🍖", description: "+30 fome", priceCoins: 15, effect: { hunger: 30 } },
  candy: { id: "candy", name: "Doce", emoji: "🍬", description: "+25 felicidade", priceCoins: 12, effect: { happiness: 25 } },
  energy_drink: { id: "energy_drink", name: "Energético", emoji: "⚡", description: "+40 energia (regenera 1/h grátis)", priceGems: 2, effect: { energy: 40 } },
  premium_meal: { id: "premium_meal", name: "Banquete Real", emoji: "🍱", description: "+100 fome, +50 felicidade", priceGems: 3, effect: { hunger: 100, happiness: 50 } },
  revive: { id: "revive", name: "Revive", emoji: "💖", description: "Cura 100% do HP instantâneo", priceGems: 5, effect: { hp: 9999 } },
};

// ===== Eggs (gacha) =====
export type Egg = {
  id: string;
  name: string;
  emoji: string;
  priceCoins?: number;
  priceGems?: number;
  description: string;
  weights: Record<string, number>;
  pack?: number; // quantos pets vêm
  event?: boolean; // ovo de evento — visível mas não comprável fora do evento
};

// Helpers to build weight tables
const ALL_COMMON = Object.values(SPECIES).filter((s) => s.rarity === "common").map((s) => s.id);
const ALL_RARE = Object.values(SPECIES).filter((s) => s.rarity === "rare").map((s) => s.id);

function makeWeights(commonW: number, rareW: number): Record<string, number> {
  const w: Record<string, number> = {};
  ALL_COMMON.forEach((id) => (w[id] = commonW));
  ALL_RARE.forEach((id) => (w[id] = rareW));
  return w;
}

// Pesos balanceados pra 10% raro / 90% comum no ovo raro
// (multiplicamos pelo contador da outra raridade pra normalizar)
const RARE_EGG_WEIGHTS: Record<string, number> = (() => {
  const w: Record<string, number> = {};
  const nC = ALL_COMMON.length || 1;
  const nR = ALL_RARE.length || 1;
  ALL_COMMON.forEach((id) => (w[id] = 9 * nR));
  ALL_RARE.forEach((id) => (w[id] = 1 * nC));
  return w;
})();

export const EGGS: Record<string, Egg> = {
  basic: {
    id: "basic", name: "Ovo Comum", emoji: "🥚", priceCoins: 1000,
    description: "Sorteia apenas monstros mestiços (comuns).",
    weights: makeWeights(1, 0),
  },
  basic_10: {
    id: "basic_10", name: "Pack 10x Ovo Comum", emoji: "🥚", priceCoins: 9000,
    description: "10 ovos comuns de uma vez. Só pets comuns.",
    weights: makeWeights(1, 0),
    pack: 10,
  },
  rare: {
    id: "rare", name: "Ovo Raro", emoji: "🪺", priceGems: 25,
    description: "10% de chance de vir um pet raro. Resto vem comum.",
    weights: RARE_EGG_WEIGHTS,
  },
  rare_10: {
    id: "rare_10", name: "Pack 10x Ovo Raro", emoji: "🪺", priceGems: 200,
    description: "10 ovos raros. 10% por ovo de vir um raro.",
    weights: RARE_EGG_WEIGHTS,
    pack: 10,
  },
  event_felinos: {
    id: "event_felinos", name: "Ovo de Evento — Felinos Lendários", emoji: "🥚✨", priceGems: 80,
    description: "Evento limitado: Onça Sombria, Leão Dourado, Tigre Infernal, Pantera Negra (rara) e Pantera Áurea (ULTRA rara).",
    event: true,
    weights: {
      onca_sombria: 30,
      leao_dourado: 30,
      tigre_infernal: 30,
      pantera_negra: 9,
      pantera_aurea: 1,
    },
  },
};

// ===== Skins =====
export type Skin = {
  id: string;
  name: string;
  description: string;
  priceGems: number;
  hueRotate: number;
  saturate?: number;
  vipOnly?: boolean;
};

export const SKINS: Record<string, Skin> = {
  default: { id: "default", name: "Padrão", description: "Visual original", priceGems: 0, hueRotate: 0 },
  golden: { id: "golden", name: "Dourado", description: "Brilho dourado luxuoso", priceGems: 15, hueRotate: -30, saturate: 1.4 },
  arctic: { id: "arctic", name: "Ártico", description: "Tons gelados", priceGems: 15, hueRotate: 180 },
  toxic: { id: "toxic", name: "Tóxico", description: "Verde radioativo", priceGems: 20, hueRotate: 90, saturate: 1.6 },
  rainbow: { id: "rainbow", name: "Arco-íris VIP", description: "Skin exclusiva VIP", priceGems: 0, hueRotate: 45, saturate: 1.8, vipOnly: true },
};

// ===== VIP / Gem packs =====
export const VIP_PRICE_GEMS = 50;
export const VIP_DURATION_DAYS = 30;

export const GEM_PACKS = [
  { id: "starter", gems: 30, priceBRL: 9.90, bonus: 0 },
  { id: "pro", gems: 100, priceBRL: 24.90, bonus: 20 },
  { id: "epic", gems: 300, priceBRL: 59.90, bonus: 100 },
  { id: "legend", gems: 800, priceBRL: 119.90, bonus: 300 },
];

// ===== Helpers =====
// XP da CONTA (profile) — pets não têm mais XP/level próprio.
export function xpForNextLevel(level: number): number {
  return Math.floor(50 * Math.pow(1.4, level - 1));
}

// ===== Rank (fusion ✦1 a ✦10) =====
export const RANK_MULT: Record<number, number> = {
  1: 1.00, 2: 1.10, 3: 1.22, 4: 1.36, 5: 1.52,
  6: 1.70, 7: 1.90, 8: 2.13, 9: 2.40, 10: 2.70,
};
export const MAX_RANK = 10;

export function rankStars(rank: number): string {
  return "✦".repeat(Math.min(Math.max(rank, 1), MAX_RANK));
}

export function totalStats(species: string, rank = 1, bonus = { hp: 0, atk: 0, def: 0, spd: 0, int: 0 }) {
  const s = SPECIES[species];
  if (!s) return { hp: 0, atk: 0, def: 0, spd: 0, int: 0 };
  const r = RANK_MULT[Math.min(Math.max(rank, 1), MAX_RANK)] ?? 1;
  const mult = RARITY_INFO[s.rarity].statMult * r;
  return {
    hp: Math.round(s.base.hp * mult) + (bonus.hp ?? 0),
    atk: Math.round(s.base.atk * mult) + (bonus.atk ?? 0),
    def: Math.round(s.base.def * mult) + (bonus.def ?? 0),
    spd: Math.round(s.base.spd * mult) + (bonus.spd ?? 0),
    int: Math.round(s.base.int * mult) + (bonus.int ?? 0),
  };
}

export const TRADE_FEE_COINS = 50;
export const TRADE_FEE_GEMS = 5;
export const MAX_TRADEABLE_RANK = 7; // ✦8+ não pode ser trocado

// ===== Energia de batalha =====
export const MAX_BATTLE_ENERGY = 24;
export const BATTLE_ENERGY_REGEN_MS = 60 * 60 * 1000; // 1 energia por hora
export const ENERGY_REFILL_GEM_COST = 3; // custo pra encher 1 pet
export const ENERGY_REFILL_ALL_GEM_COST = 15; // encher o time inteiro

export function computeBattleEnergy(stored: number | undefined | null, at: string | undefined | null): {
  energy: number;
  nextRegenAt: Date | null; // null se cheio
  nextStoredAt: string; // novo timestamp pra persistir após uso
} {
  const base = Math.min(MAX_BATTLE_ENERGY, Math.max(0, stored ?? MAX_BATTLE_ENERGY));
  const atDate = at ? new Date(at) : new Date();
  const now = Date.now();
  const elapsed = now - atDate.getTime();
  const regened = Math.max(0, Math.floor(elapsed / BATTLE_ENERGY_REGEN_MS));
  const energy = Math.min(MAX_BATTLE_ENERGY, base + regened);
  // Avança o timestamp pelos ticks consumidos
  const newAt = new Date(atDate.getTime() + regened * BATTLE_ENERGY_REGEN_MS);
  const nextRegenAt = energy >= MAX_BATTLE_ENERGY ? null : new Date(newAt.getTime() + BATTLE_ENERGY_REGEN_MS);
  return { energy, nextRegenAt, nextStoredAt: newAt.toISOString() };
}

// ===== Expedições (farm offline) =====
export type ExpeditionDuration = {
  id: string;
  label: string;
  minutes: number;
  foodCost: number;     // rações gastas ao iniciar
  baseXp: number;       // XP base (escala com nível)
  baseCoins: number;
  gemChance: number;    // 0..1 chance de cair gema
  gemAmount: [number, number]; // min,max gemas se cair
  rationChance: number; // chance de dropar ração extra
  rationAmount: [number, number];
};

export const EXPEDITION_DURATIONS: ExpeditionDuration[] = [
  { id: "short", label: "1 hora", minutes: 60, foodCost: 1, baseXp: 50, baseCoins: 25, gemChance: 0, gemAmount: [0, 0], rationChance: 0.10, rationAmount: [1, 1] },
  { id: "medium", label: "4 horas", minutes: 240, foodCost: 2, baseXp: 220, baseCoins: 110, gemChance: 0, gemAmount: [0, 0], rationChance: 0.30, rationAmount: [1, 2] },
  { id: "long", label: "8 horas", minutes: 480, foodCost: 3, baseXp: 480, baseCoins: 240, gemChance: 0, gemAmount: [0, 0], rationChance: 0.60, rationAmount: [1, 3] },
  { id: "epic", label: "24 horas", minutes: 1440, foodCost: 5, baseXp: 1500, baseCoins: 700, gemChance: 0, gemAmount: [0, 0], rationChance: 1.0, rationAmount: [2, 5] },
];

export const MAX_EXPEDITION_SLOTS = 5;
// Preço em gemas pra desbloquear o slot N (a partir do 2º)
export const EXPEDITION_SLOT_PRICES: Record<number, number> = {
  2: 25,
  3: 60,
  4: 120,
  5: 250,
};

export function computeExpeditionReward(
  duration: ExpeditionDuration,
  monsterRank: number
): { xp: number; coins: number; gems: number; rations: number } {
  const rankMult = RANK_MULT[Math.min(Math.max(monsterRank, 1), MAX_RANK)] ?? 1;
  const xp = Math.round(duration.baseXp * rankMult);
  const coins = Math.round(duration.baseCoins * rankMult);
  const rollRange = (range: [number, number]) =>
    Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  const gems = Math.random() < duration.gemChance ? rollRange(duration.gemAmount) : 0;
  const rations = Math.random() < duration.rationChance ? rollRange(duration.rationAmount) : 0;
  return { xp, coins, gems, rations };
}

export function isVip(vipUntil: string | null): boolean {
  if (!vipUntil) return false;
  return new Date(vipUntil).getTime() > Date.now();
}

export function rollEgg(eggId: string): string {
  const egg = EGGS[eggId];
  if (!egg) return "flarepup";
  const total = Object.values(egg.weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [species, weight] of Object.entries(egg.weights)) {
    r -= weight;
    if (r <= 0) return species;
  }
  return Object.keys(egg.weights)[0];
}

export function skinFilter(skinId: string): string {
  const s = SKINS[skinId];
  if (!s || skinId === "default") return "none";
  return `hue-rotate(${s.hueRotate}deg) saturate(${s.saturate ?? 1})`;
}

// Defensive multiplier when an attack of `atkElement` hits a monster of `defSpecies`.
// Hybrids take the BEST (lowest) of both elements' multipliers.
export function defensiveMultiplier(atkElement: Element, defSpecies: string): number {
  const sp = SPECIES[defSpecies];
  if (!sp) return 1;
  const m1 = TYPE_CHART[atkElement]?.[sp.element] ?? 1;
  if (!sp.secondaryElement) return m1;
  const m2 = TYPE_CHART[atkElement]?.[sp.secondaryElement] ?? 1;
  return Math.min(m1, m2);
}

// ===== Ranked ladder =====
export type Tier = {
  name: string;
  division: string; // "I"-"V" or "" for Mestre/Grão-Mestre/Lendário
  short: string;
  color: string;   // tailwind classes (bg + text)
  iconColor: string;
  emoji: string;
};

// Each division = 100 pts. 5 divisions per tier (V→I) = 500 pts per tier.
export const DIVISION_SIZE = 100;
const LADDER: { name: string; emoji: string; color: string; iconColor: string; start: number }[] = [
  { name: "Ferro",    emoji: "⛓️", color: "bg-zinc-600 text-white",       iconColor: "text-zinc-300",   start: 0    },
  { name: "Bronze",   emoji: "🥉", color: "bg-amber-700 text-amber-50",   iconColor: "text-amber-300",  start: 500  },
  { name: "Prata",    emoji: "🥈", color: "bg-slate-400 text-slate-900",  iconColor: "text-slate-200",  start: 1000 },
  { name: "Ouro",     emoji: "🥇", color: "bg-yellow-500 text-yellow-950",iconColor: "text-yellow-200", start: 1500 },
  { name: "Platina",  emoji: "💠", color: "bg-cyan-500 text-cyan-950",    iconColor: "text-cyan-200",   start: 2000 },
  { name: "Diamante", emoji: "💎", color: "bg-sky-400 text-sky-950",      iconColor: "text-sky-100",    start: 2500 },
];
const MASTER_THRESHOLD = 3000;
const GRAND_MASTER_THRESHOLD = 4000;
const DIVISION_NAMES = ["V", "IV", "III", "II", "I"];

export function getTier(points: number, leaderboardRank?: number): Tier {
  // Lendário: top 10 globally, but only if they reached at least Grão-Mestre points
  if (leaderboardRank !== undefined && leaderboardRank <= 10 && points >= GRAND_MASTER_THRESHOLD) {
    return {
      name: "Lendário", division: "", short: "Lendário",
      color: "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white",
      iconColor: "text-yellow-200", emoji: "👑",
    };
  }
  if (points >= GRAND_MASTER_THRESHOLD) {
    return {
      name: "Grão-Mestre", division: "", short: "Grão-Mestre",
      color: "bg-gradient-to-r from-red-500 to-pink-600 text-white",
      iconColor: "text-red-100", emoji: "🔥",
    };
  }
  if (points >= MASTER_THRESHOLD) {
    return {
      name: "Mestre", division: "", short: "Mestre",
      color: "bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white",
      iconColor: "text-fuchsia-100", emoji: "🏆",
    };
  }
  // Walk down LADDER to find current tier
  for (let i = LADDER.length - 1; i >= 0; i--) {
    const t = LADDER[i];
    if (points >= t.start) {
      const over = points - t.start;
      const div = Math.min(4, Math.floor(over / DIVISION_SIZE));
      const division = DIVISION_NAMES[div];
      return {
        name: t.name, division, short: `${t.name} ${division}`,
        color: t.color, iconColor: t.iconColor, emoji: t.emoji,
      };
    }
  }
  return { name: "Ferro", division: "V", short: "Ferro V", color: LADDER[0].color, iconColor: LADDER[0].iconColor, emoji: LADDER[0].emoji };
}

// Points needed to reach the NEXT division (or null at peak)
export function nextTierProgress(points: number): { next: number; current: number; pct: number } | null {
  if (points >= GRAND_MASTER_THRESHOLD) return null;
  if (points >= MASTER_THRESHOLD) return { next: GRAND_MASTER_THRESHOLD, current: MASTER_THRESHOLD, pct: ((points - MASTER_THRESHOLD) / (GRAND_MASTER_THRESHOLD - MASTER_THRESHOLD)) * 100 };
  for (let i = LADDER.length - 1; i >= 0; i--) {
    const t = LADDER[i];
    if (points >= t.start) {
      const over = points - t.start;
      const div = Math.min(4, Math.floor(over / DIVISION_SIZE));
      const divStart = t.start + div * DIVISION_SIZE;
      const divEnd = divStart + DIVISION_SIZE;
      return { current: divStart, next: divEnd, pct: ((points - divStart) / DIVISION_SIZE) * 100 };
    }
  }
  return { current: 0, next: DIVISION_SIZE, pct: 0 };
}

// Current division bounds + whether the next division is a new tier (promo would be md5)
export function divisionBounds(points: number): {
  start: number; end: number; tierIndex: number; divIndex: number; nextIsTierUp: boolean;
} | null {
  if (points >= MASTER_THRESHOLD) return null;
  for (let i = LADDER.length - 1; i >= 0; i--) {
    const t = LADDER[i];
    if (points >= t.start) {
      const over = points - t.start;
      const div = Math.min(4, Math.floor(over / DIVISION_SIZE));
      const start = t.start + div * DIVISION_SIZE;
      return { start, end: start + DIVISION_SIZE, tierIndex: i, divIndex: div, nextIsTierUp: div === 4 };
    }
  }
  return null;
}

export type PromoSeries = { wins: number; losses: number; type: "bo3" | "bo5"; targetFrom: number };

export function promoNeeded(type: "bo3" | "bo5"): number {
  return type === "bo5" ? 3 : 2;
}

export const ARENA_WIN_POINTS = 25;
export const ARENA_LOSS_POINTS = 15;

