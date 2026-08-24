// Server-only economy helpers. All currency/item/pet grants must go through here.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CHESTS, CHEST_PITY, PITY_COLUMN, CHEST_PITY_MYTHIC, PITY_MYTHIC_COLUMN,
  rollChest, SPECIES, starterMonsterStats,
  type ChestTier, type ChestReward, type Rarity,
} from "@/lib/game-data";

export const CHEST_ITEM_TYPE: Record<ChestTier, string> = {
  wood: "wood_chest",
  silver: "silver_chest",
  gold: "gold_chest",
  legendary: "legendary_chest",
  mythic: "mythic_chest",
};

export type ProfileEconomy = Record<string, unknown> & {
  id: string;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  vip_until: string | null;
};

export async function getProfile(userId: string): Promise<ProfileEconomy> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error || !data) throw new Error("Perfil não encontrado");
  return data as unknown as ProfileEconomy;
}

export async function patchProfile(userId: string, patch: Record<string, unknown>) {
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabaseAdmin
    .from("profiles")
    .update(patch as never)
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

/** Cobra moedas/gemas validando saldo no servidor. Devolve o patch a aplicar. */
export function charge(
  profile: ProfileEconomy,
  cost: { coins?: number; gems?: number },
): { coins: number; gems: number } {
  const coins = profile.coins ?? 0;
  const gems = profile.gems ?? 0;
  if ((cost.coins ?? 0) > 0 && coins < (cost.coins ?? 0)) throw new Error("Moedas insuficientes!");
  if ((cost.gems ?? 0) > 0 && gems < (cost.gems ?? 0)) throw new Error("Diamantes insuficientes!");
  return { coins: coins - (cost.coins ?? 0), gems: gems - (cost.gems ?? 0) };
}

export async function getItemQty(userId: string, itemType: string): Promise<number> {
  const { data } = await supabaseAdmin
    .from("inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .maybeSingle();
  return data?.quantity ?? 0;
}

export async function addItem(userId: string, itemType: string, qty: number) {
  if (qty === 0) return;
  const have = await getItemQty(userId, itemType);
  const { error } = await supabaseAdmin.from("inventory").upsert(
    { user_id: userId, item_type: itemType, quantity: Math.max(0, have + qty) },
    { onConflict: "user_id,item_type" },
  );
  if (error) throw new Error(error.message);
}

export async function consumeItem(userId: string, itemType: string, qty = 1) {
  const have = await getItemQty(userId, itemType);
  if (have < qty) throw new Error("Você não tem esse item.");
  const { error } = await supabaseAdmin
    .from("inventory")
    .update({ quantity: have - qty })
    .eq("user_id", userId)
    .eq("item_type", itemType);
  if (error) throw new Error(error.message);
}

export type NewMonster = {
  species: string;
  bonus?: number;
  shiny?: boolean;
  in_team?: boolean;
  team_position?: number;
};

export async function grantMonsters(userId: string, list: NewMonster[]) {
  if (list.length === 0) return;
  const rows = list.map((m) => {
    const sp = SPECIES[m.species];
    if (!sp) throw new Error("Espécie inválida");
    const base = starterMonsterStats(m.species);
    const bonus = m.bonus ?? 0;
    return {
      owner_id: userId,
      species: m.species,
      name: sp.name,
      hp: base.hp + bonus,
      atk: base.atk + Math.floor(bonus / 2),
      def: base.def + Math.floor(bonus / 2),
      spd: base.spd + Math.floor(bonus / 2),
      int: base.int,
      is_shiny: m.shiny === true,
      ...(m.in_team != null ? { in_team: m.in_team } : {}),
      ...(m.team_position != null ? { team_position: m.team_position } : {}),
    };
  });
  const { error } = await supabaseAdmin.from("monsters").insert(rows as never);
  if (error) throw new Error(error.message);
}

/**
 * Sorteia e credita 1 baú (sem cobrar preço). Toda a aleatoriedade e o pity
 * acontecem aqui, no servidor — o cliente só recebe o resultado.
 */
export async function grantChestOpening(
  userId: string,
  tier: ChestTier,
  profile: ProfileEconomy,
): Promise<{ tier: ChestTier; reward: ChestReward; profilePatch: Record<string, number> }> {
  const pity = CHEST_PITY[tier];
  const pityCol = PITY_COLUMN[tier];
  const currentPity = pityCol ? ((profile[pityCol] as number) ?? 0) : 0;
  const mythicPity = CHEST_PITY_MYTHIC[tier];
  const mythicPityCol = PITY_MYTHIC_COLUMN[tier];
  const currentMythicPity = mythicPityCol ? ((profile[mythicPityCol] as number) ?? 0) : 0;

  let forceRarity: Rarity | undefined;
  if (mythicPity && mythicPityCol && currentMythicPity + 1 >= mythicPity.limit) {
    forceRarity = "mythic";
  } else if (pity && currentPity + 1 >= pity.limit) {
    forceRarity = pity.rarities[Math.floor(Math.random() * pity.rarities.length)];
  }

  const reward = rollChest(tier, forceRarity);
  const gotRarity = reward.petSpecies ? SPECIES[reward.petSpecies].rarity : null;

  const profilePatch: Record<string, number> = {};
  if (reward.coins) profilePatch.coins = (profile.coins ?? 0) + reward.coins;
  if (reward.gems) profilePatch.gems = (profile.gems ?? 0) + reward.gems;
  if (pity && pityCol) {
    profilePatch[pityCol] = gotRarity && pity.rarities.includes(gotRarity) ? 0 : currentPity + 1;
  }
  if (mythicPity && mythicPityCol) {
    profilePatch[mythicPityCol] = gotRarity === "mythic" ? 0 : currentMythicPity + 1;
  }

  if (reward.rations > 0) await addItem(userId, "ration", reward.rations);
  if (reward.petSpecies) {
    await grantMonsters(userId, [{ species: reward.petSpecies, shiny: reward.petShiny === true }]);
  }

  void CHESTS[tier];
  return { tier, reward, profilePatch };
}

export async function getMyMonster(userId: string, monsterId: string) {
  const { data, error } = await supabaseAdmin
    .from("monsters")
    .select("*")
    .eq("id", monsterId)
    .eq("owner_id", userId)
    .single();
  if (error || !data) throw new Error("Pokémon não encontrado");
  return data as unknown as Record<string, unknown>;
}

export async function patchMonster(monsterId: string, patch: Record<string, unknown>) {
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabaseAdmin
    .from("monsters")
    .update(patch as never)
    .eq("id", monsterId);
  if (error) throw new Error(error.message);
}

export { supabaseAdmin };
