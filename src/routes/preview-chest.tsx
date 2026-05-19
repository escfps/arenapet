import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChestRewardPopup, type PendingChest } from "@/components/ChestRewardPopup";
import { rollChest, type ChestTier } from "@/lib/game-data";

export const Route = createFileRoute("/preview-chest")({
  component: PreviewChest,
});

function PreviewChest() {
  const [queue, setQueue] = useState<PendingChest[]>([]);

  function add(tier: ChestTier, label: string) {
    setQueue((q) => [
      ...q,
      { id: crypto.randomUUID(), tier, label, reward: rollChest(tier) },
    ]);
  }

  function addAll() {
    const list: PendingChest[] = [
      { id: crypto.randomUUID(), tier: "wood", label: "Level 5", reward: rollChest("wood") },
      { id: crypto.randomUUID(), tier: "silver", label: "Level 10", reward: rollChest("silver") },
      { id: crypto.randomUUID(), tier: "gold", label: "Promoção pra Ouro III", reward: rollChest("gold") },
      { id: crypto.randomUUID(), tier: "legendary", label: "Level 50", reward: rollChest("legendary") },
    ];
    setQueue(list);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6 text-white">
      <h1 className="text-2xl font-extrabold mb-2">🎁 Preview de Baús</h1>
      <p className="opacity-80 mb-6 text-sm">
        Clique pra abrir um baú e ver a animação igual aparece quando ganha upando de nível ou ranque.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
        <button onClick={() => add("wood", "Level 5")} className="p-4 rounded-2xl bg-amber-700 hover:scale-105 transition font-bold">
          📦 Madeira
        </button>
        <button onClick={() => add("silver", "Level 10")} className="p-4 rounded-2xl bg-slate-400 text-slate-900 hover:scale-105 transition font-bold">
          🥈 Prata
        </button>
        <button onClick={() => add("gold", "Promoção Ouro III")} className="p-4 rounded-2xl bg-yellow-500 text-yellow-950 hover:scale-105 transition font-bold">
          🥇 Ouro
        </button>
        <button onClick={() => add("legendary", "Level 50")} className="p-4 rounded-2xl bg-fuchsia-600 hover:scale-105 transition font-bold">
          ✨ Lendário
        </button>
      </div>

      <button
        onClick={addAll}
        className="mt-4 px-5 py-3 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-600 font-extrabold hover:scale-105 transition"
      >
        🎉 Simular fila (4 baús)
      </button>

      <ChestRewardPopup queue={queue} onConsume={(id) => setQueue((q) => q.filter((c) => c.id !== id))} />
    </div>
  );
}
