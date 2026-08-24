import { SPECIES } from "@/lib/game-data";
import { getTypes, type PokeType } from "@/lib/moves";

export type NpcTeamMember = {
  id: string;
  owner_id: string;
  species: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
  crit: number;
  hunger: number;
  energy: number;
  happiness: number;
  skin: string;
  in_team: boolean;
  rank: number;
  team_position: number;
  is_shiny: boolean;
};

/** Espécies ativas de um tipo específico. */
export function speciesOfType(t: PokeType): string[] {
  return Object.values(SPECIES)
    .filter((s) => !s.retired && !s.hidden)
    .map((s) => s.id)
    .filter((id) => getTypes(id).includes(t));
}

/** Nomes de treinador fixos por ginásio vago (parecem players de verdade). */
export const VACANT_LEADER_NAMES: Record<string, string> = {
  normal: "LuKaS_92",
  fire: "BrunaFlames",
  water: "TidalRafa",
  grass: "Leaf_Duda",
  electric: "ThiagoVolt",
  ice: "Nay_Frost",
  fighting: "MarcosKO",
  poison: "ToxicJhow",
  ground: "PedroQuake",
  flying: "SkyLarih",
  psychic: "MindGus",
  bug: "BiaSwarm",
  rock: "RochaVitor",
  ghost: "SombraKarl",
  dragon: "DrakeIgor",
  dark: "NoiteLeo",
  steel: "AcoRenan",
  fairy: "LariGlow",
};

export function vacantLeaderName(t: PokeType): string {
  return VACANT_LEADER_NAMES[t] ?? "Treinador";
}

/** Time do líder NPC quando o ginásio está vago. */
export function buildNpcTeam(t: PokeType): NpcTeamMember[] {
  const pool = speciesOfType(t);
  const order: Record<string, number> = {
    common: 0, rare: 1, super_rare: 2, epic: 3, legendary: 4, mythic: 5,
  };
  const sorted = [...pool].sort(
    (a, b) => (order[SPECIES[b]?.rarity ?? "common"] ?? 0) - (order[SPECIES[a]?.rarity ?? "common"] ?? 0),
  );
  const top = sorted.slice(0, Math.max(3, Math.min(8, sorted.length)));
  const picked: string[] = [];
  while (picked.length < Math.min(3, top.length)) {
    const c = top[Math.floor(Math.random() * top.length)];
    if (!picked.includes(c)) picked.push(c);
  }
  return picked.map((sp, i) => ({
    id: `npc-${t}-${i}`,
    owner_id: `npc-${t}`,
    species: sp,
    name: SPECIES[sp]?.name ?? "Líder",
    hp: 90,
    atk: 12,
    def: 12,
    spd: 10,
    int: 12,
    crit: 0,
    hunger: 100,
    energy: 100,
    happiness: 100,
    skin: "default",
    in_team: true,
    rank: 3,
    team_position: i,
    is_shiny: false,
  }));
}
