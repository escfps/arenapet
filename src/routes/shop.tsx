import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EGGS, SKINS, GEM_PACKS, SPECIES, ELEMENT_COLORS,
  VIP_PRICE_GEMS, VIP_DURATION_DAYS,
  rollEgg, skinFilter, isVip,
  MAX_BATTLE_ENERGY, ENERGY_REFILL_GEM_COST, ENERGY_REFILL_ALL_GEM_COST, computeBattleEnergy,
  CHESTS, rollChest, RARITY_INFO,
  type ChestTier, type ChestReward, type Rarity,
} from "@/lib/game-data";
import type { MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/shop")({
  component: ShopPage,
});

function ShopPage() {
  const navigate = useNavigate();
  const { userId, profile, patch, loading } = useProfile();
  const [tab, setTab] = useState<"chests" | "skins" | "vip" | "gems" | "energy">("chests");
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
        hp: sp.base.hp + bonus,
        atk: sp.base.atk + Math.floor(bonus / 2),
        def: sp.base.def + Math.floor(bonus / 2),
        spd: sp.base.spd + Math.floor(bonus / 2),
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

  async function openChest(tier: ChestTier) {
    if (!profile || !userId) return;
    const c = CHESTS[tier];
    if (c.priceCoins && profile.coins < c.priceCoins) { toast.error("Moedas insuficientes!"); return; }
    if (c.priceGems && profile.gems < c.priceGems) { toast.error("Gemas insuficientes!"); return; }

    const reward = rollChest(tier);

    // debita preço + credita moedas/gemas
    await patch({
      coins: profile.coins - (c.priceCoins ?? 0) + reward.coins,
      gems: profile.gems - (c.priceGems ?? 0) + reward.gems,
    });

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
        hp: sp.base.hp,
        atk: sp.base.atk,
        def: sp.base.def,
        spd: sp.base.spd,
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

  async function buyVip() {
    if (!profile) return;
    if (profile.gems < VIP_PRICE_GEMS) { toast.error("Gemas insuficientes!"); return; }
    const base = isVip(profile.vip_until) ? new Date(profile.vip_until!) : new Date();
    const newUntil = new Date(base.getTime() + VIP_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await patch({ gems: profile.gems - VIP_PRICE_GEMS, vip_until: newUntil.toISOString() });
    toast.success("👑 VIP ativado!");
  }

  async function buyGems(pack: typeof GEM_PACKS[number]) {
    // Placeholder — Stripe integration coming
    toast.info(`Em breve! Pagamento real (R$ ${pack.priceBRL.toFixed(2)}) vai ser via Stripe.`);
    // For now, give the gems for free as a demo (REMOVE later)
    if (!profile) return;
    await patch({ gems: profile.gems + pack.gems + pack.bonus });
    toast.success(`+${pack.gems + pack.bonus} 💎 (modo demo)`);
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
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Pátio</button>

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
              {t === "chests" ? "📦 Baús" : t === "skins" ? "🎨 Skins" : t === "vip" ? "👑 VIP" : t === "gems" ? "💎 Gemas" : "⚡ Energia"}
            </button>
          ))}
        </div>

        {tab === "eggs" && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              {Object.values(EGGS).map((egg) => (
                <div key={egg.id} className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white text-center">
                  <div className="text-6xl mb-2">{egg.emoji}</div>
                  <h3 className="font-extrabold text-lg">{egg.name}</h3>
                  <p className="text-xs opacity-80 mb-3">{egg.description}</p>
                  <button
                    onClick={() => egg.event ? null : hatch(egg.id)}
                    disabled={egg.event}
                    className="w-full py-2 rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 text-yellow-950 font-extrabold hover:scale-105 transition disabled:from-white/20 disabled:to-white/10 disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {egg.event ? "🔒 Em breve — Evento" : `Chocar por ${egg.priceCoins ? `🪙 ${egg.priceCoins}` : `💎 ${egg.priceGems}`}`}
                  </button>
                </div>
              ))}
            </div>
            {hatchResult && (
              <div className={`rounded-2xl p-6 text-center text-white bg-gradient-to-br ${ELEMENT_COLORS[SPECIES[hatchResult].element]} animate-in fade-in zoom-in`}>
                <div className="text-sm opacity-90">VOCÊ CHOCOU</div>
                <img src={SPECIES[hatchResult].image} alt="" className="h-40 mx-auto drop-shadow-2xl" />
                <div className="text-2xl font-extrabold">{SPECIES[hatchResult].emoji} {SPECIES[hatchResult].name}</div>
                <button onClick={() => setHatchResult(null)} className="mt-3 px-4 py-1.5 rounded-lg bg-white/30 hover:bg-white/40 text-sm font-bold">Fechar</button>
              </div>
            )}
          </>
        )}

        {tab === "chests" && (
          <>
            <div className="grid sm:grid-cols-2 gap-4">
              {Object.values(CHESTS).map((c) => {
                const rarityEntries = Object.entries(c.petRarityWeights) as [Rarity, number][];
                const totalW = rarityEntries.reduce((a, [, w]) => a + w, 0);
                return (
                  <div key={c.id} className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
                    <div className="text-center">
                      <div className="text-6xl mb-1">{c.emoji}</div>
                      <h3 className="font-extrabold text-lg">{c.name}</h3>
                      <p className="text-xs opacity-80 mb-3">{c.description}</p>
                    </div>

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

                    <button
                      onClick={() => openChest(c.id)}
                      className="w-full py-2 rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 text-yellow-950 font-extrabold hover:scale-105 transition"
                    >
                      Abrir por {c.priceCoins ? `🪙 ${c.priceCoins}` : `💎 ${c.priceGems}`}
                    </button>
                  </div>
                );
              })}
            </div>

            {chestResult && (
              <div className="rounded-2xl p-6 text-center text-white bg-gradient-to-br from-amber-500 to-yellow-700 animate-in fade-in zoom-in">
                <div className="text-sm opacity-90">VOCÊ ABRIU {CHESTS[chestResult.tier].name.toUpperCase()}</div>
                <div className="text-6xl my-2">{CHESTS[chestResult.tier].emoji}</div>
                <div className="space-y-1 text-sm font-bold">
                  {chestResult.reward.coins > 0 && <div>+🪙 {chestResult.reward.coins} moedas</div>}
                  {chestResult.reward.gems > 0 && <div>+💎 {chestResult.reward.gems} gemas</div>}
                  {chestResult.reward.rations > 0 && <div>+🍖 {chestResult.reward.rations} rações</div>}
                  {chestResult.reward.petSpecies && (
                    <div className="mt-3 pt-3 border-t border-white/30">
                      <div className="text-xs opacity-90">🎉 BICHINHO RARO!</div>
                      <img src={SPECIES[chestResult.reward.petSpecies].image} alt="" className="h-32 mx-auto drop-shadow-2xl" />
                      <div className="text-xl font-extrabold">
                        {SPECIES[chestResult.reward.petSpecies].emoji} {SPECIES[chestResult.reward.petSpecies].name}
                      </div>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full ${RARITY_INFO[SPECIES[chestResult.reward.petSpecies].rarity].color} text-[10px] font-extrabold`}>
                        {RARITY_INFO[SPECIES[chestResult.reward.petSpecies].rarity].emoji} {RARITY_INFO[SPECIES[chestResult.reward.petSpecies].rarity].name}
                      </span>
                    </div>
                  )}
                  {!chestResult.reward.petSpecies && (
                    <div className="mt-2 text-xs opacity-80">(sem pet desta vez — boa sorte na próxima!)</div>
                  )}
                </div>
                <button onClick={() => setChestResult(null)} className="mt-3 px-4 py-1.5 rounded-lg bg-white/30 hover:bg-white/40 text-sm font-bold">Fechar</button>
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

        {tab === "vip" && (
          <div className="rounded-3xl bg-gradient-to-br from-yellow-400 via-amber-300 to-yellow-500 border-4 border-yellow-700 p-6 shadow-2xl text-yellow-950">
            <div className="text-center">
              <div className="text-6xl mb-2">👑</div>
              <h2 className="text-3xl font-black">PASSE VIP</h2>
              <p className="font-bold opacity-90">{VIP_DURATION_DAYS} dias de regalias</p>
            </div>
            <ul className="mt-4 space-y-2 text-sm font-bold">
              <li>✨ +50% de recompensas em batalha (🪙 e XP)</li>
              
              <li>🎨 Skin exclusiva Arco-íris</li>
              <li>👑 Badge dourado no nome</li>
              <li>🥚 Desconto em ovos raros (em breve)</li>
            </ul>
            <button
              onClick={buyVip}
              className="mt-5 w-full py-3 rounded-xl bg-yellow-950 text-yellow-300 font-extrabold text-lg hover:bg-yellow-900 transition shadow-lg"
            >
              {isVip(profile.vip_until)
                ? `Renovar por 💎 ${VIP_PRICE_GEMS} (atual: ${new Date(profile.vip_until!).toLocaleDateString("pt-BR")})`
                : `Ativar por 💎 ${VIP_PRICE_GEMS}`}
            </button>
          </div>
        )}

        {tab === "gems" && (
          <div className="space-y-3">
            <p className="text-white/80 text-xs text-center">⚠️ Modo demo — Stripe será integrado em breve. Por agora as gemas chegam grátis.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {GEM_PACKS.map((p) => (
                <div key={p.id} className="rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-700 border-2 border-purple-300 p-4 text-white">
                  <div className="text-3xl">💎</div>
                  <div className="text-xl font-extrabold">{p.gems.toLocaleString("pt-BR")} gemas</div>
                  {p.bonus > 0 && <div className="text-xs text-yellow-300 font-bold">+ {p.bonus} bônus 🎁</div>}
                  <button
                    onClick={() => buyGems(p)}
                    className="mt-3 w-full py-2 rounded-lg bg-white text-purple-800 font-extrabold hover:bg-yellow-200 transition"
                  >
                    R$ {p.priceBRL.toFixed(2).replace(".", ",")}
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
