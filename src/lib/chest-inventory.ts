import { openStoredChestFn } from "@/lib/economy.functions";
import { CHESTS, type ChestTier, type ChestReward } from "@/lib/game-data";

export const CHEST_ITEM_TYPE: Record<ChestTier, string> = {
  wood: "wood_chest",
  silver: "silver_chest",
  gold: "gold_chest",
  legendary: "legendary_chest",
  mythic: "mythic_chest",
};

/**
 * Abre 1 baú GUARDADO. Todo o sorteio, o pity e o crédito das recompensas
 * acontecem NO SERVIDOR — o cliente só recebe o resultado pra mostrar o popup.
 */
export async function openStoredChest(opts: {
  userId?: string | null;
  tier: ChestTier;
  profile?: unknown;
  patch?: unknown;
}): Promise<{ tier: ChestTier; reward: ChestReward } | { error: string }> {
  try {
    const res = await openStoredChestFn({ data: { tier: opts.tier } });
    void CHESTS[opts.tier];
    return { tier: res.tier as ChestTier, reward: res.reward as ChestReward };
  } catch (e) {
    return { error: (e as Error).message ?? "Não foi possível abrir o baú." };
  }
}
