import flarepupImg from "@/assets/monsters/flarepup.png";
import aquakittyImg from "@/assets/monsters/aquakitty.png";
import leafoxImg from "@/assets/monsters/leafox.png";
import voltbunImg from "@/assets/monsters/voltbun.png";
import shadepupImg from "@/assets/monsters/shadepup.png";

export type Element = "fire" | "water" | "grass" | "electric" | "shadow";
export type Role = "tank" | "dps" | "assassin" | "mage" | "healer";

export type Species = {
  id: string;
  name: string;
  element: Element;
  role: Role;
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

export const SPECIES: Record<string, Species> = {
  flarepup: {
    id: "flarepup", name: "Flarepup", element: "fire", role: "dps",
    emoji: "🔥", image: flarepupImg,
    description: "Raposinha de fogo. DPS clássico: dano alto e estável.",
    base: { hp: 55, atk: 15, def: 8, spd: 12 },
  },
  aquakitty: {
    id: "aquakitty", name: "Aquakitty", element: "water", role: "healer",
    emoji: "💧", image: aquakittyImg,
    description: "Gatinho aquático. Cura o time a cada 2 turnos.",
    base: { hp: 60, atk: 9, def: 11, spd: 13 },
  },
  leafox: {
    id: "leafox", name: "Leafox", element: "grass", role: "tank",
    emoji: "🌿", image: leafoxImg,
    description: "Raposa-folha. Tank: provoca e absorve dano.",
    base: { hp: 80, atk: 8, def: 18, spd: 8 },
  },
  voltbun: {
    id: "voltbun", name: "Voltbun", element: "electric", role: "assassin",
    emoji: "⚡", image: voltbunImg,
    description: "Coelhinho elétrico. Assassino: muito crítico e veloz.",
    base: { hp: 48, atk: 13, def: 8, spd: 18 },
  },
  shadepup: {
    id: "shadepup", name: "Shadepup", element: "shadow", role: "mage",
    emoji: "🌙", image: shadepupImg,
    description: "Lobinho das sombras. Mago: dano ignora defesa.",
    base: { hp: 55, atk: 16, def: 9, spd: 12 },
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
  ration: {
    id: "ration", name: "Ração", emoji: "🍖",
    description: "+30 fome", priceCoins: 15,
    effect: { hunger: 30 },
  },
  candy: {
    id: "candy", name: "Doce", emoji: "🍬",
    description: "+25 felicidade", priceCoins: 12,
    effect: { happiness: 25 },
  },
  energy_drink: {
    id: "energy_drink", name: "Energético", emoji: "⚡",
    description: "+40 energia", priceCoins: 25,
    effect: { energy: 40 },
  },
  premium_meal: {
    id: "premium_meal", name: "Banquete Real", emoji: "🍱",
    description: "+100 fome, +50 felicidade, +20 XP", priceGems: 3,
    effect: { hunger: 100, happiness: 50, xp: 20 },
  },
  revive: {
    id: "revive", name: "Revive", emoji: "💖",
    description: "Cura 100% do HP instantâneo", priceGems: 5,
    effect: { hp: 9999 },
  },
};

// ===== Eggs (gacha) =====
export type Egg = {
  id: string;
  name: string;
  emoji: string;
  priceCoins?: number;
  priceGems?: number;
  description: string;
  weights: Record<string, number>; // species_id -> weight
};

export const EGGS: Record<string, Egg> = {
  basic: {
    id: "basic", name: "Ovo Comum", emoji: "🥚", priceCoins: 100,
    description: "Espécies básicas com chances iguais",
    weights: { flarepup: 20, aquakitty: 20, leafox: 20, voltbun: 20, shadepup: 20 },
  },
  rare: {
    id: "rare", name: "Ovo Raro", emoji: "🪺", priceGems: 25,
    description: "Maior chance de Shadepup + stats melhores",
    weights: { flarepup: 15, aquakitty: 15, leafox: 15, voltbun: 15, shadepup: 40 },
  },
};

// ===== Skins =====
export type Skin = {
  id: string;
  name: string;
  description: string;
  priceGems: number;
  hueRotate: number; // degrees
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
export const VIP_PRICE_GEMS = 50; // 30 dias
export const VIP_DURATION_DAYS = 30;

export const GEM_PACKS = [
  { id: "starter", gems: 30, priceBRL: 9.90, bonus: 0 },
  { id: "pro", gems: 100, priceBRL: 24.90, bonus: 20 },
  { id: "epic", gems: 300, priceBRL: 59.90, bonus: 100 },
  { id: "legend", gems: 800, priceBRL: 119.90, bonus: 300 },
];

// ===== Helpers =====
export function xpForNextLevel(level: number): number {
  return Math.floor(50 * Math.pow(1.4, level - 1));
}

export function totalStats(species: string, level: number, bonus = { hp: 0, atk: 0, def: 0, spd: 0 }) {
  const s = SPECIES[species];
  if (!s) return { hp: 0, atk: 0, def: 0, spd: 0 };
  const mult = 1 + (level - 1) * 0.12;
  return {
    hp: Math.round(s.base.hp * mult) + bonus.hp,
    atk: Math.round(s.base.atk * mult) + bonus.atk,
    def: Math.round(s.base.def * mult) + bonus.def,
    spd: Math.round(s.base.spd * mult) + bonus.spd,
  };
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
