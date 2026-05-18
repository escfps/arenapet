export type CropDef = {
  id: string;
  name: string;
  emoji: string;
  seedling: string;
  growing: string;
  ready: string;
  seedCost: number;
  sellPrice: number;
  growSeconds: number;
  xp: number;
};

export const CROPS: Record<string, CropDef> = {
  morango: {
    id: "morango", name: "Morango", emoji: "🍓",
    seedling: "🌱", growing: "🌿", ready: "🍓",
    seedCost: 10, sellPrice: 20, growSeconds: 30, xp: 2,
  },
  cenoura: {
    id: "cenoura", name: "Cenoura", emoji: "🥕",
    seedling: "🌱", growing: "🌿", ready: "🥕",
    seedCost: 20, sellPrice: 45, growSeconds: 60, xp: 4,
  },
  milho: {
    id: "milho", name: "Milho", emoji: "🌽",
    seedling: "🌱", growing: "🌾", ready: "🌽",
    seedCost: 40, sellPrice: 95, growSeconds: 120, xp: 8,
  },
  tomate: {
    id: "tomate", name: "Tomate", emoji: "🍅",
    seedling: "🌱", growing: "🌿", ready: "🍅",
    seedCost: 75, sellPrice: 180, growSeconds: 240, xp: 14,
  },
  melancia: {
    id: "melancia", name: "Melancia", emoji: "🍉",
    seedling: "🌱", growing: "🌿", ready: "🍉",
    seedCost: 150, sellPrice: 400, growSeconds: 480, xp: 30,
  },
};

export type AnimalDef = {
  id: string;
  name: string;
  emoji: string;
  buyCost: number;
  produces: string;
  productEmoji: string;
  productSell: number;
  cooldownSeconds: number;
  xp: number;
};

export const ANIMALS: Record<string, AnimalDef> = {
  galinha: {
    id: "galinha", name: "Galinha", emoji: "🐔",
    buyCost: 200, produces: "Ovo", productEmoji: "🥚",
    productSell: 30, cooldownSeconds: 90, xp: 5,
  },
  vaca: {
    id: "vaca", name: "Vaca", emoji: "🐄",
    buyCost: 800, produces: "Leite", productEmoji: "🥛",
    productSell: 140, cooldownSeconds: 240, xp: 18,
  },
  porco: {
    id: "porco", name: "Porco", emoji: "🐖",
    buyCost: 500, produces: "Trufa", productEmoji: "🍄",
    productSell: 90, cooldownSeconds: 180, xp: 12,
  },
};

export function getCropStage(plantedAt: string | null, cropId: string | null): "empty" | "seedling" | "growing" | "ready" {
  if (!plantedAt || !cropId) return "empty";
  const crop = CROPS[cropId];
  if (!crop) return "empty";
  const elapsed = (Date.now() - new Date(plantedAt).getTime()) / 1000;
  if (elapsed >= crop.growSeconds) return "ready";
  if (elapsed >= crop.growSeconds * 0.5) return "growing";
  return "seedling";
}

export function getCropProgress(plantedAt: string, cropId: string): number {
  const crop = CROPS[cropId];
  if (!crop) return 0;
  const elapsed = (Date.now() - new Date(plantedAt).getTime()) / 1000;
  return Math.min(1, elapsed / crop.growSeconds);
}

export function getAnimalReady(lastCollected: string, animalId: string): { ready: boolean; progress: number } {
  const a = ANIMALS[animalId];
  if (!a) return { ready: false, progress: 0 };
  const elapsed = (Date.now() - new Date(lastCollected).getTime()) / 1000;
  return { ready: elapsed >= a.cooldownSeconds, progress: Math.min(1, elapsed / a.cooldownSeconds) };
}

export function xpToLevel(xp: number): { level: number; nextXp: number; progress: number } {
  // level n requires 50*n*(n+1)/2 cumulative xp roughly
  let level = 1;
  let needed = 50;
  let total = 0;
  while (xp >= total + needed) {
    total += needed;
    level += 1;
    needed = 50 * level;
  }
  return { level, nextXp: total + needed, progress: (xp - total) / needed };
}
