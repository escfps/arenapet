import { SPECIES, skinFilter, ELEMENT_COLORS, ELEMENT_NAMES, ROLE_INFO, RARITY_INFO, totalStats, rankStars, MAX_RANK } from "@/lib/game-data";

export type MonsterRow = {
  id: string;
  species: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  hunger: number;
  energy: number;
  happiness: number;
  skin: string;
  in_team: boolean;
  rank: number;
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
  const stats = totalStats(monster.species, rank);
  const gradient = ELEMENT_COLORS[sp.element];

  const isMax = rank >= MAX_RANK;
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl overflow-hidden border-2 transition-transform hover:scale-[1.02] ${
        selected ? "border-yellow-400 ring-4 ring-yellow-300/50" : "border-white/30"
      } shadow-xl backdrop-blur-sm ring-2 ${RARITY_INFO[sp.rarity].ringColor} ${isMax ? "rank-max-glow" : ""}`}
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
      <div className={`bg-gradient-to-br ${gradient} ${compact ? "p-2" : "p-3"}`}>
        <div className={`flex items-center justify-center ${compact ? "h-20" : "h-32"}`}>
          <img
            src={sp.image}
            alt={sp.name}
            loading="lazy"
            className="h-full w-auto object-contain drop-shadow-2xl"
            style={{ filter: skinFilter(monster.skin) }}
          />
        </div>
      </div>
      <div className="p-2 bg-card/95 backdrop-blur-sm">
        <div className="font-extrabold text-sm truncate">{monster.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {sp.emoji} {sp.name} • {ELEMENT_NAMES[sp.element]}{sp.secondaryElement ? ` / ${ELEMENT_NAMES[sp.secondaryElement]}` : ""}
        </div>
        {!compact && (
          <div className="mt-1.5 grid grid-cols-5 gap-1 text-[10px] font-bold">
            <span className="text-rose-600">❤️{stats.hp}</span>
            <span className="text-orange-600">⚔️{stats.atk}</span>
            <span className="text-blue-600">🛡️{stats.def}</span>
            <span className="text-purple-600">💨{stats.spd}</span>
            <span className="text-fuchsia-600">🧠{stats.int}</span>
          </div>
        )}
      </div>
    </button>
  );
}
