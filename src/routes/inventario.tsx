import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import {
  CHESTS, SPECIES, RARITY_INFO,
  type ChestTier, type ChestReward,
} from "@/lib/game-data";
import { CHEST_ITEM_TYPE, openStoredChest } from "@/lib/chest-inventory";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/inventario")({
  component: InventoryPage,
});

type InventoryRow = { item_type: string; quantity: number };

function InventoryPage() {
  const navigate = useNavigate();
  const { userId, profile, patch, loading } = useProfile();
  const [items, setItems] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [chestResult, setChestResult] = useState<{ tier: ChestTier; reward: ChestReward } | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("inventory")
      .select("item_type, quantity")
      .eq("user_id", userId);
    const map: Record<string, number> = {};
    (data as InventoryRow[] | null)?.forEach((r) => { map[r.item_type] = r.quantity; });
    setItems(map);
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  const rations = items["ration"] ?? 0;
  const chestTiers: ChestTier[] = ["wood", "silver", "gold", "legendary"];

  async function openOne(tier: ChestTier) {
    if (!userId || !profile) return;
    if ((items[CHEST_ITEM_TYPE[tier]] ?? 0) <= 0) return;
    setBusy(tier);
    try {
      const res = await openStoredChest({
        userId,
        tier,
        profile: profile as unknown as Record<string, unknown> & { coins: number; gems: number },
        patch,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        setChestResult(res);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(20,5,50,0.6),rgba(20,5,50,0.8)),url(${arenaBg})` }}
    >
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />

      <div className="max-w-3xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Home</button>

        <header className="text-center text-white">
          <h1 className="text-4xl font-extrabold drop-shadow-lg">🎒 Inventário</h1>
          <p className="text-sm opacity-80">Guarde e abra seus baús quando quiser</p>
        </header>

        {/* Consumíveis */}
        <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
          <h2 className="font-extrabold text-lg mb-3">🍖 Consumíveis</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-black/30 rounded-xl p-3 text-center">
              <div className="text-4xl">🍖</div>
              <div className="font-bold text-sm mt-1">Rações</div>
              <div className="text-2xl font-extrabold text-amber-300">{rations}</div>
              <div className="text-[10px] opacity-70 mt-1">Use para alimentar pets</div>
            </div>
          </div>
        </section>

        {/* Baús guardados */}
        <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
          <h2 className="font-extrabold text-lg mb-1">📦 Baús guardados</h2>
          <p className="text-xs opacity-80 mb-3">
            Comprou e não quis abrir na hora? Eles ficam aqui — abra quando quiser.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {chestTiers.map((tier) => {
              const c = CHESTS[tier];
              const qty = items[CHEST_ITEM_TYPE[tier]] ?? 0;
              const isBusy = busy === tier;
              return (
                <div
                  key={tier}
                  className={`rounded-xl p-3 text-center border-2 ${qty > 0 ? "bg-black/40 border-yellow-400/50" : "bg-black/20 border-white/10 opacity-60"}`}
                >
                  <div className="text-5xl mb-1">{c.emoji}</div>
                  <div className="font-extrabold text-sm">{c.name}</div>
                  <div className="text-2xl font-extrabold text-yellow-300 my-1">×{qty}</div>
                  <button
                    onClick={() => openOne(tier)}
                    disabled={qty <= 0 || isBusy}
                    className="w-full mt-1 py-2 rounded-lg bg-gradient-to-b from-fuchsia-400 to-violet-500 text-white text-xs font-extrabold hover:scale-105 transition disabled:opacity-40 disabled:hover:scale-100"
                  >
                    {isBusy ? "Abrindo..." : qty > 0 ? "Abrir 1" : "Vazio"}
                  </button>
                </div>
              );
            })}
          </div>
          <button
            onClick={() => navigate({ to: "/shop" })}
            className="mt-4 w-full py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-sm font-bold transition"
          >
            🏪 Ir pra loja comprar mais baús
          </button>
        </section>
      </div>

      {/* Popup do baú aberto (mesmo visual da loja) */}
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
    </main>
  );
}
