import { supabase } from "@/integrations/supabase/client";
import {
  CHESTS, CHEST_PITY, PITY_COLUMN, CHEST_PITY_MYTHIC, PITY_MYTHIC_COLUMN, rollChest, SPECIES, starterMonsterStats,
  type ChestTier, type ChestReward, type Rarity,
} from "@/lib/game-data";

export const CHEST_ITEM_TYPE: Record<ChestTier, string> = {
  wood: "wood_chest",
  silver: "silver_chest",
  gold: "gold_chest",
  legendary: "legendary_chest",
};

/** Soma N baús de um tier no inventário do usuário (upsert). */
export async function storeChest(userId: string, tier: ChestTier, qty = 1) {
  const item = CHEST_ITEM_TYPE[tier];
  const { data: row } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_type", item)
    .maybeSingle();
  await supabase.from("inventory").upsert(
    { user_id: userId, item_type: item, quantity: (row?.quantity ?? 0) + qty },
    { onConflict: "user_id,item_type" }
  );
}

/**
 * Abre 1 baú GUARDADO (sem cobrar preço). Decrementa o inventário,
 * aplica pity, sorteia, credita recompensas (moedas/gemas via patch,
 * rações via inventory, pet via monsters).
 *
 * Retorna o resultado para a UI exibir o popup.
 */
export async function openStoredChest(opts: {
  userId: string;
  tier: ChestTier;
  profile: Record<string, unknown> & { coins: number; gems: number };
  patch: (p: Record<string, number>) => Promise<unknown> | unknown;
}): Promise<{ tier: ChestTier; reward: ChestReward } | { error: string }> {
  const { userId, tier, profile, patch } = opts;
  const item = CHEST_ITEM_TYPE[tier];

  // 1. Verifica e decrementa o inventário
  const { data: row } = await supabase
    .from("inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_type", item)
    .maybeSingle();
  const have = row?.quantity ?? 0;
  if (have <= 0) return { error: "Você não tem esse baú no inventário." };

  await supabase
    .from("inventory")
    .update({ quantity: have - 1 })
    .eq("user_id", userId)
    .eq("item_type", item);

  // 2. Pity
  const pity = CHEST_PITY[tier];
  const pityCol = PITY_COLUMN[tier];
  const currentPity = pityCol ? ((profile[pityCol] as number) ?? 0) : 0;
  const mythicPity = CHEST_PITY_MYTHIC[tier];
  const mythicPityCol = PITY_MYTHIC_COLUMN[tier];
  const currentMythicPity = mythicPityCol ? ((profile[mythicPityCol] as number) ?? 0) : 0;

  // Pity mítico (teto 50) tem prioridade — força MÍTICO puro
  let forceRarity: Rarity | undefined;
  if (mythicPity && mythicPityCol && currentMythicPity + 1 >= mythicPity.limit) {
    forceRarity = "mythic";
  } else if (pity && currentPity + 1 >= pity.limit) {
    forceRarity = pity.rarities[Math.floor(Math.random() * pity.rarities.length)];
  }

  const reward = rollChest(tier, forceRarity);

  // 3. Atualiza moedas/gemas/pity no profile
  const patchObj: Record<string, number> = {
    coins: profile.coins + reward.coins,
    gems: profile.gems + reward.gems,
  };
  const gotRarity = reward.petSpecies ? SPECIES[reward.petSpecies].rarity : null;
  if (pity && pityCol) {
    patchObj[pityCol] = gotRarity && pity.rarities.includes(gotRarity) ? 0 : currentPity + 1;
  }
  if (mythicPity && mythicPityCol) {
    patchObj[mythicPityCol] = gotRarity === "mythic" ? 0 : currentMythicPity + 1;
  }
  await patch(patchObj);

  // 4. Rações no inventário
  if (reward.rations > 0) {
    const { data: rRow } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("user_id", userId)
      .eq("item_type", "ration")
      .maybeSingle();
    await supabase.from("inventory").upsert(
      { user_id: userId, item_type: "ration", quantity: (rRow?.quantity ?? 0) + reward.rations },
      { onConflict: "user_id,item_type" }
    );
  }

  // 5. Pet
  if (reward.petSpecies) {
    const sp = SPECIES[reward.petSpecies];
    await supabase.from("monsters").insert({
      owner_id: userId,
      species: reward.petSpecies,
      name: sp.name,
      ...starterMonsterStats(reward.petSpecies),
      is_shiny: reward.petShiny === true,
    });
  }

  // Garante que o nome existe (uso na UI)
  void CHESTS[tier];
  return { tier, reward };
}
