import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  EXPEDITION_DURATIONS,
  EXPEDITION_SLOT_PRICES,
  MAX_EXPEDITION_SLOTS,
  computeExpeditionReward,
  xpForNextLevel,
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

    // load profile + monster + active expeditions count + ration inventory
    const [{ data: profile }, { data: monster }, { count: activeCount }, { data: foodRow }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,expedition_slots").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("monsters").select("id,owner_id,rank,in_team").eq("id", data.monsterId).maybeSingle(),
      supabaseAdmin.from("expeditions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("claimed", false),
      supabaseAdmin.from("inventory").select("quantity").eq("user_id", userId).eq("item_type", "ration").maybeSingle(),
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

    const haveFood = foodRow?.quantity ?? 0;
    if (haveFood < duration.foodCost) {
      throw new Error(`Precisa de ${duration.foodCost} 🍖 ração (você tem ${haveFood})`);
    }

    // Pre-roll rewards so the player sees them when claiming (gems/rations are RNG)
    const reward = computeExpeditionReward(duration, monster.rank ?? 1);

    const now = Date.now();
    const endsAt = new Date(now + duration.minutes * 60_000).toISOString();

    // Deduct food (upsert with new quantity)
    await supabaseAdmin
      .from("inventory")
      .upsert(
        { user_id: userId, item_type: "ration", quantity: haveFood - duration.foodCost },
        { onConflict: "user_id,item_type" }
      );

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

    // load monster + profile to apply rewards
    const [{ data: monster }, { data: profile }, { data: foodRow }] = await Promise.all([
      supabaseAdmin.from("monsters").select("id,owner_id,level,xp").eq("id", exp.monster_id).maybeSingle(),
      supabaseAdmin.from("profiles").select("id,coins,gems").eq("id", userId).maybeSingle(),
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

    // grant coins+gems to profile
    await supabaseAdmin
      .from("profiles")
      .update({
        coins: (profile.coins ?? 0) + (exp.coins_reward ?? 0),
        gems: (profile.gems ?? 0) + (exp.gems_reward ?? 0),
      })
      .eq("id", userId);

    // grant rations to inventory
    if ((exp.ration_drop ?? 0) > 0) {
      await supabaseAdmin
        .from("inventory")
        .upsert(
          { user_id: userId, item_type: "ration", quantity: (foodRow?.quantity ?? 0) + exp.ration_drop },
          { onConflict: "user_id,item_type" }
        );
    }

    // grant XP to monster (handle level ups)
    if (monster && monster.owner_id === userId) {
      let xp = (monster.xp ?? 0) + (exp.xp_reward ?? 0);
      let lvl = monster.level ?? 1;
      while (xp >= xpForNextLevel(lvl)) {
        xp -= xpForNextLevel(lvl);
        lvl += 1;
      }
      await supabaseAdmin.from("monsters").update({ xp, level: lvl }).eq("id", monster.id);
    }

    return {
      ok: true,
      xp: exp.xp_reward,
      coins: exp.coins_reward,
      gems: exp.gems_reward,
      rations: exp.ration_drop,
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
