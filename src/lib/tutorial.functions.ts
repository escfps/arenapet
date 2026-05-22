import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { CHESTS, SPECIES, rollChest, starterMonsterStats, type ChestReward } from "@/lib/game-data";

/**
 * Entrega o baú de prata de recompensa por concluir o tutorial.
 * Idempotente: usa profiles.tutorial_reward_claimed pra garantir só 1x por conta.
 */
export const claimTutorialReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // 1. Lê o profile + flag de já reclamou
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("coins, gems, tutorial_reward_claimed")
      .eq("id", userId)
      .single();

    if (profErr || !prof) {
      throw new Error("Perfil não encontrado");
    }

    if (prof.tutorial_reward_claimed) {
      // Já reclamou — devolve um payload "vazio" que o front trata
      return { alreadyClaimed: true as const };
    }

    // 2. Marca como reclamado JÁ (update-then-check pra evitar double-grant)
    const { data: updated, error: updErr } = await supabase
      .from("profiles")
      .update({ tutorial_reward_claimed: true })
      .eq("id", userId)
      .eq("tutorial_reward_claimed", false)
      .select("id")
      .maybeSingle();

    if (updErr) {
      throw new Error("Erro ao registrar recompensa: " + updErr.message);
    }
    if (!updated) {
      // Outra requisição ganhou a corrida
      return { alreadyClaimed: true as const };
    }

    // 3. Rola o baú de prata
    const reward: ChestReward = rollChest("silver");

    // 4. Aplica recompensas
    const updates: { coins?: number; gems?: number } = {};
    if (reward.coins > 0) updates.coins = (prof.coins ?? 0) + reward.coins;
    if (reward.gems > 0) updates.gems = (prof.gems ?? 0) + reward.gems;

    if (Object.keys(updates).length > 0) {
      await supabase.from("profiles").update(updates).eq("id", userId);
    }

    if (reward.rations > 0) {
      const { data: foodRow } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("user_id", userId)
        .eq("item_type", "ration")
        .maybeSingle();
      const current = foodRow?.quantity ?? 0;
      await supabase
        .from("inventory")
        .upsert(
          { user_id: userId, item_type: "ration", quantity: current + reward.rations },
          { onConflict: "user_id,item_type" }
        );
    }

    if (reward.petSpecies && SPECIES[reward.petSpecies]) {
      const sp = SPECIES[reward.petSpecies];
      await supabase.from("monsters").insert({
        owner_id: userId,
        species: reward.petSpecies,
        name: sp.name,
        ...starterMonsterStats(reward.petSpecies),
      });
    }

    // 5. Retorna o payload pro front exibir o ChestRewardPopup
    return {
      alreadyClaimed: false as const,
      tier: "silver" as const,
      reward,
      chestName: CHESTS.silver.name,
    };
  });
