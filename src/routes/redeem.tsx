import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { redeemCode } from "@/lib/redeem.functions";
import { SPECIES, RARITY_INFO, rankStars, CHESTS } from "@/lib/game-data";

export const Route = createFileRoute("/redeem")({
  component: RedeemPage,
});

type RewardResult = {
  type: string;
  species?: string;
  rank?: number;
  chestTier?: string;
  coins?: number;
  gems?: number;
};

function RedeemPage() {
  const navigate = useNavigate();
  const redeemFn = useServerFn(redeemCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState<RewardResult | null>(null);

  async function doRedeem() {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await redeemFn({ data: { code: code.trim() } });
      setReward(r.reward as RewardResult);
      setCode("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sp = reward?.species ? SPECIES[reward.species] : null;
  const chest = reward?.chestTier ? CHESTS[reward.chestTier as keyof typeof CHESTS] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 text-white">
      <Toaster richColors position="top-center" />
      <div className="max-w-md mx-auto space-y-4 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">🎁 Resgatar Código</h1>
          <button onClick={() => navigate({ to: "/" })} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">
            ← Voltar
          </button>
        </div>

        <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-4 space-y-3">
          <p className="text-sm opacity-80">
            Digite o código abaixo para resgatar sua recompensa.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && doRedeem()}
            placeholder="XXXX-XXXX-XXXX"
            className="w-full px-4 py-3 rounded-lg bg-black/40 border border-white/20 text-center font-mono text-lg tracking-widest uppercase outline-none focus:border-purple-400"
          />
          <button
            disabled={busy || !code.trim()}
            onClick={doRedeem}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 font-extrabold text-lg disabled:opacity-50"
          >
            {busy ? "Resgatando..." : "🎉 Resgatar"}
          </button>
        </div>
      </div>

      {reward && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setReward(null)}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/30 via-fuchsia-500/20 to-purple-600/30 animate-pulse pointer-events-none" />
          <div
            className="relative w-full max-w-sm rounded-3xl bg-gradient-to-br from-purple-900 to-fuchsia-900 ring-4 ring-yellow-300/80 p-6 text-center text-white shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xs font-bold opacity-90 mb-1">🎉 Código resgatado!</div>
            <div className="text-xl font-extrabold">VOCÊ GANHOU</div>

            {sp && (
              <div className="my-4 p-3 rounded-2xl bg-black/30 animate-fade-in">
                <img
                  src={sp.image}
                  alt={sp.name}
                  className="h-40 mx-auto drop-shadow-2xl animate-in zoom-in duration-700"
                />
                <div className="mt-2 font-extrabold text-lg">
                  {sp.emoji} {sp.name}
                </div>
                <div className="text-yellow-300 text-xl">
                  {rankStars(reward.rank ?? 1)}
                </div>
                <span
                  className={`inline-block mt-1 px-2 py-0.5 rounded-full ${RARITY_INFO[sp.rarity].color} text-[10px] font-extrabold`}
                >
                  {RARITY_INFO[sp.rarity].emoji} {RARITY_INFO[sp.rarity].name}
                </span>
              </div>
            )}

            {chest && (
              <div className="my-4 p-3 rounded-2xl bg-black/30 animate-fade-in">
                <div className="text-[110px] my-3 drop-shadow-2xl animate-bounce leading-none">
                  {chest.emoji}
                </div>
                <div className="font-extrabold text-base">{chest.name}</div>
              </div>
            )}

            <div className="mt-3 space-y-1 text-base font-bold animate-fade-in">
              {(reward.coins ?? 0) > 0 && <div>+🪙 {reward.coins} moedas</div>}
              {(reward.gems ?? 0) > 0 && <div>+💎 {reward.gems} gemas</div>}
            </div>

            <button
              onClick={() => setReward(null)}
              className="mt-5 w-full px-4 py-2.5 rounded-xl bg-white/25 hover:bg-white/35 text-sm font-extrabold tracking-wide"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
