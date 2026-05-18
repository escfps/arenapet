import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TRADE_FEE_COINS, TRADE_FEE_GEMS, MAX_TRADEABLE_RANK, SPECIES } from "@/lib/game-data";

const CreateTradeSchema = z.object({
  toUsername: z.string().min(1).max(64),
  fromMonsterId: z.string().uuid(),
});

export const createTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateTradeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;

    // find recipient
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .ilike("username", data.toUsername)
      .maybeSingle();
    if (!target) throw new Error("Jogador não encontrado");
    if (target.id === userId) throw new Error("Você não pode trocar consigo mesmo");

    // validate monster
    const { data: mon } = await supabaseAdmin
      .from("monsters")
      .select("id,owner_id,species,rank,in_team")
      .eq("id", data.fromMonsterId)
      .maybeSingle();
    if (!mon || mon.owner_id !== userId) throw new Error("Monstro inválido");
    if (mon.in_team) throw new Error("Tire o monstro do time antes");
    const sp = SPECIES[mon.species];
    if (sp?.rarity === "legendary" || sp?.rarity === "mythic") throw new Error("Lendários e Míticos não podem ser trocados");
    if ((mon.rank ?? 1) > MAX_TRADEABLE_RANK) throw new Error(`Bichinhos ✦${MAX_TRADEABLE_RANK + 1}+ não podem ser trocados`);

    // check pending duplicate
    const { data: existing } = await supabaseAdmin
      .from("trades")
      .select("id")
      .eq("from_user_id", userId)
      .eq("to_user_id", target.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("Você já tem uma oferta pendente para este jogador");

    const { data: inserted, error } = await supabaseAdmin
      .from("trades")
      .insert({
        from_user_id: userId,
        to_user_id: target.id,
        from_monster_id: data.fromMonsterId,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { tradeId: inserted.id, toUsername: target.username };
  });

const RespondSchema = z.object({
  tradeId: z.string().uuid(),
  withMonsterId: z.string().uuid(),
});

export const respondToTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => RespondSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: trade } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!trade || trade.to_user_id !== userId) throw new Error("Troca inválida");
    if (trade.status !== "pending") throw new Error("Esta troca não está mais pendente");
    if (new Date(trade.expires_at).getTime() < Date.now()) throw new Error("Esta troca expirou");

    const { data: mon } = await supabaseAdmin
      .from("monsters")
      .select("id,owner_id,species,rank,in_team")
      .eq("id", data.withMonsterId)
      .maybeSingle();
    if (!mon || mon.owner_id !== userId) throw new Error("Monstro inválido");
    if (mon.in_team) throw new Error("Tire o monstro do time antes");
    const sp = SPECIES[mon.species];
    if (sp?.rarity === "legendary" || sp?.rarity === "mythic") throw new Error("Lendários e Míticos não podem ser trocados");
    if ((mon.rank ?? 1) > MAX_TRADEABLE_RANK) throw new Error(`Bichinhos ✦${MAX_TRADEABLE_RANK + 1}+ não podem ser trocados`);

    const { error } = await supabaseAdmin
      .from("trades")
      .update({ to_monster_id: data.withMonsterId, status: "accepted" })
      .eq("id", data.tradeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ConfirmSchema = z.object({ tradeId: z.string().uuid() });

export const confirmTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => ConfirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: trade } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!trade) throw new Error("Troca não encontrada");
    if (trade.status !== "accepted") throw new Error("Aguardando o outro jogador escolher um monstro");
    if (userId !== trade.from_user_id && userId !== trade.to_user_id) throw new Error("Sem permissão");

    const isFrom = userId === trade.from_user_id;
    const patch = isFrom ? { from_confirmed: true } : { to_confirmed: true };
    const willComplete = isFrom ? trade.to_confirmed : trade.from_confirmed;

    if (!willComplete) {
      // just record confirmation
      const { error } = await supabaseAdmin.from("trades").update(patch).eq("id", trade.id);
      if (error) throw new Error(error.message);
      return { ok: true, completed: false };
    }

    // Both confirmed — execute atomic swap
    // 1. validate balances + monsters still owned + not in team
    if (!trade.to_monster_id) throw new Error("Troca ainda sem monstro do destinatário");
    const toMonsterId = trade.to_monster_id;
    const [{ data: fromProfile }, { data: toProfile }, { data: monFrom }, { data: monTo }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,coins,gems").eq("id", trade.from_user_id).single(),
      supabaseAdmin.from("profiles").select("id,coins,gems").eq("id", trade.to_user_id).single(),
      supabaseAdmin.from("monsters").select("id,owner_id,in_team").eq("id", trade.from_monster_id).maybeSingle(),
      supabaseAdmin.from("monsters").select("id,owner_id,in_team").eq("id", toMonsterId).maybeSingle(),
    ]);
    if (!monFrom || monFrom.owner_id !== trade.from_user_id || monFrom.in_team) {
      await supabaseAdmin.from("trades").update({ status: "cancelled" }).eq("id", trade.id);
      throw new Error("Monstro do remetente não disponível — troca cancelada");
    }
    if (!monTo || monTo.owner_id !== trade.to_user_id || monTo.in_team) {
      await supabaseAdmin.from("trades").update({ status: "cancelled" }).eq("id", trade.id);
      throw new Error("Monstro do destinatário não disponível — troca cancelada");
    }
    if (!fromProfile || fromProfile.coins < TRADE_FEE_COINS || fromProfile.gems < TRADE_FEE_GEMS) {
      throw new Error("Remetente sem moedas/gemas suficientes pra taxa");
    }
    if (!toProfile || toProfile.coins < TRADE_FEE_COINS || toProfile.gems < TRADE_FEE_GEMS) {
      throw new Error("Destinatário sem moedas/gemas suficientes pra taxa");
    }

    // 2. swap ownership + debit fees + mark completed
    await Promise.all([
      supabaseAdmin.from("monsters").update({ owner_id: trade.to_user_id }).eq("id", trade.from_monster_id),
      supabaseAdmin.from("monsters").update({ owner_id: trade.from_user_id }).eq("id", toMonsterId),
      supabaseAdmin.from("profiles").update({
        coins: fromProfile.coins - TRADE_FEE_COINS,
        gems: fromProfile.gems - TRADE_FEE_GEMS,
      }).eq("id", trade.from_user_id),
      supabaseAdmin.from("profiles").update({
        coins: toProfile.coins - TRADE_FEE_COINS,
        gems: toProfile.gems - TRADE_FEE_GEMS,
      }).eq("id", trade.to_user_id),
      supabaseAdmin.from("trades").update({
        ...patch,
        status: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", trade.id),
    ]);

    return { ok: true, completed: true };
  });

const CancelSchema = z.object({ tradeId: z.string().uuid() });

export const cancelTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: trade } = await supabaseAdmin
      .from("trades")
      .select("from_user_id,to_user_id,status")
      .eq("id", data.tradeId)
      .maybeSingle();
    if (!trade) throw new Error("Troca não encontrada");
    if (userId !== trade.from_user_id && userId !== trade.to_user_id) throw new Error("Sem permissão");
    if (trade.status === "completed") throw new Error("Troca já completada");
    const { error } = await supabaseAdmin.from("trades").update({ status: "cancelled" }).eq("id", data.tradeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
