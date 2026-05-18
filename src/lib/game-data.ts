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

export type Element = "fire" | "water" | "grass" | "electric" | "shadow";
export type Role = "tank" | "dps" | "assassin" | "mage" | "healer";
export type Rarity = "common" | "rare" | "legendary";

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
  base: { hp: number; atk: number; def: number; spd: number };
};

export const ROLE_INFO: Record<Role, { name: string; emoji: string; description: string; color: string }> = {
  tank: { name: "Tank", emoji: "🛡️", description: "Provoca: inimigos atacam ele primeiro. Muito HP/DEF.", color: "bg-blue-500" },
  dps: { name: "DPS", emoji: "⚔️", description: "Dano consistente alto (+15% de dano).", color: "bg-orange-500" },
  assassin: { name: "Assassino", emoji: "🗡️", description: "Crítico em 35% dos golpes e mira no mais fraco.", color: "bg-purple-500" },
  mage: { name: "Mago", emoji: "🔮", description: "Dano mágico ignora 60% da DEF inimiga.", color: "bg-fuchsia-500" },
  healer: { name: "Healer", emoji: "✨", description: "A cada 2 turnos cura o aliado mais ferido.", color: "bg-emerald-500" },
};

export const RARITY_INFO: Record<Rarity, { name: string; emoji: string; color: string; ringColor: string; statMult: number; skillMult: number }> = {
  common: { name: "Mestiço", emoji: "✦", color: "bg-slate-400 text-white", ringColor: "ring-slate-300", statMult: 0.85, skillMult: 0.85 },
  rare: { name: "Puro", emoji: "✦✦", color: "bg-amber-500 text-amber-950", ringColor: "ring-amber-400", statMult: 1.0, skillMult: 1.0 },
  legendary: { name: "Lendário", emoji: "✦✦✦", color: "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white", ringColor: "ring-fuchsia-400", statMult: 1.2, skillMult: 1.5 },
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
    description: "Cura todos os aliados vivos (~ATK×1.5 + 10% HP máx).",
  },
};

export const SPECIES: Record<string, Species> = {
  // ===== PUROS (raros) =====
  flarepup: {
    id: "flarepup", name: "Flarepup", element: "fire", role: "dps", rarity: "rare",
    emoji: "🔥", image: flarepupImg,
    description: "Raposinha de fogo puro. DPS clássico de dano alto.",
    base: { hp: 55, atk: 15, def: 8, spd: 12 },
  },
  aquakitty: {
    id: "aquakitty", name: "Aquakitty", element: "water", role: "healer", rarity: "rare",
    emoji: "💧", image: aquakittyImg,
    description: "Gatinho aquático puro. Cura o time a cada 2 turnos.",
    base: { hp: 60, atk: 9, def: 11, spd: 13 },
  },
  leafox: {
    id: "leafox", name: "Leafox", element: "grass", role: "tank", rarity: "rare",
    emoji: "🌿", image: leafoxImg,
    description: "Raposa-folha pura. Tank: provoca e absorve dano.",
    base: { hp: 80, atk: 8, def: 18, spd: 8 },
  },
  voltbun: {
    id: "voltbun", name: "Voltbun", element: "electric", role: "assassin", rarity: "rare",
    emoji: "⚡", image: voltbunImg,
    description: "Coelhinho elétrico puro. Assassino veloz com muito crit.",
    base: { hp: 48, atk: 13, def: 8, spd: 18 },
  },
  shadepup: {
    id: "shadepup", name: "Shadepup", element: "shadow", role: "mage", rarity: "rare",
    emoji: "🌙", image: shadepupImg,
    description: "Lobinho das sombras puro. Mago: dano ignora defesa.",
    base: { hp: 55, atk: 16, def: 9, spd: 12 },
  },

  // ===== MESTIÇOS (comuns) — combinações 2 a 2 dos 5 elementos =====
  steamcub: {
    id: "steamcub", name: "Steamcub", element: "fire", secondaryElement: "water", role: "tank", rarity: "common",
    emoji: "♨️", image: steamcubImg,
    description: "Ursinho de vapor. Tank meio fogo, meio água.",
    base: { hp: 70, atk: 9, def: 14, spd: 9 },
  },
  emberleaf: {
    id: "emberleaf", name: "Emberleaf", element: "fire", secondaryElement: "grass", role: "dps", rarity: "common",
    emoji: "🍂", image: emberleafImg,
    description: "Raposa de folhas em brasa. DPS de outono.",
    base: { hp: 52, atk: 13, def: 9, spd: 12 },
  },
  sparkpup: {
    id: "sparkpup", name: "Sparkpup", element: "fire", secondaryElement: "electric", role: "assassin", rarity: "common",
    emoji: "⚡🔥", image: sparkpupImg,
    description: "Filhote chamuscado e elétrico. Assassino rápido.",
    base: { hp: 46, atk: 12, def: 8, spd: 16 },
  },
  cinderwisp: {
    id: "cinderwisp", name: "Cinderwisp", element: "fire", secondaryElement: "shadow", role: "mage", rarity: "common",
    emoji: "👻🔥", image: cinderwispImg,
    description: "Fantasminha de brasa. Mago ofensivo.",
    base: { hp: 50, atk: 14, def: 9, spd: 11 },
  },
  mossfin: {
    id: "mossfin", name: "Mossfin", element: "water", secondaryElement: "grass", role: "healer", rarity: "common",
    emoji: "🐸", image: mossfinImg,
    description: "Sapinho do brejo. Healer rústico.",
    base: { hp: 58, atk: 8, def: 12, spd: 10 },
  },
  stormtad: {
    id: "stormtad", name: "Stormtad", element: "water", secondaryElement: "electric", role: "mage", rarity: "common",
    emoji: "⚡💧", image: stormtadImg,
    description: "Girino-relâmpago. Mago elétrico.",
    base: { hp: 48, atk: 13, def: 8, spd: 14 },
  },
  tidewraith: {
    id: "tidewraith", name: "Tidewraith", element: "water", secondaryElement: "shadow", role: "assassin", rarity: "common",
    emoji: "🌊👻", image: tidewraithImg,
    description: "Fantasma das marés. Assassino furtivo.",
    base: { hp: 44, atk: 12, def: 8, spd: 16 },
  },
  voltsprout: {
    id: "voltsprout", name: "Voltsprout", element: "grass", secondaryElement: "electric", role: "healer", rarity: "common",
    emoji: "🌱⚡", image: voltsproutImg,
    description: "Broto voltaico. Healer com punch.",
    base: { hp: 54, atk: 9, def: 11, spd: 12 },
  },
  nightbloom: {
    id: "nightbloom", name: "Nightbloom", element: "grass", secondaryElement: "shadow", role: "mage", rarity: "common",
    emoji: "🌸🌙", image: nightbloomImg,
    description: "Flor noturna. Mago de controle.",
    base: { hp: 52, atk: 13, def: 10, spd: 10 },
  },
  voidspark: {
    id: "voidspark", name: "Voidspark", element: "electric", secondaryElement: "shadow", role: "assassin", rarity: "common",
    emoji: "🌑⚡", image: voidsparkImg,
    description: "Orbe de raios sombrios. Assassino caótico.",
    base: { hp: 44, atk: 13, def: 7, spd: 17 },
  },
};

export const ELEMENT_COLORS: Record<Element, string> = {
  fire: "from-red-400 to-orange-500",
  water: "from-cyan-400 to-blue-500",
  grass: "from-emerald-400 to-green-600",
  electric: "from-yellow-300 to-amber-500",
  shadow: "from-purple-500 to-fuchsia-700",
};

export const ELEMENT_NAMES: Record<Element, string> = {
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  electric: "Elétrico",
  shadow: "Sombra",
};

// Type effectiveness (multiplier on damage)
export const TYPE_CHART: Record<Element, Partial<Record<Element, number>>> = {
  fire: { grass: 1.5, water: 0.7, fire: 0.8 },
  water: { fire: 1.5, grass: 0.7, water: 0.8 },
  grass: { water: 1.5, fire: 0.7, grass: 0.8 },
  electric: { water: 1.5, grass: 0.7, electric: 0.8 },
  shadow: { shadow: 0.8 },
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
  energy_drink: { id: "energy_drink", name: "Energético", emoji: "⚡", description: "+40 energia", priceCoins: 25, effect: { energy: 40 } },
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

export const EGGS: Record<string, Egg> = {
  basic: {
    id: "basic", name: "Ovo Comum", emoji: "🥚", priceCoins: 100,
    description: "Maior chance de mestiços. Pequena chance de puro.",
    weights: makeWeights(7, 2), // 10 commons × 7 = 70%, 5 rares × 2 = 10... ratio 70:10 = 87% common
  },
  rare: {
    id: "rare", name: "Ovo Raro", emoji: "🪺", priceGems: 25,
    description: "Alta chance de puro (raro) com stats melhores.",
    weights: makeWeights(2, 14), // 10×2=20, 5×14=70 → ~78% rare
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

export function totalStats(species: string, rank = 1, bonus = { hp: 0, atk: 0, def: 0, spd: 0 }) {
  const s = SPECIES[species];
  if (!s) return { hp: 0, atk: 0, def: 0, spd: 0 };
  const r = RANK_MULT[Math.min(Math.max(rank, 1), MAX_RANK)] ?? 1;
  const mult = RARITY_INFO[s.rarity].statMult * r;
  return {
    hp: Math.round(s.base.hp * mult) + bonus.hp,
    atk: Math.round(s.base.atk * mult) + bonus.atk,
    def: Math.round(s.base.def * mult) + bonus.def,
    spd: Math.round(s.base.spd * mult) + bonus.spd,
  };
}

export const TRADE_FEE_COINS = 50;
export const TRADE_FEE_GEMS = 5;
export const MAX_TRADEABLE_RANK = 7; // ✦8+ não pode ser trocado

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
  { id: "medium", label: "4 horas", minutes: 240, foodCost: 2, baseXp: 220, baseCoins: 110, gemChance: 0.10, gemAmount: [1, 1], rationChance: 0.30, rationAmount: [1, 2] },
  { id: "long", label: "8 horas", minutes: 480, foodCost: 3, baseXp: 480, baseCoins: 240, gemChance: 0.25, gemAmount: [1, 2], rationChance: 0.60, rationAmount: [1, 3] },
  { id: "epic", label: "24 horas", minutes: 1440, foodCost: 5, baseXp: 1500, baseCoins: 700, gemChance: 0.70, gemAmount: [1, 3], rationChance: 1.0, rationAmount: [2, 5] },
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
  monsterLevel: number,
  monsterRank: number
): { xp: number; coins: number; gems: number; rations: number } {
  const lvlMult = 1 + (Math.max(1, monsterLevel) - 1) * 0.10;
  const rankMult = RANK_MULT[Math.min(Math.max(monsterRank, 1), MAX_RANK)] ?? 1;
  const mult = lvlMult * rankMult;
  const xp = Math.round(duration.baseXp * mult);
  const coins = Math.round(duration.baseCoins * mult);
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
