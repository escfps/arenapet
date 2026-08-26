import { SPECIES, speciesImage, shinyFallbackFilter, skinFilter, ELEMENT_COLORS, ELEMENT_NAMES, ROLE_INFO, RARITY_INFO, totalStats, rankStars, MAX_RANK, getSpeciesCategories, CATEGORY_INFO } from "@/lib/game-data";

export type MonsterRow = {
  id: string;
  species: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
  crit?: number;
  hunger: number;
  energy: number;
  happiness: number;
  skin: string;
  in_team: boolean;
  rank: number;
  battle_energy?: number;
  battle_energy_at?: string;
  team_position?: number;
  train_count?: number;
  is_shiny?: boolean;
  soulbound?: boolean;
};

type Props = {
  monster: MonsterRow;
  onClick?: () => void;
  compact?: boolean;
  selected?: boolean;
};

export function MonsterCard({ monster, onClick, compact, selected }: Props) {
  const sp = SPECIES[monster.species];
  if (!sp) return null;
  const rank = monster.rank ?? 1;
  const shiny = monster.is_shiny === true;
  const stats = totalStats(monster.species, rank, {
    hp: monster.hp ?? 0, atk: monster.atk ?? 0, def: monster.def ?? 0, spd: monster.spd ?? 0, int: monster.int ?? 0,
  }, shiny);
  const gradient = ELEMENT_COLORS[sp.element];

  const isMax = rank >= MAX_RANK;
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl overflow-hidden border-2 transition-transform hover:scale-[1.02] ${
        selected ? "border-yellow-400 ring-4 ring-yellow-300/50" : "border-white/30"
      } shadow-xl backdrop-blur-sm ring-2 ${shiny ? "ring-amber-300 shadow-[0_0_28px_rgba(252,211,77,0.85)]" : RARITY_INFO[sp.rarity].ringColor} ${isMax ? "rank-max-glow" : ""}`}
    >
      {monster.in_team && (
        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-950 text-[10px] font-extrabold shadow">
          ⚔️ TIME
        </span>
      )}
      <span className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full text-[10px] font-extrabold shadow-lg ${isMax ? "bg-gradient-to-r from-yellow-300 via-pink-400 to-violet-400 text-white animate-pulse" : "bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950"}`}>
        {rankStars(rank)}
      </span>
      <span className={`absolute bottom-[3.5rem] right-2 z-10 px-2 py-0.5 rounded-full ${ROLE_INFO[sp.role].color} text-white text-[10px] font-extrabold shadow-lg`}>
        {ROLE_INFO[sp.role].emoji} {ROLE_INFO[sp.role].name}
      </span>
      <span className={`absolute bottom-[3.5rem] left-2 z-10 px-2 py-0.5 rounded-full ${RARITY_INFO[sp.rarity].color} text-[10px] font-extrabold shadow-lg`}>
        {RARITY_INFO[sp.rarity].emoji} {RARITY_INFO[sp.rarity].name}
      </span>
      <div className={`bg-gradient-to-br ${gradient} ${compact ? "p-2" : "p-3"} relative`}>
        <div className="absolute top-1 left-1 z-10 flex flex-col gap-1">
          {getSpeciesCategories(monster.species).map((cat) => (
            <span
              key={cat}
              title={`${CATEGORY_INFO[cat].name} • +${CATEGORY_INFO[cat].statLabel}`}
              className="w-6 h-6 rounded-full bg-black/55 backdrop-blur-sm border border-white/40 text-[12px] flex items-center justify-center shadow"
            >
              {CATEGORY_INFO[cat].emoji}
            </span>
          ))}
        </div>
        <div className="absolute top-1 right-1 z-20 flex flex-col items-end gap-1">
        {shiny && (
          <span className="px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 text-amber-950 text-[9px] font-extrabold shadow animate-pulse">
            ✨ SHINY
          </span>
        )}
        <div className={`flex items-center justify-center ${compact ? "h-20" : "h-32"}`}>
          <img
            src={speciesImage(monster.species, shiny)}
            alt={sp.name}
            loading="lazy"
            className="h-full w-auto object-contain drop-shadow-2xl"
            style={{ filter: `${skinFilter(monster.skin)} ${shinyFallbackFilter(monster.species, shiny)} ${shiny ? "drop-shadow(0 0 10px rgba(253,224,71,0.9))" : ""}`.trim() }}
          />
        </div>
      </div>
      <div className="p-2 bg-card/95 backdrop-blur-sm">
        <div className="font-extrabold text-sm truncate">{shiny ? "✨ " : ""}{monster.name}</div>
        {shiny && (
          <div className="text-[9px] font-extrabold text-amber-600">+10% status • ✨ Aura Prismática</div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {sp.emoji} {sp.name} • {ELEMENT_NAMES[sp.element]}{sp.secondaryElement ? ` / ${ELEMENT_NAMES[sp.secondaryElement]}` : ""}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {getSpeciesCategories(monster.species).map((cat) => (
            <span
              key={cat}
              className="px-1.5 py-0.5 rounded-full bg-muted text-[9px] font-bold flex items-center gap-0.5"
              title={`+${CATEGORY_INFO[cat].statLabel} com sinergia`}
            >
              <span>{CATEGORY_INFO[cat].emoji}</span>
              <span>{CATEGORY_INFO[cat].name}</span>
            </span>
          ))}
        </div>
        {!compact && (() => {
          const baseCritPct = sp.role === "assassin" ? 35 : monster.species === "raposa_espectral" ? 30 : 12;
          const critPct = Math.min(95, baseCritPct + (monster.crit ?? 0) * 2);
          return (
            <div className="mt-1.5 grid grid-cols-6 gap-0.5 text-[10px] font-bold">
              <span className="text-rose-600">❤️{stats.hp}</span>
              <span className="text-orange-600">⚔️{stats.atk}</span>
              <span className="text-blue-600">🛡️{stats.def}</span>
              <span className="text-purple-600">💨{stats.spd}</span>
              <span className="text-fuchsia-600">🧠{stats.int}</span>
              <span className="text-yellow-600">💢{critPct}%</span>
            </div>
          );
        })()}
      </div>
    </button>
  );
}
