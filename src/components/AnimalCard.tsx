import { ANIMALS, getAnimalReady } from "@/lib/game-data";
import { useEffect, useState } from "react";

type Props = {
  animalType: string;
  lastCollected: string;
  onCollect: () => void;
};

export function AnimalCard({ animalType, lastCollected, onCollect }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const a = ANIMALS[animalType];
  if (!a) return null;
  const { ready, progress } = getAnimalReady(lastCollected, animalType);
  const remaining = Math.max(0, a.cooldownSeconds - (Date.now() - new Date(lastCollected).getTime()) / 1000);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);

  return (
    <button
      onClick={ready ? onCollect : undefined}
      disabled={!ready}
      className={`relative w-full p-3 rounded-xl flex flex-col items-center gap-1 transition btn-pop ${
        ready
          ? "bg-gradient-to-b from-accent to-gold border-2 border-amber-600 cursor-pointer"
          : "bg-muted border-2 border-border opacity-90"
      }`}
    >
      <span className={`text-5xl ${ready ? "grow-pulse" : ""}`}>{a.emoji}</span>
      <span className="text-xs font-bold">{a.name}</span>
      {ready ? (
        <span className="text-[11px] font-extrabold text-accent-foreground bg-card/80 rounded-full px-2 py-0.5">
          {a.productEmoji} Coletar!
        </span>
      ) : (
        <div className="w-full">
          <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
          </div>
        </div>
      )}
    </button>
  );
}
