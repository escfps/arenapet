import { CROPS, getCropProgress, getCropStage } from "@/lib/game-data";
import { useEffect, useState } from "react";

type Props = {
  cropType: string | null;
  plantedAt: string | null;
  onClick: () => void;
};

export function Plot({ cropType, plantedAt, onClick }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!plantedAt) return;
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [plantedAt]);

  const stage = getCropStage(plantedAt, cropType);
  const crop = cropType ? CROPS[cropType] : null;
  const progress = plantedAt && cropType ? getCropProgress(plantedAt, cropType) : 0;

  let emoji = "";
  let size = "text-4xl";
  if (crop) {
    if (stage === "seedling") { emoji = crop.seedling; size = "text-2xl"; }
    else if (stage === "growing") { emoji = crop.growing; size = "text-3xl"; }
    else if (stage === "ready") { emoji = crop.ready; size = "text-5xl"; }
  }

  const remaining = plantedAt && crop ? Math.max(0, crop.growSeconds - (Date.now() - new Date(plantedAt).getTime()) / 1000) : 0;
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);

  return (
    <button
      onClick={onClick}
      className={`plot-tile ${!crop ? "plot-empty" : ""} aspect-square rounded-xl flex flex-col items-center justify-center relative btn-pop`}
    >
      {emoji && (
        <span className={`${size} ${stage === "ready" ? "grow-pulse" : ""} drop-shadow-md`}>
          {emoji}
        </span>
      )}
      {crop && stage !== "ready" && (
        <div className="absolute bottom-1 left-1 right-1 h-1.5 bg-black/30 rounded-full overflow-hidden">
          <div className="h-full bg-grass transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
      )}
      {crop && stage !== "ready" && (
        <span className="absolute top-1 right-1 text-[10px] font-bold bg-black/40 text-white px-1.5 py-0.5 rounded">
          {mins > 0 ? `${mins}m` : `${secs}s`}
        </span>
      )}
      {stage === "ready" && (
        <span className="absolute top-1 right-1 text-[10px] font-bold bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
          ✓
        </span>
      )}
    </button>
  );
}
