export type SeasonReward = {
  tier: string;
  emoji: string;
  color: string;
  gems: number;
  chests: string;
  extras?: string;
};

export const SEASON_REWARDS: SeasonReward[] = [
  { tier: "Ferro",       emoji: "⛓️", color: "bg-zinc-600 text-white",                                          gems: 10,  chests: "—" },
  { tier: "Bronze",      emoji: "🥉", color: "bg-amber-700 text-amber-50",                                      gems: 25,  chests: "1× Baú Madeira" },
  { tier: "Prata",       emoji: "🥈", color: "bg-slate-400 text-slate-900",                                     gems: 50,  chests: "1× Baú Prata" },
  { tier: "Ouro",        emoji: "🥇", color: "bg-yellow-500 text-yellow-950",                                   gems: 100, chests: "1× Baú Ouro" },
  { tier: "Platina",     emoji: "💠", color: "bg-cyan-500 text-cyan-950",                                       gems: 150, chests: "1× Baú Ouro" },
  { tier: "Diamante",    emoji: "💎", color: "bg-sky-400 text-sky-950",                                         gems: 250, chests: "1× Baú Lendário" },
  { tier: "Mestre",      emoji: "🏆", color: "bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white",      gems: 400, chests: "2× Baú Lendário", extras: "Título exclusivo no perfil" },
  { tier: "Grão-Mestre", emoji: "🔥", color: "bg-gradient-to-r from-red-500 to-pink-600 text-white",            gems: 600, chests: "3× Baú Lendário", extras: "Título exclusivo + Skin exclusiva" },
  { tier: "Lendário",    emoji: "🌟", color: "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white", gems: 800, chests: "5× Baú Lendário", extras: "Título + Skin + Pet exclusivos + Troféu permanente 🏆" },
];

export function tierTrophyEmoji(tier: string): string {
  if (tier === "Lendário") return "🌟";
  if (tier === "Grão-Mestre") return "🔥";
  if (tier === "Mestre") return "🏆";
  return "🎖️";
}
