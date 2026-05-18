import { SPECIES, skinFilter, ELEMENT_COLORS, ELEMENT_NAMES, totalStats } from "@/lib/game-data";

export type MonsterRow = {
  id: string;
  species: string;
  name: string;
  level: number;
  xp: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  hunger: number;
  energy: number;
  happiness: number;
  skin: string;
  in_team: boolean;
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
  const stats = totalStats(monster.species, monster.level);
  const gradient = ELEMENT_COLORS[sp.element];

  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-2xl overflow-hidden border-2 transition-transform hover:scale-[1.02] ${
        selected ? "border-yellow-400 ring-4 ring-yellow-300/50" : "border-white/30"
      } shadow-xl backdrop-blur-sm`}
    >
      {monster.in_team && (
        <span className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full bg-yellow-400 text-yellow-950 text-[10px] font-extrabold shadow">
          ⚔️ TIME
        </span>
      )}
      <span className="absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full bg-black/70 text-white text-[10px] font-extrabold">
        Nv {monster.level}
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
          {sp.emoji} {sp.name} • {ELEMENT_NAMES[sp.element]}
        </div>
        {!compact && (
          <div className="mt-1.5 grid grid-cols-4 gap-1 text-[10px] font-bold">
            <span className="text-rose-600">❤️{stats.hp}</span>
            <span className="text-orange-600">⚔️{stats.atk}</span>
            <span className="text-blue-600">🛡️{stats.def}</span>
            <span className="text-purple-600">💨{stats.spd}</span>
          </div>
        )}
      </div>
    </button>
  );
}
