import { computeSynergies, CATEGORY_INFO } from "@/lib/game-data";

type Props = {
  speciesIds: string[];
  title?: string;
  /** Quando true, mostra apenas sinergias ativas (>= 2 pets). */
  onlyActive?: boolean;
  className?: string;
  compact?: boolean;
};

export function SynergyBadges({ speciesIds, title, onlyActive, className, compact }: Props) {
  const all = computeSynergies(speciesIds);
  const list = onlyActive ? all.filter((s) => s.active) : all;
  if (list.length === 0) return null;

  return (
    <div className={className}>
      {title && <div className="text-[11px] font-bold uppercase tracking-wider opacity-80 mb-1">{title}</div>}
      <div className="flex flex-wrap gap-1.5">
        {list.map((s) => {
          const info = CATEGORY_INFO[s.category];
          const stars = "✦".repeat(Math.min(3, Math.max(1, s.count)));
          const colorClass = s.active
            ? s.count >= 3
              ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-fuchsia-200 shadow"
              : "bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-200 shadow"
            : "bg-white/10 text-white/60 border-white/20";
          return (
            <div
              key={s.category}
              title={`${info.name}: ${s.count} pet${s.count > 1 ? "s" : ""}${s.active ? ` — +${s.bonusPct}% ${info.statLabel}` : " (precisa de 2+ pra ativar)"}`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${compact ? "text-[10px]" : "text-xs"} font-bold ${colorClass}`}
            >
              <span>{info.emoji}</span>
              <span>{info.name}</span>
              <span className="opacity-80">{stars}</span>
              {s.active && <span className="ml-0.5">+{s.bonusPct}% {info.statLabel}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
