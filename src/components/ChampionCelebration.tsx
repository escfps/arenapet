import { useEffect, useState } from "react";

type Reward = {
  coins: number;
  gems: number;
  rations: number;
  bonus_pet: { species: string; name: string; rarity: string } | null;
};

type Props = {
  championName: string;
  reward: Reward | null;
  onClose: () => void;
};

const RARITY_LABEL: Record<string, { text: string; cls: string }> = {
  common:     { text: "Comum",      cls: "from-slate-300 to-slate-500 text-slate-900" },
  rare:       { text: "Raro",       cls: "from-sky-400 to-blue-600 text-white" },
  super_rare: { text: "Super Raro", cls: "from-fuchsia-400 to-purple-700 text-white" },
  epic:       { text: "Épico",      cls: "from-amber-400 to-orange-600 text-white" },
};

export function ChampionCelebration({ championName, reward, onClose }: Props) {
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOpened(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const rar = reward?.bonus_pet ? RARITY_LABEL[reward.bonus_pet.rarity] ?? RARITY_LABEL.common : null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 overflow-y-auto">
      {/* backdrop with golden rays */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-900/95 via-yellow-700/90 to-amber-900/95 backdrop-blur-md" />
      <div
        className="absolute inset-0 opacity-40 animate-spin"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(255,215,100,0.45) 8deg, transparent 16deg, transparent 30deg, rgba(255,215,100,0.45) 38deg, transparent 46deg, transparent 60deg, rgba(255,215,100,0.45) 68deg, transparent 76deg, transparent 90deg, rgba(255,215,100,0.45) 98deg, transparent 106deg, transparent 360deg)",
          animationDuration: "18s",
        }}
      />

      {/* confetti dots */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="absolute block w-2 h-3 rounded-sm animate-bounce"
            style={{
              left: `${(i * 4.3) % 100}%`,
              top: `${(i * 7.7) % 90}%`,
              background: ["#fde047", "#f59e0b", "#fff", "#facc15", "#fb923c"][i % 5],
              animationDelay: `${(i % 8) * 0.15}s`,
              animationDuration: `${1.2 + (i % 5) * 0.2}s`,
              transform: `rotate(${(i * 37) % 360}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-yellow-50 to-amber-100 border-4 border-yellow-300 shadow-2xl p-5 text-center animate-scale-in">
        <div className="text-7xl drop-shadow animate-bounce">🏆</div>
        <div className="text-xs font-extrabold tracking-[0.3em] text-amber-700 mt-1">VITÓRIA ÉPICA</div>
        <div className="text-3xl font-black text-amber-900 leading-tight mt-1">
          VOCÊ É O CAMPEÃO!
        </div>
        <div className="text-sm font-bold text-amber-800 mt-1">
          {championName}, parabéns pelo título 👑
        </div>

        {/* Chest */}
        <div className="my-5 flex justify-center">
          <div className="relative">
            <div
              className={`text-[110px] leading-none transition-all duration-700 ${
                opened ? "scale-110 -translate-y-1" : "animate-pulse"
              }`}
              style={{ filter: opened ? "drop-shadow(0 0 24px rgba(253,224,71,0.9))" : "drop-shadow(0 0 12px rgba(253,224,71,0.5))" }}
            >
              {opened ? "🪙" : "🎁"}
            </div>
            {!opened && (
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[10px] font-extrabold text-amber-700 animate-pulse">
                Abrindo Baú de Ouro…
              </div>
            )}
          </div>
        </div>

        {/* Rewards */}
        {opened && reward && (
          <div className="space-y-2 animate-fade-in">
            <div className="text-xs font-extrabold text-amber-800 uppercase tracking-wider">
              🥇 Baú de Ouro
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-gradient-to-b from-yellow-200 to-amber-400 border-2 border-yellow-500 p-2 shadow">
                <div className="text-2xl">🪙</div>
                <div className="text-lg font-black text-amber-900 leading-none">+{reward.coins}</div>
                <div className="text-[10px] font-bold text-amber-800">moedas</div>
              </div>
              <div className="rounded-xl bg-gradient-to-b from-fuchsia-200 to-purple-400 border-2 border-purple-500 p-2 shadow">
                <div className="text-2xl">💎</div>
                <div className="text-lg font-black text-purple-900 leading-none">+{reward.gems}</div>
                <div className="text-[10px] font-bold text-purple-800">diamantes</div>
              </div>
              <div className="rounded-xl bg-gradient-to-b from-emerald-200 to-emerald-400 border-2 border-emerald-500 p-2 shadow">
                <div className="text-2xl">🍖</div>
                <div className="text-lg font-black text-emerald-900 leading-none">+{reward.rations}</div>
                <div className="text-[10px] font-bold text-emerald-800">rações</div>
              </div>
            </div>

            {reward.bonus_pet && rar && (
              <div className={`rounded-xl p-3 border-2 border-white/60 shadow bg-gradient-to-r ${rar.cls} animate-scale-in`}>
                <div className="text-[10px] font-extrabold uppercase tracking-wider opacity-90">🎉 Pet bônus</div>
                <div className="text-base font-black leading-tight">{reward.bonus_pet.name}</div>
                <div className="text-[10px] font-bold opacity-90">{rar.text}</div>
              </div>
            )}

            <div className="text-[11px] text-amber-800 opacity-80 pt-1">
              Recompensas já creditadas na sua conta ✨
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="mt-5 w-full px-5 py-3 rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 text-white font-black tracking-wider border-2 border-yellow-300 shadow-lg hover:scale-[1.02] transition"
        >
          {opened ? "RECEBER E CONTINUAR" : "AGUARDE…"}
        </button>
      </div>
    </div>
  );
}
