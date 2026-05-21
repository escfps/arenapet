import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CHESTS, SPECIES, rollChest, starterMonsterStats, type ChestTier, type ChestReward } from "@/lib/game-data";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

async function addRations(userId: string, amount: number) {
  if (amount <= 0) return;
  const { data: row } = await supabaseAdmin
    .from("inventory")
    .select("quantity")
    .eq("user_id", userId)
    .eq("item_type", "ration")
    .maybeSingle();
  await supabaseAdmin
    .from("inventory")
    .upsert(
      { user_id: userId, item_type: "ration", quantity: (row?.quantity ?? 0) + amount },
      { onConflict: "user_id,item_type" }
    );
}

async function applyChest(userId: string, tier: ChestTier): Promise<ChestReward> {
  const reward = rollChest(tier);
  // gems + coins delta will be applied by caller (batched)
  if (reward.rations > 0) await addRations(userId, reward.rations);
  if (reward.petSpecies) {
    const sp = SPECIES[reward.petSpecies];
    await supabaseAdmin.from("monsters").insert({
      owner_id: userId,
      species: reward.petSpecies,
      name: sp.name,
      ...starterMonsterStats(reward.petSpecies),
    });
  }
  return reward;
}

export const claimBattlePassDaily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select(
        "gems, coins, vip_until, bp_started_at, bp_last_claim_date, bp_days_claimed, bp_silvers_given, bp_monthly_claimed"
      )
      .eq("id", userId)
      .single();
    if (error || !profile) throw new Error("Profile not found");

    const active = profile.vip_until && new Date(profile.vip_until).getTime() > Date.now();
    if (!active) throw new Error("Passe de Batalha inativo");

    const today = todayUTC();
    if (profile.bp_last_claim_date === today) {
      throw new Error("Já reivindicado hoje");
    }

    // base diária
    let gemsDelta = 5;
    let coinsDelta = 0;
    let rationsDelta = 1;
    const chestRewards: { tier: ChestTier; reward: ChestReward }[] = [];

    const newDays = (profile.bp_days_claimed ?? 0) + 1;
    let newSilvers = profile.bp_silvers_given ?? 0;
    let monthlyClaimed = profile.bp_monthly_claimed ?? false;

    // baú de prata a cada 7 dias
    const earnedSilvers = Math.floor(newDays / 7);
    if (earnedSilvers > newSilvers) {
      const silver = await applyChest(userId, "silver");
      chestRewards.push({ tier: "silver", reward: silver });
      gemsDelta += silver.gems;
      coinsDelta += silver.coins;
      newSilvers = earnedSilvers;
    }

    // marco mensal: 30 dias → 1 ouro + 1 lendário
    if (newDays >= 30 && !monthlyClaimed) {
      const gold = await applyChest(userId, "gold");
      chestRewards.push({ tier: "gold", reward: gold });
      gemsDelta += gold.gems;
      coinsDelta += gold.coins;
      const legend = await applyChest(userId, "legendary");
      chestRewards.push({ tier: "legendary", reward: legend });
      gemsDelta += legend.gems;
      coinsDelta += legend.coins;
      monthlyClaimed = true;
    }

    if (rationsDelta > 0) await addRations(userId, rationsDelta);

    await supabaseAdmin
      .from("profiles")
      .update({
        gems: (profile.gems ?? 0) + gemsDelta,
        coins: (profile.coins ?? 0) + coinsDelta,
        bp_last_claim_date: today,
        bp_days_claimed: newDays,
        bp_silvers_given: newSilvers,
        bp_monthly_claimed: monthlyClaimed,
      })
      .eq("id", userId);

    return {
      gems: gemsDelta,
      coins: coinsDelta,
      rations: rationsDelta,
      day: newDays,
      chests: chestRewards.map((c) => ({ tier: c.tier, name: CHESTS[c.tier].name })),
    };
  });
