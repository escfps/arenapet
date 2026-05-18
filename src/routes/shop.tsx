import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  EGGS, SKINS, GEM_PACKS, SPECIES, ELEMENT_COLORS,
  VIP_PRICE_GEMS, VIP_DURATION_DAYS,
  rollEgg, skinFilter, isVip,
  MAX_BATTLE_ENERGY, ENERGY_REFILL_GEM_COST, ENERGY_REFILL_ALL_GEM_COST, computeBattleEnergy,
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
  const [tab, setTab] = useState<"eggs" | "skins" | "vip" | "gems" | "energy">("eggs");
  const [ownedSkins, setOwnedSkins] = useState<string[]>(["default"]);
  const [hatchResult, setHatchResult] = useState<string | null>(null);
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

    const species = rollEgg(eggId);
    const sp = SPECIES[species];
    const bonus = eggId === "rare" ? 5 : 0;
    await supabase.from("monsters").insert({
      owner_id: userId,
      species,
      name: sp.name,
      hp: sp.base.hp + bonus,
      atk: sp.base.atk + Math.floor(bonus / 2),
      def: sp.base.def + Math.floor(bonus / 2),
      spd: sp.base.spd + Math.floor(bonus / 2),
    });
    setHatchResult(species);
    toast.success(`Você chocou um ${sp.name}! 🎉`);
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
          {(["eggs", "skins", "vip", "gems"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-bold transition ${tab === t ? "bg-white/30 text-white" : "text-white/70 hover:bg-white/15"}`}
            >
              {t === "eggs" ? "🥚 Ovos" : t === "skins" ? "🎨 Skins" : t === "vip" ? "👑 VIP" : "💎 Gemas"}
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
                    onClick={() => hatch(egg.id)}
                    className="w-full py-2 rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 text-yellow-950 font-extrabold hover:scale-105 transition"
                  >
                    Chocar por {egg.priceCoins ? `🪙 ${egg.priceCoins}` : `💎 ${egg.priceGems}`}
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
              <li>⚔️ 4 monstros no time (vs 3 normal)</li>
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
      </div>
    </main>
  );
}
