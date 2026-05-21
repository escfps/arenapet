import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EGGS, SKINS, GEM_PACKS, SPECIES, ELEMENT_COLORS,
  BATTLE_PASS_PRICE_BRL,
  rollEgg, skinFilter, isVip,
  MAX_BATTLE_ENERGY, ENERGY_REFILL_GEM_COST, ENERGY_REFILL_ALL_GEM_COST, computeBattleEnergy,
  CHESTS, rollChest, RARITY_INFO, starterMonsterStats,
  CHEST_PITY, PITY_COLUMN,
  type ChestTier, type ChestReward, type Rarity,
} from "@/lib/game-data";
import { useServerFn } from "@tanstack/react-start";
import { claimBattlePassDaily } from "@/lib/battle-pass.functions";
import type { MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import arenaBg from "@/assets/arena-bg.jpg";

const PADDLE_PRICE_IDS: Record<string, string> = {
  starter: "gems_starter_price",
  pro: "gems_pro_price",
  epic: "gems_epic_price",
  legend: "gems_legend_price",
};




export const Route = createFileRoute("/shop")({
  component: ShopPage,
});

function ShopPage() {
  const navigate = useNavigate();
  const { userId, profile, patch, reload, loading } = useProfile();
  const [tab, setTab] = useState<"chests" | "skins" | "vip" | "gems" | "energy">("chests");
  const claimBP = useServerFn(claimBattlePassDaily);
  const [ownedSkins, setOwnedSkins] = useState<string[]>(["default"]);
  const [hatchResult, setHatchResult] = useState<string | null>(null);
  const [chestResult, setChestResult] = useState<{ tier: ChestTier; reward: ChestReward } | null>(null);
  const [pets, setPets] = useState<MonsterRow[]>([]);

  const loadSkins = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("skins_owned").select("skin_id").eq("user_id", userId);
    if (data) setOwnedSkins(["default", ...data.map((s) => s.skin_id)]);
  }, [userId]);
  const loadPets = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("monsters").select("*").eq("owner_id", userId);
    if (data) setPets(data as MonsterRow[]);
  }, [userId]);
  useEffect(() => { if (userId) { loadSkins(); loadPets(); } }, [userId, loadSkins, loadPets]);

  if (loading || !profile) return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;

  async function hatch(eggId: string) {
    if (!profile || !userId) return;
    const egg = EGGS[eggId];
    if (egg.priceCoins && profile.coins < egg.priceCoins) { toast.error("Moedas insuficientes!"); return; }
    if (egg.priceGems && profile.gems < egg.priceGems) { toast.error("Gemas insuficientes!"); return; }

    await patch({
      coins: profile.coins - (egg.priceCoins ?? 0),
      gems: profile.gems - (egg.priceGems ?? 0),
    });

    const pack = egg.pack ?? 1;
    const isRare = eggId === "rare" || eggId === "rare_10";
    const bonus = isRare ? 5 : 0;
    const rolled: string[] = [];
    const rows = [];
    for (let i = 0; i < pack; i++) {
      const species = rollEgg(eggId);
      const sp = SPECIES[species];
      rolled.push(species);
      rows.push({
        owner_id: userId,
        species,
        name: sp.name,
        hp: starterMonsterStats(species).hp + bonus,
        atk: starterMonsterStats(species).atk + Math.floor(bonus / 2),
        def: starterMonsterStats(species).def + Math.floor(bonus / 2),
        spd: starterMonsterStats(species).spd + Math.floor(bonus / 2),
      });
    }
    await supabase.from("monsters").insert(rows);
    setHatchResult(rolled[rolled.length - 1]);
    if (pack > 1) {
      const rareCount = rolled.filter((s) => SPECIES[s].rarity === "rare").length;
      toast.success(`Chocou ${pack} pets! 🎉 ${rareCount > 0 ? `(${rareCount} raro${rareCount > 1 ? "s" : ""}!)` : ""}`);
    } else {
      toast.success(`Você chocou um ${SPECIES[rolled[0]].name}! 🎉`);
    }
  }

  async function openChest(tier: ChestTier, payWith: "coins" | "gems" = "gems") {
    if (!profile || !userId) return;
    const c = CHESTS[tier];
    const useCoins = payWith === "coins" && c.priceCoins != null;
    const useGems = !useCoins && c.priceGems != null;
    if (useCoins && profile.coins < (c.priceCoins ?? 0)) { toast.error("Moedas insuficientes!"); return; }
    if (useGems && profile.gems < (c.priceGems ?? 0)) { toast.error("Gemas insuficientes!"); return; }

    // Pity: força o drop garantido quando o contador bate o limite
    const pity = CHEST_PITY[tier];
    const pityCol = PITY_COLUMN[tier];
    const currentPity = pityCol ? ((profile as Record<string, unknown>)[pityCol] as number ?? 0) : 0;
    const forceRarity = pity && currentPity + 1 >= pity.limit
      ? pity.rarities[Math.floor(Math.random() * pity.rarities.length)]
      : undefined;

    const reward = rollChest(tier, forceRarity);

    const patchObj: Record<string, number> = {
      coins: profile.coins - (useCoins ? (c.priceCoins ?? 0) : 0) + reward.coins,
      gems: profile.gems - (useGems ? (c.priceGems ?? 0) : 0) + reward.gems,
    };

    // Atualiza contador de pity: zera se pegou alguma das raridades garantidas, senão +1
    if (pity && pityCol) {
      const gotRarity = reward.petSpecies ? SPECIES[reward.petSpecies].rarity : null;
      patchObj[pityCol] = gotRarity && pity.rarities.includes(gotRarity) ? 0 : currentPity + 1;
    }

    await patch(patchObj);


    // rações no inventário (upsert somando)
    if (reward.rations > 0) {
      const { data: row } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("user_id", userId)
        .eq("item_type", "ration")
        .maybeSingle();
      await supabase
        .from("inventory")
        .upsert(
          { user_id: userId, item_type: "ration", quantity: (row?.quantity ?? 0) + reward.rations },
          { onConflict: "user_id,item_type" }
        );
    }

    // pet (se sorteado)
    if (reward.petSpecies) {
      const sp = SPECIES[reward.petSpecies];
      await supabase.from("monsters").insert({
        owner_id: userId,
        species: reward.petSpecies,
        name: sp.name,
        ...starterMonsterStats(reward.petSpecies),
      });
    }

    setChestResult({ tier, reward });
  }

  async function buySkin(skinId: string) {
    if (!profile || !userId) return;
    const sk = SKINS[skinId];
    if (ownedSkins.includes(skinId)) { toast("Você já tem essa skin"); return; }
    if (sk.vipOnly && !isVip(profile.vip_until)) { toast.error("Skin exclusiva pra VIPs!"); return; }
    if (profile.gems < sk.priceGems) { toast.error("Gemas insuficientes!"); return; }
    await patch({ gems: profile.gems - sk.priceGems });
    await supabase.from("skins_owned").insert({ user_id: userId, skin_id: skinId });
    setOwnedSkins([...ownedSkins, skinId]);
    toast.success(`Skin ${sk.name} desbloqueada!`);
  }

  async function subscribeBattlePass() {
    if (!profile || !userId) return;
    try {
      toast.loading("Abrindo pagamento...", { id: "pay" });
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId("battle_pass_monthly");
      toast.dismiss("pay");
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customData: { userId },
        settings: {
          displayMode: "overlay",
          successUrl: `${window.location.origin}/shop?bp=1`,
          allowLogout: false,
          variant: "one-page",
          locale: "pt-BR",
        },
      });
    } catch (e: any) {
      toast.dismiss("pay");
      toast.error(`Erro ao abrir pagamento: ${e?.message ?? e}`);
    }
  }

  async function claimDailyBP() {
    try {
      const res = await claimBP();
      const chestMsg = res.chests.length ? ` + ${res.chests.map((c) => c.name).join(" + ")}` : "";
      toast.success(`Dia ${res.day}! +${res.gems} 💎 +${res.rations} 🍖${chestMsg}`);
      await reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao reivindicar");
    }
  }

  async function buyGems(pack: typeof GEM_PACKS[number]) {
    if (!profile || !userId) return;
    const priceId = PADDLE_PRICE_IDS[pack.id];
    if (!priceId) { toast.error("Pacote indisponível"); return; }
    try {
      toast.loading("Abrindo pagamento...", { id: "pay" });
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(priceId);
      toast.dismiss("pay");
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customData: { userId },
        settings: {
          displayMode: "overlay",
          successUrl: `${window.location.origin}/shop?paid=1`,
          allowLogout: false,
          variant: "one-page",
          locale: "pt-BR",
        },
      });
    } catch (e: any) {
      toast.dismiss("pay");
      toast.error(`Erro ao abrir pagamento: ${e?.message ?? e}`);
    }
  }

  async function refillEnergy(petId: string) {
    if (!profile) return;
    if (profile.gems < ENERGY_REFILL_GEM_COST) { toast.error("Gemas insuficientes!"); return; }
    await patch({ gems: profile.gems - ENERGY_REFILL_GEM_COST });
    await supabase.from("monsters").update({ battle_energy: MAX_BATTLE_ENERGY, battle_energy_at: new Date().toISOString() }).eq("id", petId);
    await loadPets();
    toast.success("⚡ Energia recarregada!");
  }

  async function refillAll() {
    if (!profile || !userId) return;
    if (profile.gems < ENERGY_REFILL_ALL_GEM_COST) { toast.error("Gemas insuficientes!"); return; }
    await patch({ gems: profile.gems - ENERGY_REFILL_ALL_GEM_COST });
    await supabase.from("monsters").update({ battle_energy: MAX_BATTLE_ENERGY, battle_energy_at: new Date().toISOString() }).eq("owner_id", userId);
    await loadPets();
    toast.success("⚡ Todo o time recarregado!");
  }

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(20,5,50,0.6),rgba(20,5,50,0.8)),url(${arenaBg})` }}
    >
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />

      <div className="max-w-4xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Home</button>

        <header className="text-center text-white">
          <h1 className="text-4xl font-extrabold drop-shadow-lg">🛒 Loja</h1>
        </header>

        <div className="flex bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/20">
          {(["chests", "skins", "vip", "gems", "energy"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-[11px] font-bold transition ${tab === t ? "bg-white/30 text-white" : "text-white/70 hover:bg-white/15"}`}
            >
              {t === "chests" ? "📦 Baús" : t === "skins" ? "🎨 Skins" : t === "vip" ? "🎟️ Passe" : t === "gems" ? "💎 Gemas" : "⚡ Energia"}
            </button>
          ))}
        </div>


        {tab === "chests" && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              {Object.values(CHESTS).map((c) => {
                const rarityEntries = Object.entries(c.petRarityWeights) as [Rarity, number][];
                const totalW = rarityEntries.reduce((a, [, w]) => a + w, 0);
                const pity = CHEST_PITY[c.id];
                const pityCol = PITY_COLUMN[c.id];
                const currentPity = pityCol ? ((profile as Record<string, unknown>)[pityCol] as number ?? 0) : 0;
                const pityLeft = pity ? Math.max(0, pity.limit - currentPity) : 0;
                return (
                  <div key={c.id} className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
                    <div className="text-center">
                      <div className="text-6xl mb-1">{c.emoji}</div>
                      <h3 className="font-extrabold text-lg">{c.name}</h3>
                      <p className="text-xs opacity-80 mb-3">{c.description}</p>
                    </div>

                    {pity && (() => {
                      const label = pity.rarities.map((r) => `${RARITY_INFO[r].emoji} ${RARITY_INFO[r].name}`).join(" ou ");
                      return (
                        <div className={`text-center text-xs font-extrabold mb-2 px-2 py-1.5 rounded-lg ${pityLeft <= 3 ? "bg-orange-500/30 text-orange-200 animate-pulse" : "bg-black/30 text-amber-200"}`}>
                          {pityLeft === 1
                            ? `🔥 Próximo baú garante ${label}!`
                            : `${pityLeft <= 3 ? "🔥" : "🎯"} Faltam ${pityLeft} pra garantir ${label}`}
                        </div>
                      );
                    })()}


                    <div className="bg-black/30 rounded-xl p-3 text-[11px] space-y-1 mb-3">
                      <div className="font-bold text-yellow-300 mb-1">📊 Drops garantidos:</div>
                      <div>🪙 {c.coins[0]}–{c.coins[1]} moedas</div>
                      <div>🍖 {c.rations[0]}–{c.rations[1]} rações</div>
                      <div>💎 {c.gems[0]}–{c.gems[1]} gemas{c.gemChance < 1 ? ` (${Math.round(c.gemChance * 100)}% chance)` : ""}</div>
                      <div className="font-bold text-fuchsia-300 mt-2">🐾 Pet: {Math.round(c.petChance * 100)}% de cair</div>
                      {c.petChance > 0 && (
                        <div className="pl-2 space-y-0.5">
                          {rarityEntries.map(([r, w]) => (
                            <div key={r} className="flex justify-between">
                              <span>{RARITY_INFO[r].emoji} {RARITY_INFO[r].name}</span>
                              <span className="opacity-80">{((w / totalW) * c.petChance * 100).toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {c.priceCoins != null && (
                        <button
                          onClick={() => openChest(c.id, "coins")}
                          className="w-full py-2 rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 text-yellow-950 font-extrabold hover:scale-105 transition"
                        >
                          Abrir por 🪙 {c.priceCoins.toLocaleString("pt-BR")}
                        </button>
                      )}
                      {c.priceGems != null && (
                        <button
                          onClick={() => openChest(c.id, "gems")}
                          className="w-full py-2 rounded-xl bg-gradient-to-b from-fuchsia-400 to-violet-500 text-white font-extrabold hover:scale-105 transition"
                        >
                          Abrir por 💎 {c.priceGems.toLocaleString("pt-BR")}
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

            {chestResult && (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
                onClick={() => setChestResult(null)}
              >
                <div
                  className="relative w-full max-w-sm rounded-3xl p-6 text-center text-white bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-700 shadow-2xl border-4 border-yellow-300/60 animate-in zoom-in-50 duration-500"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,200,0.5),transparent_60%)] animate-pulse" />
                  </div>
                  <div className="relative">
                    <div className="text-xs opacity-90 tracking-widest">VOCÊ ABRIU</div>
                    <div className="text-lg font-extrabold">{CHESTS[chestResult.tier].name.toUpperCase()}</div>
                    <div className="text-7xl my-3 drop-shadow-lg animate-bounce">{CHESTS[chestResult.tier].emoji}</div>
                    {chestResult.reward.petSpecies && (
                      <div className="mb-3 pb-3 border-b border-white/30">
                        <div className="text-xs opacity-90">🎉 BICHINHO RARO!</div>
                        <img src={SPECIES[chestResult.reward.petSpecies].image} alt="" className="h-36 mx-auto drop-shadow-2xl animate-in zoom-in duration-700" />
                        <div className="text-xl font-extrabold">
                          {SPECIES[chestResult.reward.petSpecies].emoji} {SPECIES[chestResult.reward.petSpecies].name}
                        </div>
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded-full ${RARITY_INFO[SPECIES[chestResult.reward.petSpecies].rarity].color} text-[10px] font-extrabold`}>
                          {RARITY_INFO[SPECIES[chestResult.reward.petSpecies].rarity].emoji} {RARITY_INFO[SPECIES[chestResult.reward.petSpecies].rarity].name}
                        </span>
                      </div>
                    )}
                    <div className="space-y-1 text-base font-bold">
                      {chestResult.reward.coins > 0 && <div>+🪙 {chestResult.reward.coins} moedas</div>}
                      {chestResult.reward.gems > 0 && <div>+💎 {chestResult.reward.gems} gemas</div>}
                      {chestResult.reward.rations > 0 && <div>+🍖 {chestResult.reward.rations} rações</div>}
                      {!chestResult.reward.petSpecies && (
                        <div className="mt-2 text-xs opacity-80">(sem pet desta vez — boa sorte na próxima!)</div>
                      )}
                    </div>
                    <button onClick={() => setChestResult(null)} className="mt-5 w-full px-4 py-2.5 rounded-xl bg-white/25 hover:bg-white/35 text-sm font-extrabold tracking-wide">
                      CONTINUAR
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "skins" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.values(SKINS).filter((s) => s.id !== "default").map((sk) => {
              const owned = ownedSkins.includes(sk.id);
              const previewSp = SPECIES.flarepup;
              return (
                <div key={sk.id} className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-3 text-white text-center">
                  <div className="aspect-square bg-black/30 rounded-xl flex items-center justify-center mb-2">
                    <img src={previewSp.image} alt="" className="h-3/4" style={{ filter: skinFilter(sk.id) }} />
                  </div>
                  <div className="font-extrabold text-sm">{sk.name}{sk.vipOnly && " 👑"}</div>
                  <div className="text-[10px] opacity-80 mb-2 h-8">{sk.description}</div>
                  <button
                    onClick={() => buySkin(sk.id)}
                    disabled={owned}
                    className="w-full py-1.5 rounded-lg text-xs font-bold bg-fuchsia-500 hover:bg-fuchsia-400 disabled:bg-white/20"
                  >
                    {owned ? "✓ Possui" : sk.vipOnly ? "👑 Exclusiva VIP" : `💎 ${sk.priceGems}`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {tab === "vip" && (() => {
          const bpActive = isVip(profile.vip_until);
          const today = new Date().toISOString().slice(0, 10);
          const claimedToday = (profile as any).bp_last_claim_date === today;
          const days = (profile as any).bp_days_claimed ?? 0;
          const nextSilverIn = 7 - (days % 7 || 7);
          const daysUntilMonthly = Math.max(0, 30 - days);
          return (
            <div className="space-y-3">
              <PaymentTestModeBanner />
              <div className="rounded-3xl bg-gradient-to-br from-yellow-400 via-amber-300 to-yellow-500 border-4 border-yellow-700 p-6 shadow-2xl text-yellow-950">
                <div className="text-center">
                  <div className="text-6xl mb-2">🎟️</div>
                  <h2 className="text-3xl font-black">PASSE DE BATALHA</h2>
                  <p className="font-bold opacity-90">R$ {BATTLE_PASS_PRICE_BRL.toFixed(2).replace(".", ",")} / mês</p>
                </div>
                <ul className="mt-4 space-y-1.5 text-sm font-bold">
                  <li>📅 Login diário: +5 💎 e +1 🍖</li>
                  <li>📦 A cada 7 dias: 1 Baú de Prata</li>
                  <li>🏆 Ao completar 30 dias: 1 Baú de Ouro + 1 Lendário</li>
                  <li>✨ +50% de recompensas em batalha (🪙 e XP)</li>
                  <li>🎨 Skin exclusiva Arco-íris</li>
                </ul>
                <div className="mt-3 text-xs bg-yellow-100/60 rounded-lg p-2">
                  <b>Total do mês fazendo login todo dia:</b> 150 💎 · 30 🍖 · 4 Baús Prata · 1 Ouro · 1 Lendário
                </div>
                {bpActive ? (
                  <div className="mt-4 space-y-2">
                    <div className="bg-yellow-950/10 rounded-lg p-3 text-sm">
                      <div>✅ Ativo até <b>{new Date(profile.vip_until!).toLocaleDateString("pt-BR")}</b></div>
                      <div>📅 Dia {days}/30 do ciclo · Próximo Baú de Prata em {nextSilverIn} dia(s) · Marco mensal em {daysUntilMonthly} dia(s)</div>
                    </div>
                    <button
                      onClick={claimDailyBP}
                      disabled={claimedToday}
                      className="w-full py-3 rounded-xl bg-emerald-600 text-white font-extrabold text-lg hover:bg-emerald-700 transition shadow-lg disabled:bg-stone-400 disabled:cursor-not-allowed"
                    >
                      {claimedToday ? "✓ Já reivindicado hoje — volte amanhã!" : "🎁 Reivindicar recompensa diária"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={subscribeBattlePass}
                    className="mt-5 w-full py-3 rounded-xl bg-yellow-950 text-yellow-300 font-extrabold text-lg hover:bg-yellow-900 transition shadow-lg"
                  >
                    💳 Assinar por R$ {BATTLE_PASS_PRICE_BRL.toFixed(2).replace(".", ",")} / mês
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {tab === "gems" && (
          <div className="space-y-3">
            <PaymentTestModeBanner />
            <p className="text-white/80 text-xs text-center">💳 Pague no cartão — gemas creditadas automaticamente em segundos.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {GEM_PACKS.map((p) => (
                <div key={p.id} className="rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-700 border-2 border-purple-300 p-4 text-white">
                  <div className="text-3xl">💎</div>
                  <div className="text-xl font-extrabold">{p.gems.toLocaleString("pt-BR")} gemas</div>
                  {p.bonus > 0 && <div className="text-xs text-yellow-300 font-bold">+ {p.bonus} bônus 🎁</div>}
                  <button
                    onClick={() => buyGems(p)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-emerald-500 text-white font-extrabold hover:bg-emerald-600 transition"
                  >
                    💳 R$ {p.priceBRL.toFixed(2).replace(".", ",")}
                  </button>
                </div>

              ))}
            </div>
          </div>
        )}

        {tab === "energy" && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-extrabold text-lg">⚡ Energia de batalha</h3>
                  <p className="text-xs opacity-80">Cada pet gasta 1 ⚡ por batalha. Regen automática: <b>+1/h</b> (máx {MAX_BATTLE_ENERGY}).</p>
                </div>
                <button
                  onClick={refillAll}
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 font-extrabold hover:scale-105 transition"
                >
                  Recarregar TIME 💎 {ENERGY_REFILL_ALL_GEM_COST}
                </button>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {pets.map((m) => {
                const sp = SPECIES[m.species];
                if (!sp) return null;
                const en = computeBattleEnergy(m.battle_energy, m.battle_energy_at);
                const full = en.energy >= MAX_BATTLE_ENERGY;
                return (
                  <div key={m.id} className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${ELEMENT_COLORS[sp.element]} text-white`}>
                    <img src={sp.image} alt="" className="h-12 w-12 object-contain drop-shadow" style={{ filter: skinFilter(m.skin) }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{m.name} {m.in_team && <span className="text-[9px] bg-yellow-400 text-yellow-950 px-1 rounded">TIME</span>}</div>
                      <div className="text-[11px] font-bold">⚡ {en.energy}/{MAX_BATTLE_ENERGY}</div>
                    </div>
                    <button
                      onClick={() => refillEnergy(m.id)}
                      disabled={full}
                      className="px-2 py-1 rounded bg-black/40 hover:bg-black/60 text-xs font-extrabold disabled:opacity-40"
                    >
                      {full ? "Cheio" : `💎 ${ENERGY_REFILL_GEM_COST}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
