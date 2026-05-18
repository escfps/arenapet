import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  EXPEDITION_DURATIONS,
  EXPEDITION_SLOT_PRICES,
  MAX_EXPEDITION_SLOTS,
  computeExpeditionReward,
  computeBattleEnergy,
  xpForNextLevel,
  rollLevelUpRewards,
  SPECIES,
  starterMonsterStats,
} from "@/lib/game-data";

const StartSchema = z.object({
  monsterId: z.string().uuid(),
  durationId: z.string().min(1).max(32),
});

export const startExpedition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => StartSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const duration = EXPEDITION_DURATIONS.find((d) => d.id === data.durationId);
    if (!duration) throw new Error("Duração inválida");

    // load profile + monster + active expeditions count
    const [{ data: profile }, { data: monster }, { count: activeCount }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,expedition_slots").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("monsters").select("id,owner_id,rank,in_team,battle_energy,battle_energy_at").eq("id", data.monsterId).maybeSingle(),
      supabaseAdmin.from("expeditions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("claimed", false),
    ]);
    if (!profile) throw new Error("Perfil não encontrado");
    if (!monster || monster.owner_id !== userId) throw new Error("Bichinho inválido");
    if (monster.in_team) throw new Error("Tire o bichinho do time pra mandá-lo em expedição");

    const slots = profile.expedition_slots ?? 1;
    if ((activeCount ?? 0) >= slots) throw new Error(`Você só tem ${slots} slot(s) de expedição`);

    // Block if monster is already in another active expedition
    const { data: monActive } = await supabaseAdmin
      .from("expeditions")
      .select("id")
      .eq("monster_id", data.monsterId)
      .eq("claimed", false)
      .maybeSingle();
    if (monActive) throw new Error("Esse bichinho já está em expedição");

    // Check pet battle energy (regenerated)
    const en = computeBattleEnergy(monster.battle_energy, monster.battle_energy_at);
    if (en.energy < duration.foodCost) {
      throw new Error(`Esse bichinho precisa de ${duration.foodCost} ⚡ (tem ${en.energy})`);
    }

    // Pre-roll rewards so the player sees them when claiming
    const reward = computeExpeditionReward(duration, monster.rank ?? 1);

    const now = Date.now();
    const endsAt = new Date(now + duration.minutes * 60_000).toISOString();

    // Deduct energy from the pet
    await supabaseAdmin
      .from("monsters")
      .update({
        battle_energy: en.energy - duration.foodCost,
        battle_energy_at: en.nextStoredAt,
      })
      .eq("id", data.monsterId);

    const { error } = await supabaseAdmin.from("expeditions").insert({
      user_id: userId,
      monster_id: data.monsterId,
      duration_minutes: duration.minutes,
      ends_at: endsAt,
      food_cost: duration.foodCost,
      xp_reward: reward.xp,
      coins_reward: reward.coins,
      gems_reward: reward.gems,
      ration_drop: reward.rations,
    });
    if (error) throw new Error(error.message);
    return { ok: true, endsAt };
  });

const ClaimSchema = z.object({ expeditionId: z.string().uuid() });

export const claimExpedition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => ClaimSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: exp } = await supabaseAdmin
      .from("expeditions")
      .select("*")
      .eq("id", data.expeditionId)
      .maybeSingle();
    if (!exp || exp.user_id !== userId) throw new Error("Expedição inválida");
    if (exp.claimed) throw new Error("Já reclamada");
    if (new Date(exp.ends_at).getTime() > Date.now()) throw new Error("Expedição ainda não acabou");

    // load profile to apply rewards
    const [{ data: profile }, { data: foodRow }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,coins,gems,xp,level").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("inventory").select("quantity").eq("user_id", userId).eq("item_type", "ration").maybeSingle(),
    ]);
    if (!profile) throw new Error("Perfil não encontrado");

    // mark claimed first to avoid double-claim
    const { error: cErr } = await supabaseAdmin
      .from("expeditions")
      .update({ claimed: true })
      .eq("id", exp.id)
      .eq("claimed", false);
    if (cErr) throw new Error(cErr.message);

    // XP da expedição agora vai pra CONTA (não pro pet)
    const prevLevel = profile.level ?? 1;
    let newXp = (profile.xp ?? 0) + (exp.xp_reward ?? 0);
    let newLevel = prevLevel;
    while (newXp >= xpForNextLevel(newLevel)) {
      newXp -= xpForNextLevel(newLevel);
      newLevel += 1;
    }

    // Recompensas de level-up (baú madeira / ouro a cada 10)
    const lvRew = newLevel > prevLevel ? rollLevelUpRewards(prevLevel, newLevel) : null;

    await supabaseAdmin
      .from("profiles")
      .update({
        coins: (profile.coins ?? 0) + (exp.coins_reward ?? 0) + (lvRew?.coins ?? 0),
        gems: (profile.gems ?? 0) + (exp.gems_reward ?? 0) + (lvRew?.gems ?? 0),
        xp: newXp,
        level: newLevel,
      })
      .eq("id", userId);

    // grant rations to inventory (expedition drops + level-up baús)
    const totalRations = (exp.ration_drop ?? 0) + (lvRew?.rations ?? 0);
    if (totalRations > 0) {
      await supabaseAdmin
        .from("inventory")
        .upsert(
          { user_id: userId, item_type: "ration", quantity: (foodRow?.quantity ?? 0) + totalRations },
          { onConflict: "user_id,item_type" }
        );
    }

    // pets sorteados nos baús de level-up
    if (lvRew && lvRew.petSpecies.length > 0) {
      const rows = lvRew.petSpecies.map((sid) => {
        const sp = SPECIES[sid];
        return { owner_id: userId, species: sid, name: sp.name, ...starterMonsterStats(sid) };
      });
      await supabaseAdmin.from("monsters").insert(rows);
    }

    return {
      ok: true,
      xp: exp.xp_reward,
      coins: exp.coins_reward,
      gems: exp.gems_reward,
      rations: exp.ration_drop,
      levelUp: lvRew
        ? { fromLevel: prevLevel, toLevel: newLevel, coins: lvRew.coins, gems: lvRew.gems, rations: lvRew.rations, pets: lvRew.petSpecies.length, woodChests: lvRew.woodChests, goldChests: lvRew.goldChests }
        : null,
    };
  });

const CancelSchema = z.object({ expeditionId: z.string().uuid() });

export const cancelExpedition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CancelSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: exp } = await supabaseAdmin
      .from("expeditions")
      .select("id,user_id,claimed")
      .eq("id", data.expeditionId)
      .maybeSingle();
    if (!exp || exp.user_id !== userId) throw new Error("Expedição inválida");
    if (exp.claimed) throw new Error("Já reclamada");
    // Cancel = mark claimed without rewards (food não volta)
    await supabaseAdmin.from("expeditions").update({ claimed: true }).eq("id", exp.id);
    return { ok: true };
  });

const SwapSchema = z.object({
  expeditionId: z.string().uuid(),
  newMonsterId: z.string().uuid(),
});

export const EXPEDITION_SWAP_GEM_COST = 50;

export const swapExpeditionMonster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => SwapSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const [{ data: exp }, { data: profile }, { data: newMon }, { data: dupe }] = await Promise.all([
      supabaseAdmin.from("expeditions").select("id,user_id,claimed,monster_id").eq("id", data.expeditionId).maybeSingle(),
      supabaseAdmin.from("profiles").select("id,gems").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("monsters").select("id,owner_id,in_team").eq("id", data.newMonsterId).maybeSingle(),
      supabaseAdmin.from("expeditions").select("id").eq("monster_id", data.newMonsterId).eq("claimed", false).maybeSingle(),
    ]);
    if (!exp || exp.user_id !== userId) throw new Error("Expedição inválida");
    if (exp.claimed) throw new Error("Expedição já encerrada");
    if (!newMon || newMon.owner_id !== userId) throw new Error("Bichinho inválido");
    if (newMon.in_team) throw new Error("Tire o novo bichinho do time antes");
    if (dupe) throw new Error("Esse bichinho já está em expedição");
    if (newMon.id === exp.monster_id) throw new Error("Escolha um bichinho diferente");
    if (!profile) throw new Error("Perfil não encontrado");
    if ((profile.gems ?? 0) < EXPEDITION_SWAP_GEM_COST) {
      throw new Error(`Precisa de ${EXPEDITION_SWAP_GEM_COST} 💎`);
    }

    await Promise.all([
      supabaseAdmin.from("profiles").update({ gems: profile.gems - EXPEDITION_SWAP_GEM_COST }).eq("id", userId),
      supabaseAdmin.from("expeditions").update({ monster_id: data.newMonsterId }).eq("id", exp.id),
    ]);
    return { ok: true, paid: EXPEDITION_SWAP_GEM_COST };
  });

export const buyExpeditionSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id,gems,expedition_slots")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Perfil não encontrado");
    const current = profile.expedition_slots ?? 1;
    if (current >= MAX_EXPEDITION_SLOTS) throw new Error("Você já tem o máximo de slots");
    const next = current + 1;
    const price = EXPEDITION_SLOT_PRICES[next] ?? 999;
    if ((profile.gems ?? 0) < price) throw new Error(`Precisa de ${price} 💎`);
    await supabaseAdmin
      .from("profiles")
      .update({ gems: profile.gems - price, expedition_slots: next })
      .eq("id", userId);
    return { ok: true, slots: next, paid: price };
  });
