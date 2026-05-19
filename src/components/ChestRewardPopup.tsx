import { useState } from "react";
import { CHESTS, SPECIES, RARITY_INFO, type ChestTier, type ChestReward } from "@/lib/game-data";

export type PendingChest = {
  id: string;
  tier: ChestTier;
  label?: string; // ex: "Level 10", "Promoção pra Ouro III"
  reward: ChestReward;
};

const TIER_GLOW: Record<ChestTier, string> = {
  wood: "from-amber-700/40 via-amber-500/30 to-orange-600/40",
  silver: "from-slate-300/40 via-slate-100/30 to-slate-400/40",
  gold: "from-yellow-400/50 via-amber-300/40 to-yellow-500/50",
  legendary: "from-fuchsia-500/50 via-purple-400/40 to-indigo-500/50",
};

const TIER_RING: Record<ChestTier, string> = {
  wood: "ring-amber-500/60",
  silver: "ring-slate-200/70",
  gold: "ring-yellow-300/80",
  legendary: "ring-fuchsia-400/90",
};

export function ChestRewardPopup({
  queue,
  onConsume,
}: {
  queue: PendingChest[];
  onConsume: (id: string) => void;
}) {
  const [opened, setOpened] = useState(false);
  const current = queue[0];

  if (!current) return null;
  const meta = CHESTS[current.tier];
  const pet = current.reward.petSpecies ? SPECIES[current.reward.petSpecies] : null;
  const remaining = queue.length;

  function close() {
    setOpened(false);
    onConsume(current.id);
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in p-4">
      <div className={`absolute inset-0 bg-gradient-to-br ${TIER_GLOW[current.tier]} animate-pulse pointer-events-none`} />
      {remaining > 1 && (
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/60 text-white text-xs font-bold border border-white/20">
          +{remaining - 1} {remaining - 1 === 1 ? "baú" : "baús"} em espera
        </div>
      )}

      <div className="relative w-full max-w-sm">
        {!opened ? (
          <button
            onClick={() => setOpened(true)}
            className={`w-full rounded-3xl bg-gradient-to-br ${TIER_GLOW[current.tier]} ring-4 ${TIER_RING[current.tier]} p-8 text-center text-white shadow-2xl hover:scale-105 transition-transform cursor-pointer animate-scale-in`}
          >
            {current.label && (
              <div className="text-sm font-bold opacity-90 mb-1">🎉 {current.label}</div>
            )}
            <div className="text-xl font-extrabold tracking-wide">{meta.name}</div>
            <div className="text-[110px] my-3 drop-shadow-2xl animate-bounce leading-none">
              {meta.emoji}
            </div>
            <div className="mt-3 px-4 py-2 rounded-xl bg-white/20 backdrop-blur font-extrabold text-sm uppercase tracking-widest animate-pulse">
              👆 Toque pra abrir
            </div>
          </button>
        ) : (
          <div className={`rounded-3xl bg-gradient-to-br ${TIER_GLOW[current.tier]} ring-4 ${TIER_RING[current.tier]} p-6 text-center text-white shadow-2xl animate-scale-in`}>
            {current.label && (
              <div className="text-xs font-bold opacity-90 mb-1">🎉 {current.label}</div>
            )}
            <div className="text-lg font-extrabold">{meta.name.toUpperCase()}</div>
            <div className="text-6xl my-2 drop-shadow-lg">✨{meta.emoji}✨</div>

            {pet && (
              <div className="my-3 p-3 rounded-2xl bg-black/30 animate-fade-in">
                <img
                  src={pet.image}
                  alt={pet.name}
                  className="h-32 mx-auto drop-shadow-2xl animate-in zoom-in duration-700"
                />
                <div className="mt-2 font-extrabold text-base">
                  {pet.emoji} {pet.name}
                </div>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full ${RARITY_INFO[pet.rarity].color} text-[10px] font-extrabold`}
                >
                  {RARITY_INFO[pet.rarity].emoji} {RARITY_INFO[pet.rarity].name}
                </span>
              </div>
            )}

            <div className="mt-3 space-y-1 text-sm font-bold animate-fade-in">
              {current.reward.coins > 0 && <div>+🪙 {current.reward.coins} moedas</div>}
              {current.reward.gems > 0 && <div>+💎 {current.reward.gems} gemas</div>}
              {current.reward.rations > 0 && <div>+🍖 {current.reward.rations} rações</div>}
              {!pet && current.reward.coins === 0 && current.reward.gems === 0 && current.reward.rations === 0 && (
                <div className="opacity-80">Vazio… mais sorte da próxima!</div>
              )}
            </div>

            <button
              onClick={close}
              className="mt-5 w-full px-4 py-2.5 rounded-xl bg-white/25 hover:bg-white/35 text-sm font-extrabold tracking-wide"
            >
              {remaining > 1 ? "Próximo baú →" : "Continuar"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
