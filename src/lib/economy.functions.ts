import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ChestTierSchema = z.enum(["wood", "silver", "gold", "legendary", "mythic"]);
const PaySchema = z.enum(["coins", "gems"]);

/** Compra + abre um baú na hora (sorteio no servidor). */
export const buyAndOpenChest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tier: ChestTierSchema, payWith: PaySchema.default("gems") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { CHESTS } = await import("./game-data");
    const c = CHESTS[data.tier];
    const useCoins = data.payWith === "coins" && c.priceCoins != null;
    const useGems = !useCoins && c.priceGems != null;
    if (!useCoins && !useGems) throw new Error("Baú não está à venda.");

    const profile = await S.getProfile(context.userId);
    const paid = S.charge(profile, {
      coins: useCoins ? c.priceCoins ?? 0 : 0,
      gems: useGems ? c.priceGems ?? 0 : 0,
    });
    profile.coins = paid.coins;
    profile.gems = paid.gems;

    const { reward, profilePatch } = await S.grantChestOpening(context.userId, data.tier, profile);
    await S.patchProfile(context.userId, { coins: paid.coins, gems: paid.gems, ...profilePatch });
    return { tier: data.tier, reward };
  });

/** Compra um baú e guarda no inventário. */
export const buyChestToInventory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ tier: ChestTierSchema, payWith: PaySchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { CHESTS } = await import("./game-data");
    const c = CHESTS[data.tier];
    const useCoins = data.payWith === "coins" && c.priceCoins != null;
    const useGems = !useCoins && c.priceGems != null;
    if (!useCoins && !useGems) throw new Error("Baú não está à venda.");

    const profile = await S.getProfile(context.userId);
    const paid = S.charge(profile, {
      coins: useCoins ? c.priceCoins ?? 0 : 0,
      gems: useGems ? c.priceGems ?? 0 : 0,
    });
    await S.patchProfile(context.userId, { coins: paid.coins, gems: paid.gems });
    await S.addItem(context.userId, S.CHEST_ITEM_TYPE[data.tier], 1);
    return { ok: true };
  });

/** Abre um baú guardado no inventário. */
export const openStoredChestFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ tier: ChestTierSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const item = S.CHEST_ITEM_TYPE[data.tier];
    await S.consumeItem(context.userId, item, 1);
    const profile = await S.getProfile(context.userId);
    const { reward, profilePatch } = await S.grantChestOpening(context.userId, data.tier, profile);
    await S.patchProfile(context.userId, profilePatch);
    return { tier: data.tier, reward };
  });

/** Choca ovo(s). */
export const hatchEgg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ eggId: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { EGGS, rollEgg } = await import("./game-data");
    const egg = EGGS[data.eggId];
    if (!egg) throw new Error("Ovo inválido");

    const profile = await S.getProfile(context.userId);
    const paid = S.charge(profile, { coins: egg.priceCoins ?? 0, gems: egg.priceGems ?? 0 });
    await S.patchProfile(context.userId, { coins: paid.coins, gems: paid.gems });

    const pack = egg.pack ?? 1;
    const bonus = data.eggId === "rare" || data.eggId === "rare_10" ? 5 : 0;
    const rolled: string[] = [];
    for (let i = 0; i < pack; i++) rolled.push(rollEgg(data.eggId));
    await S.grantMonsters(context.userId, rolled.map((species) => ({ species, bonus })));
    return { rolled };
  });

/** Recarrega energia de batalha (1 pet ou o time inteiro) por diamantes. */
export const refillBattleEnergy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ petId: z.string().uuid().optional(), all: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { MAX_BATTLE_ENERGY, ENERGY_REFILL_GEM_COST, ENERGY_REFILL_ALL_GEM_COST } =
      await import("./game-data");
    const cost = data.all ? ENERGY_REFILL_ALL_GEM_COST : ENERGY_REFILL_GEM_COST;
    const profile = await S.getProfile(context.userId);
    const paid = S.charge(profile, { gems: cost });

    const patch = { battle_energy: MAX_BATTLE_ENERGY, battle_energy_at: new Date().toISOString() };
    if (data.all) {
      const { error } = await S.supabaseAdmin
        .from("monsters")
        .update(patch as never)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
    } else {
      if (!data.petId) throw new Error("Pokémon inválido");
      await S.getMyMonster(context.userId, data.petId);
      await S.patchMonster(data.petId, patch);
    }
    await S.patchProfile(context.userId, { gems: paid.gems });
    return { ok: true };
  });

const StatSchema = z.enum(["atk", "def", "spd", "hp", "int", "crit"]);

/** Treina um atributo (ganho aleatório calculado no servidor). */
export const trainPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ petId: z.string().uuid(), stat: StatSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { computeBattleEnergy } = await import("./game-data");
    const TRAIN_ENERGY_COST = 2;
    const TRAIN_GEM_COST = 4;

    const m = await S.getMyMonster(context.userId, data.petId);
    const rank = Math.max(1, Number(m.rank ?? 1));
    const limit = rank * 10;
    const used = Number(m.train_count ?? 0);
    if (used >= limit) throw new Error("Limite de treinos atingido! Eleve o pet ⭐");
    if (data.stat === "crit" && Number(m.crit ?? 0) >= rank) {
      throw new Error(`Limite de CRIT atingido (${rank})! Eleve o pet ⭐`);
    }
    const cost = 20 + rank * 10;
    const profile = await S.getProfile(context.userId);
    const paid = S.charge(profile, { coins: cost, gems: TRAIN_GEM_COST });

    const e = computeBattleEnergy(m.battle_energy as number, m.battle_energy_at as string);
    if (e.energy < TRAIN_ENERGY_COST) throw new Error("Sem energia! Dê um energético ou espere regenerar.");
    if (Number(m.hunger ?? 100) < 20) throw new Error("Está com fome! Alimente primeiro.");

    const updates: Record<string, unknown> = {
      battle_energy: e.energy - TRAIN_ENERGY_COST,
      battle_energy_at: e.nextStoredAt,
      hunger: Number(m.hunger ?? 100) - 5,
      train_count: used + 1,
    };
    let gain = 1;
    if (data.stat === "crit") {
      updates.crit = Number(m.crit ?? 0) + 1;
    } else {
      gain =
        data.stat === "hp"
          ? 20 + Math.floor(Math.random() * 6)
          : data.stat === "spd" || data.stat === "def"
            ? 3 + Math.floor(Math.random() * 3)
            : 1 + Math.floor(Math.random() * 2);
      updates[data.stat] = Number(m[data.stat] ?? 0) + gain;
    }
    await S.patchMonster(data.petId, updates);
    await S.patchProfile(context.userId, { coins: paid.coins, gems: paid.gems });
    return { ok: true, stat: data.stat, gain, used: used + 1, limit };
  });

export const resetPetTraining = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ petId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { SPECIES } = await import("./game-data");
    const RESET_GEM_COST = 50;
    const m = await S.getMyMonster(context.userId, data.petId);
    if (Number(m.train_count ?? 0) === 0 && Number(m.crit ?? 0) === 0) {
      throw new Error("Nenhum ponto distribuído pra resetar.");
    }
    const sp = SPECIES[m.species as string];
    if (!sp) throw new Error("Espécie inválida");
    const profile = await S.getProfile(context.userId);
    const paid = S.charge(profile, { gems: RESET_GEM_COST });
    await S.patchMonster(data.petId, {
      hp: sp.base.hp,
      atk: sp.base.atk,
      def: sp.base.def,
      spd: sp.base.spd,
      int: sp.base.int,
      crit: 0,
      train_count: 0,
    });
    await S.patchProfile(context.userId, { gems: paid.gems });
    return { ok: true };
  });

/** Usa item (ração/energético/brinquedo) no pet. */
export const useItemOnPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ petId: z.string().uuid(), itemId: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { ITEMS, computeBattleEnergy, MAX_BATTLE_ENERGY } = await import("./game-data");
    const item = ITEMS[data.itemId];
    if (!item) throw new Error("Item inválido");
    const m = await S.getMyMonster(context.userId, data.petId);

    const stock = data.itemId === "ration" ? await S.getItemQty(context.userId, "ration") : 0;
    let fromInventory = false;
    if (data.itemId === "ration" && stock > 0) {
      await S.consumeItem(context.userId, "ration", 1);
      fromInventory = true;
    } else {
      const profile = await S.getProfile(context.userId);
      const paid = S.charge(profile, { coins: item.priceCoins ?? 0, gems: item.priceGems ?? 0 });
      await S.patchProfile(context.userId, { coins: paid.coins, gems: paid.gems });
    }

    const updates: Record<string, unknown> = {};
    if (item.effect.hunger) {
      updates.hunger = Math.min(100, Number(m.hunger ?? 0) + item.effect.hunger);
    }
    if (item.effect.energy) {
      const e = computeBattleEnergy(m.battle_energy as number, m.battle_energy_at as string);
      updates.battle_energy = Math.min(MAX_BATTLE_ENERGY, e.energy + item.effect.energy);
      updates.battle_energy_at = e.nextStoredAt;
    }
    if (item.effect.happiness) {
      updates.happiness = Math.min(100, Number(m.happiness ?? 0) + item.effect.happiness);
    }
    await S.patchMonster(data.petId, updates);
    return { ok: true, fromInventory };
  });

export const playWithPet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ petId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { computeBattleEnergy } = await import("./game-data");
    const m = await S.getMyMonster(context.userId, data.petId);
    const e = computeBattleEnergy(m.battle_energy as number, m.battle_energy_at as string);
    if (e.energy < 1) throw new Error("Sem energia!");
    await S.patchMonster(data.petId, {
      happiness: Math.min(100, Number(m.happiness ?? 0) + 20),
      battle_energy: e.energy - 1,
      battle_energy_at: e.nextStoredAt,
    });
    return { ok: true };
  });

export const equipPetSkin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ petId: z.string().uuid(), skinId: z.string().min(1).max(60), buy: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { SKINS } = await import("./game-data");
    const m = await S.getMyMonster(context.userId, data.petId);

    if (data.skinId !== "default") {
      const sk = SKINS[data.skinId];
      if (!sk) throw new Error("Skin inválida");
      const { data: owned } = await S.supabaseAdmin
        .from("skins_owned")
        .select("skin_id, species")
        .eq("user_id", context.userId)
        .eq("skin_id", data.skinId);
      const hasIt = (owned ?? []).some(
        (o) => o.species == null || o.species === m.species,
      );
      if (!hasIt) {
        if (!data.buy) throw new Error("Você não tem essa skin.");
        if (sk.vipOnly) throw new Error("Skin exclusiva VIP.");
        const profile = await S.getProfile(context.userId);
        const paid = S.charge(profile, { gems: sk.priceGems });
        const { error } = await S.supabaseAdmin
          .from("skins_owned")
          .insert({ user_id: context.userId, skin_id: data.skinId, species: m.species as string });
        if (error) throw new Error(error.message);
        await S.patchProfile(context.userId, { gems: paid.gems });
      }
    }

    await S.patchMonster(data.petId, { skin: data.skinId });
    return { ok: true };
  });

/** Funde 2 pokémons iguais e sobe 1 estrela (mantém o shiny). */
export const fusePets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ species: z.string().min(1).max(64), rank: z.number().int().min(1).max(9) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    const { MAX_RANK } = await import("./game-data");
    if (data.rank >= MAX_RANK) throw new Error("Rank máximo atingido");

    const { data: rows } = await S.supabaseAdmin
      .from("monsters")
      .select("id, name, is_shiny, in_team, soulbound")
      .eq("owner_id", context.userId)
      .eq("species", data.species)
      .eq("rank", data.rank)
      .eq("in_team", false);
    const available = (rows ?? []) as Array<{
      id: string; name: string; is_shiny: boolean; in_team: boolean; soulbound: boolean;
    }>;
    if (available.length < 2) throw new Error("Tire os bichinhos do time antes de fundir!");

    const sorted = [...available].sort(
      (a, b) => Number(b.is_shiny === true) - Number(a.is_shiny === true),
    );
    const keep = sorted[0];
    const consume = [...sorted].reverse().find((m) => m.id !== keep.id)!;
    const keepShiny = keep.is_shiny === true || consume.is_shiny === true;
    // Pet vinculado (ex.: shiny do código) continua vinculado após fundir
    const keepSoulbound = keep.soulbound === true || consume.soulbound === true;

    const { error: delErr } = await S.supabaseAdmin.from("monsters").delete().eq("id", consume.id);
    if (delErr) throw new Error(delErr.message);
    await S.patchMonster(keep.id, { rank: data.rank + 1, is_shiny: keepShiny, soulbound: keepSoulbound });
    return { ok: true, name: keep.name, rank: data.rank + 1, shiny: keepShiny };
  });

/** Baú de boas-vindas: 3 pokémons iniciais, uma única vez. */
export const openWelcomeChest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const S = await import("./economy.server");
    const { rollWelcomeChest } = await import("./game-data");
    const profile = await S.getProfile(context.userId);
    if ((profile as { welcome_chest_claimed?: boolean }).welcome_chest_claimed) {
      throw new Error("Você já abriu seu baú de boas-vindas.");
    }
    const speciesIds = rollWelcomeChest();
    await S.grantMonsters(
      context.userId,
      speciesIds.map((species, idx) => ({
        species,
        in_team: idx < 3,
        team_position: idx < 3 ? idx : 0,
      })),
    );
    await S.patchProfile(context.userId, { welcome_chest_claimed: true });
    return { speciesIds };
  });

/** Reorganiza o time (in_team / team_position). Cosmético, mas validado. */
export const setTeamLayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        updates: z
          .array(
            z.object({
              id: z.string().uuid(),
              in_team: z.boolean(),
              team_position: z.number().int().min(0).max(2),
            }),
          )
          .max(12),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const S = await import("./economy.server");
    for (const u of data.updates) {
      const { error } = await S.supabaseAdmin
        .from("monsters")
        .update({ in_team: u.in_team, team_position: u.team_position } as never)
        .eq("id", u.id)
        .eq("owner_id", context.userId);
      if (error) throw new Error(error.message);
    }
    const { data: team } = await S.supabaseAdmin
      .from("monsters")
      .select("id")
      .eq("owner_id", context.userId)
      .eq("in_team", true);
    if ((team?.length ?? 0) > 3) throw new Error("Time cheio (3).");
    return { ok: true };
  });
