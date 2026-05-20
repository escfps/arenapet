import flarepupImg from "@/assets/monsters/flarepup.png";
import aquakittyImg from "@/assets/monsters/aquakitty.png";
import leafoxImg from "@/assets/monsters/leafox.png";
import voltbunImg from "@/assets/monsters/voltbun.png";
import shadepupImg from "@/assets/monsters/shadepup.png";
import steamcubImg from "@/assets/monsters/steamcub.png";
import emberleafImg from "@/assets/monsters/emberleaf.png";
import sparkpupImg from "@/assets/monsters/sparkpup.png";
import cinderwispImg from "@/assets/monsters/cinderwisp.png";
import mossfinImg from "@/assets/monsters/mossfin.png";
import stormtadImg from "@/assets/monsters/stormtad.png";
import tidewraithImg from "@/assets/monsters/tidewraith.png";
import voltsproutImg from "@/assets/monsters/voltsprout.png";
import nightbloomImg from "@/assets/monsters/nightbloom.png";
import voidsparkImg from "@/assets/monsters/voidspark.png";
import rockpupImg from "@/assets/monsters/rockpup.png";
import magmaboulderImg from "@/assets/monsters/magmaboulder.png";
import mudpawImg from "@/assets/monsters/mudpaw.png";
import crystalspriteImg from "@/assets/monsters/crystalsprite.png";
import oncaSombriaImg from "@/assets/monsters/onca_sombria.png";
import leaoDouradoImg from "@/assets/monsters/leao_dourado.png";
import tigreInfernalImg from "@/assets/monsters/tigre_infernal.png";
import panteraNegraImg from "@/assets/monsters/pantera_negra.png";
import panteraAureaImg from "@/assets/monsters/pantera_aurea.png";
import dragaoBrancoImg from "@/assets/monsters/dragao_branco.png";
import dragaoNegroImg from "@/assets/monsters/dragao_negro.png";
import dragaoFogoImg from "@/assets/monsters/dragao_fogo.png";
import jacareAncestralImg from "@/assets/monsters/jacare_ancestral.png";
import gorilaTitanImg from "@/assets/monsters/gorila_titan.png";
import ratoBombaImg from "@/assets/monsters/rato_bomba.png";
import macacoPregoImg from "@/assets/monsters/macaco_prego.png";
import tubaraoAbissalImg from "@/assets/monsters/tubarao_abissal.png";
import polvoVenenosoImg from "@/assets/monsters/polvo_venenoso.png";
import cobraSangrentaImg from "@/assets/monsters/cobra_sangrenta.png";
import aguiaCegaImg from "@/assets/monsters/aguia_cega.png";
import fenixVermelhaImg from "@/assets/monsters/fenix_vermelha.png";
import fenixNegraImg from "@/assets/monsters/fenix_negra.png";
import fenixAzulImg from "@/assets/monsters/fenix_azul.png";
import borboletaSoniferaImg from "@/assets/monsters/borboleta_sonifera.png";
import ursoPolarImg from "@/assets/monsters/urso_polar.png";
import loboLuaSangrentaImg from "@/assets/monsters/lobo_lua_sangrenta.png";

export type Element = "fire" | "water" | "grass" | "electric" | "shadow" | "earth";
export type Role = "tank" | "dps" | "assassin" | "mage" | "healer";
export type Rarity = "common" | "rare" | "super_rare" | "epic" | "legendary" | "mythic";

export type Species = {
  id: string;
  name: string;
  element: Element;
  secondaryElement?: Element; // hybrids have two
  role: Role;
  rarity: Rarity;
  emoji: string;
  image: string;
  description: string;
  base: { hp: number; atk: number; def: number; spd: number; int: number };
  skill?: Skill; // unique skill per species (overrides ROLE_SKILLS)
};

export const ROLE_INFO: Record<Role, { name: string; emoji: string; description: string; color: string }> = {
  tank: { name: "Tank", emoji: "🛡️", description: "Provoca: inimigos atacam ele primeiro. Muito HP/DEF.", color: "bg-blue-500" },
  dps: { name: "DPS", emoji: "⚔️", description: "Dano consistente alto (+15% de dano).", color: "bg-orange-500" },
  assassin: { name: "Assassino", emoji: "🗡️", description: "Crítico em 35% dos golpes e mira no mais fraco.", color: "bg-purple-500" },
  mage: { name: "Mago", emoji: "🔮", description: "Dano mágico escala com 🧠 INT e ignora 60% da DEF.", color: "bg-fuchsia-500" },
  healer: { name: "Healer", emoji: "✨", description: "Cura escala com 🧠 INT. A cada 2 turnos cura o aliado mais ferido.", color: "bg-emerald-500" },
};

export const RARITY_INFO: Record<Rarity, { name: string; emoji: string; color: string; ringColor: string; statMult: number; skillMult: number }> = {
  common:     { name: "Comum",      emoji: "✦",       color: "bg-slate-400 text-white",                                                       ringColor: "ring-slate-300",   statMult: 0.80, skillMult: 0.85 },
  rare:       { name: "Raro",       emoji: "✦✦",     color: "bg-amber-500 text-amber-950",                                                   ringColor: "ring-amber-400",   statMult: 1.00, skillMult: 1.00 },
  super_rare: { name: "Super Raro", emoji: "✦✦✦",   color: "bg-cyan-500 text-white",                                                         ringColor: "ring-cyan-400",    statMult: 1.15, skillMult: 1.15 },
  epic:       { name: "Épico",      emoji: "✦✦✦✦", color: "bg-gradient-to-r from-violet-500 to-purple-600 text-white",                     ringColor: "ring-violet-400",  statMult: 1.30, skillMult: 1.35 },
  legendary:  { name: "Lendário",   emoji: "✦✦✦✦✦", color: "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white",                    ringColor: "ring-fuchsia-400", statMult: 1.50, skillMult: 1.55 },
  mythic:     { name: "Mítico",     emoji: "✦✦✦✦✦✦", color: "bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 text-white",      ringColor: "ring-cyan-300",    statMult: 1.75, skillMult: 1.85 },
};

// ===== Skills =====
// 5 mecânicas base (legadas) + 10 novas mecânicas exclusivas inspiradas em LoL
export type SkillKind =
  | "shield_taunt"      // tank — escudo + provoca (Garen-ish)
  | "heavy_strike"      // dps — golpe pesado mono-alvo
  | "guaranteed_crit"   // assassino — crítico no mais fraco (Zed)
  | "aoe_magic"         // mago — explosão em todos (Brand)
  | "team_heal"         // healer — cura todo o time (Soraka)
  | "lifesteal_strike"  // dps — bate e cura (Aatrox)
  | "execute"           // assassino — dano massivo em alvo < 30% HP (Garen R)
  | "burn_dot"          // mago — queimadura em todos (Brand passiva)
  | "double_strike"     // assassino — 2 golpes no mais forte (Master Yi)
  | "shield_ally"       // healer — escudo + def num aliado (Lulu/Janna)
  | "chain_lightning"   // mago — pula em 3 inimigos (Kennen)
  | "silence_disable"   // mago — silencia (anula skill do alvo) (Fizz/Talon)
  | "berserker_rage"    // dps/tank — buff ATK +50% por 3 turnos (Tryndamere)
  | "revive_ally"       // healer — ressuscita um aliado com 30% HP (Zilean)
  | "bleed_dot"         // dps — sangramento físico escala com ATK (Darius)
  | "blind_debuff"      // mago — cega TODOS inimigos: 50% miss em ataques básicos por 3 turnos
  | "sleep_strike"      // super raro — dano + 50% chance de adormecer alvo / PASSIVA: ataque básico 50% chance de adormecer
  | "freeze_strike"     // super raro — dano gélido + chance de congelar / PASSIVA: ataque básico 50% chance de congelar
  | "true_damage_nuke"  // mítico — dano puro ignora DEF e elemento (Vayne ult)
  | "phoenix_rage"      // mítico — PASSIVA: quanto mais HP perde, mais ATK ganha (até +120%)
  | "phoenix_growth"    // mítico — PASSIVA: cada dano causado vira HP máx + cura temporária na batalha
  | "heal_lowest"       // healer — cura o aliado mais ferido (INT × 1.2)
  | "ash_breath";       // mago — dano mágico + reduz DEF do alvo em 20% por 2 turnos

export type Skill = {
  name: string;
  emoji: string;
  description: string;
  kind: SkillKind;
  cooldown: number; // turnos
};

// Skills padrão por role — fallback se species.skill não estiver definida
export const ROLE_SKILLS: Record<Role, Skill> = {
  tank: {
    name: "Provocação Brutal", emoji: "🛡️", kind: "shield_taunt", cooldown: 4,
    description: "Provoca todos os inimigos por 2 turnos e ganha escudo (30% do HP máx).",
  },
  dps: {
    name: "Investida Devastadora", emoji: "💥", kind: "heavy_strike", cooldown: 3,
    description: "Golpe pesado: 2.2× o dano normal num alvo único.",
  },
  assassin: {
    name: "Lâmina Sombria", emoji: "🗡️", kind: "guaranteed_crit", cooldown: 3,
    description: "Ataque garantido CRÍTICO no inimigo mais fraco, ignorando 60% da DEF.",
  },
  mage: {
    name: "Detonação Arcana", emoji: "🔮", kind: "aoe_magic", cooldown: 4,
    description: "Explosão mágica que atinge TODOS os inimigos (1.2× dano cada, ignora defesa).",
  },
  healer: {
    name: "Bênção Restauradora", emoji: "✨", kind: "team_heal", cooldown: 4,
    description: "Cura todos os aliados vivos (~INT×1.8 + 10% HP máx).",
  },
};

// Helper: pega a skill da espécie (com fallback pra role)
export function getSkill(speciesId: string): Skill {
  const sp = SPECIES[speciesId];
  if (sp?.skill) return sp.skill;
  return ROLE_SKILLS[sp?.role ?? "dps"];
}

export const SPECIES: Record<string, Species> = {
  // ===== PUROS (raros) =====
  flarepup: {
    id: "flarepup", name: "Flarepup", element: "fire", role: "dps", rarity: "rare",
    emoji: "🔥", image: flarepupImg,
    description: "Raposinha de fogo puro. DPS clássico de dano alto.",
    base: { hp: 55, atk: 15, def: 8, spd: 12, int: 7 },
    skill: { name: "Fogareu", emoji: "🔥", kind: "burn_dot", cooldown: 3, description: "Queima o alvo: dano agora + dano por 3 turnos." },
  },
  aquakitty: {
    id: "aquakitty", name: "Aquakitty", element: "water", role: "healer", rarity: "rare",
    emoji: "💧", image: aquakittyImg,
    description: "Gatinho aquático puro. Cura o time a cada 2 turnos.",
    base: { hp: 60, atk: 9, def: 11, spd: 13, int: 20 },
    skill: { name: "Bolha Curativa", emoji: "🫧", kind: "shield_ally", cooldown: 3, description: "Envolve o aliado mais ferido com escudo (INT×1.5) e +30% DEF por 2 turnos." },
  },
  leafox: {
    id: "leafox", name: "Leafox", element: "grass", role: "tank", rarity: "rare",
    emoji: "🌿", image: leafoxImg,
    description: "Raposa-folha pura. Tank: provoca e absorve dano.",
    base: { hp: 80, atk: 8, def: 18, spd: 8, int: 8 },
    skill: { name: "Casca de Carvalho", emoji: "🌳", kind: "shield_taunt", cooldown: 3, description: "Provoca todos por 2 turnos e ganha escudo de 25% do HP máx (cd curto)." },
  },
  voltbun: {
    id: "voltbun", name: "Voltbun", element: "electric", role: "assassin", rarity: "rare",
    emoji: "⚡", image: voltbunImg,
    description: "Coelhinho elétrico puro. Assassino veloz com muito crit.",
    base: { hp: 48, atk: 13, def: 8, spd: 18, int: 6 },
    skill: { name: "Tempo Acelerado", emoji: "⚡", kind: "double_strike", cooldown: 3, description: "Ataca 2× o alvo de maior ATK inimigo (1.2× cada golpe)." },
  },
  shadepup: {
    id: "shadepup", name: "Shadepup", element: "shadow", role: "mage", rarity: "rare",
    emoji: "🌙", image: shadepupImg,
    description: "Lobinho das sombras puro. Mago: dano ignora defesa.",
    base: { hp: 55, atk: 16, def: 9, spd: 12, int: 22 },
    skill: { name: "Uivo Silenciador", emoji: "🌑", kind: "silence_disable", cooldown: 4, description: "Dano mágico no alvo e silencia (anula a próxima skill dele)." },
  },
  rato_bomba: {
    id: "rato_bomba", name: "Rato Bomba", element: "fire", role: "dps", rarity: "rare",
    emoji: "💣", image: ratoBombaImg,
    description: "Ratinho kamikaze de pavio curto. Frágil, mas quando cai, explode em chamas — e leva o inimigo mais ferido junto.",
    base: { hp: 40, atk: 16, def: 7, spd: 17, int: 8 },
    skill: { name: "Pavio Aceso", emoji: "💣", kind: "heavy_strike", cooldown: 3, description: "Investida explosiva: 2.1× dano num alvo. PASSIVA: ao ser derrotado, EXPLODE e mata o inimigo com menos HP." },
  },


  // ===== MESTIÇOS (comuns) =====
  steamcub: {
    id: "steamcub", name: "Steamcub", element: "fire", secondaryElement: "water", role: "tank", rarity: "common",
    emoji: "♨️", image: steamcubImg,
    description: "Ursinho de vapor. Tank meio fogo, meio água.",
    base: { hp: 70, atk: 9, def: 14, spd: 9, int: 8 },
    skill: { name: "Cortina de Vapor", emoji: "♨️", kind: "shield_taunt", cooldown: 4, description: "Solta vapor: provoca todos por 2 turnos e ganha 28% HP de escudo." },
  },
  emberleaf: {
    id: "emberleaf", name: "Emberleaf", element: "fire", secondaryElement: "grass", role: "dps", rarity: "common",
    emoji: "🍂", image: emberleafImg,
    description: "Raposa de folhas em brasa. DPS de outono.",
    base: { hp: 52, atk: 13, def: 9, spd: 12, int: 7 },
    skill: { name: "Tornado de Brasas", emoji: "🍂", kind: "heavy_strike", cooldown: 3, description: "Investida em redemoinho: 2.1× de dano num alvo." },
  },
  sparkpup: {
    id: "sparkpup", name: "Sparkpup", element: "fire", secondaryElement: "electric", role: "assassin", rarity: "common",
    emoji: "⚡🔥", image: sparkpupImg,
    description: "Filhote chamuscado e elétrico. Assassino rápido.",
    base: { hp: 46, atk: 12, def: 8, spd: 16, int: 6 },
    skill: { name: "Estouro Elétrico", emoji: "💥", kind: "guaranteed_crit", cooldown: 3, description: "Crítico garantido no inimigo mais fraco, ignora 60% da DEF." },
  },
  cinderwisp: {
    id: "cinderwisp", name: "Cinderwisp", element: "fire", secondaryElement: "shadow", role: "mage", rarity: "common",
    emoji: "👻🔥", image: cinderwispImg,
    description: "Fantasminha de brasa. Mago ofensivo.",
    base: { hp: 50, atk: 14, def: 9, spd: 11, int: 22 },
    skill: { name: "Chuva de Cinzas", emoji: "🔥", kind: "aoe_magic", cooldown: 4, description: "Cobre o campo com cinzas mágicas: dano em todos inimigos (1.15× cada)." },
  },
  mossfin: {
    id: "mossfin", name: "Mossfin", element: "water", secondaryElement: "grass", role: "healer", rarity: "common",
    emoji: "🐸", image: mossfinImg,
    description: "Sapinho do brejo. Healer rústico.",
    base: { hp: 58, atk: 8, def: 12, spd: 10, int: 20 },
    skill: { name: "Orvalho do Brejo", emoji: "🌧️", kind: "team_heal", cooldown: 4, description: "Cura todos os aliados (~INT×1.7 + 10% HP máx)." },
  },
  stormtad: {
    id: "stormtad", name: "Stormtad", element: "water", secondaryElement: "electric", role: "mage", rarity: "common",
    emoji: "⚡💧", image: stormtadImg,
    description: "Girino-relâmpago. Mago elétrico.",
    base: { hp: 48, atk: 13, def: 8, spd: 14, int: 22 },
    skill: { name: "Tempestade Elétrica", emoji: "⚡", kind: "aoe_magic", cooldown: 4, description: "Solta raios em todos os inimigos (1.15× cada, ignora defesa)." },
  },
  tidewraith: {
    id: "tidewraith", name: "Tidewraith", element: "water", secondaryElement: "shadow", role: "assassin", rarity: "common",
    emoji: "🌊👻", image: tidewraithImg,
    description: "Fantasma das marés. Assassino furtivo.",
    base: { hp: 44, atk: 12, def: 8, spd: 16, int: 6 },
    skill: { name: "Bote da Maré", emoji: "🌊", kind: "guaranteed_crit", cooldown: 3, description: "Crítico garantido no inimigo mais fraco, ignora 60% da DEF." },
  },
  voltsprout: {
    id: "voltsprout", name: "Voltsprout", element: "grass", secondaryElement: "electric", role: "healer", rarity: "common",
    emoji: "🌱⚡", image: voltsproutImg,
    description: "Broto voltaico. Healer com punch.",
    base: { hp: 54, atk: 9, def: 11, spd: 12, int: 20 },
    skill: { name: "Seiva Restauradora", emoji: "🌱", kind: "team_heal", cooldown: 4, description: "Espalha seiva pelo time, curando todos os aliados (~INT×1.7 + 10% HP máx)." },
  },
  nightbloom: {
    id: "nightbloom", name: "Nightbloom", element: "grass", secondaryElement: "shadow", role: "mage", rarity: "common",
    emoji: "🌸🌙", image: nightbloomImg,
    description: "Flor noturna. Mago de controle.",
    base: { hp: 52, atk: 13, def: 10, spd: 10, int: 22 },
    skill: { name: "Pólen Tóxico", emoji: "🌸", kind: "aoe_magic", cooldown: 4, description: "Nuvem tóxica em todos os inimigos (1.15× cada, ignora defesa)." },
  },
  voidspark: {
    id: "voidspark", name: "Voidspark", element: "electric", secondaryElement: "shadow", role: "assassin", rarity: "common",
    emoji: "🌑⚡", image: voidsparkImg,
    description: "Orbe de raios sombrios. Assassino caótico.",
    base: { hp: 44, atk: 13, def: 7, spd: 17, int: 6 },
    skill: { name: "Choque Sombrio", emoji: "🌑", kind: "guaranteed_crit", cooldown: 3, description: "Salta nas sombras: crítico garantido no mais fraco, ignora 60% da DEF." },
  },

  // ===== TERRA =====
  rockpup: {
    id: "rockpup", name: "Rockpup", element: "earth", role: "tank", rarity: "rare",
    emoji: "🪨", image: rockpupImg,
    description: "Cãozinho de pedregulho puro. Tank rochoso com defesa absurda.",
    base: { hp: 85, atk: 9, def: 20, spd: 7, int: 8 },
    skill: { name: "Muralha de Pedra", emoji: "🪨", kind: "shield_taunt", cooldown: 3, description: "Vira uma muralha: provoca todos por 2 turnos e ganha 35% HP de escudo." },
  },
  magmaboulder: {
    id: "magmaboulder", name: "Magmaboulder", element: "earth", secondaryElement: "fire", role: "tank", rarity: "common",
    emoji: "🌋", image: magmaboulderImg,
    description: "Rocha vulcânica. Tank que queima quem encosta.",
    base: { hp: 75, atk: 11, def: 16, spd: 7, int: 8 },
    skill: { name: "Crosta Vulcânica", emoji: "🌋", kind: "shield_taunt", cooldown: 3, description: "Endurece a casca de magma: provoca todos por 2 turnos e ganha 30% HP de escudo." },
  },
  mudpaw: {
    id: "mudpaw", name: "Mudpaw", element: "earth", secondaryElement: "water", role: "dps", rarity: "common",
    emoji: "🟫", image: mudpawImg,
    description: "Golem de lama. DPS pesado que afunda os inimigos.",
    base: { hp: 60, atk: 14, def: 12, spd: 8, int: 7 },
    skill: { name: "Soco de Lama", emoji: "👊", kind: "heavy_strike", cooldown: 3, description: "Soco pesadão num alvo: 2.3× dano." },
  },
  crystalsprite: {
    id: "crystalsprite", name: "Crystalsprite", element: "earth", secondaryElement: "electric", role: "mage", rarity: "common",
    emoji: "💎", image: crystalspriteImg,
    description: "Geodo mágico cristalino. Mago de cristal com raios.",
    base: { hp: 52, atk: 12, def: 11, spd: 10, int: 21 },
    skill: { name: "Estilhaços Mágicos", emoji: "💎", kind: "aoe_magic", cooldown: 4, description: "Explode cristais em todos os inimigos (1.15× cada, ignora defesa)." },
  },

  // ===== EVENTO (lendários) =====
  onca_sombria: {
    id: "onca_sombria", name: "Onça Sombria", element: "shadow", role: "assassin", rarity: "legendary",
    emoji: "🐆", image: oncaSombriaImg,
    description: "Onça-pintada das sombras. Crítico letal nos mais fracos.",
    base: { hp: 62, atk: 17, def: 10, spd: 16, int: 10 },
    skill: { name: "Bote Mortal", emoji: "🐆", kind: "execute", cooldown: 3, description: "Execução: alvos com menos de 30% HP recebem dano TRIPLO. Senão, 1.8× dano normal." },
  },
  leao_dourado: {
    id: "leao_dourado", name: "Leão Dourado", element: "earth", role: "dps", rarity: "legendary",
    emoji: "🦁", image: leaoDouradoImg,
    description: "Rei dourado. Dano consistente avassalador.",
    base: { hp: 68, atk: 18, def: 13, spd: 11, int: 9 },
    skill: { name: "Rugido Real", emoji: "🦁", kind: "lifesteal_strike", cooldown: 3, description: "Golpe régio (2× dano) que cura o leão em 50% do dano causado." },
  },
  tigre_infernal: {
    id: "tigre_infernal", name: "Tigre Infernal", element: "fire", role: "dps", rarity: "legendary",
    emoji: "🔥", image: tigreInfernalImg,
    description: "Tigre de chamas eternas. Investida devastadora em fogo.",
    base: { hp: 64, atk: 19, def: 10, spd: 14, int: 10 },
    skill: { name: "Fúria das Chamas", emoji: "🔥", kind: "berserker_rage", cooldown: 5, description: "Entra em fúria: +60% ATK por 3 turnos (perde 25% DEF nesse período)." },
  },
  pantera_negra: {
    id: "pantera_negra", name: "Pantera Negra", element: "shadow", role: "assassin", rarity: "legendary",
    emoji: "🐈‍⬛", image: panteraNegraImg,
    description: "Olhos vermelhos no escuro. Mortal e ágil.",
    base: { hp: 60, atk: 18, def: 10, spd: 17, int: 11 },
    skill: { name: "Garra Fantasma", emoji: "👻", kind: "execute", cooldown: 3, description: "Execução fantasma: alvos com menos de 35% HP morrem instantâneo. Senão, 1.7× dano." },
  },
  pantera_aurea: {
    id: "pantera_aurea", name: "Pantera Áurea", element: "shadow", role: "mage", rarity: "legendary",
    emoji: "✨", image: panteraAureaImg,
    description: "Olhos dourados — variante ultra-rara da Pantera Negra. Mago sombrio supremo.",
    base: { hp: 65, atk: 14, def: 12, spd: 15, int: 24 },
    skill: { name: "Raio Áureo", emoji: "👁️", kind: "chain_lightning", cooldown: 4, description: "Feixe dourado salta entre até 3 inimigos (100% → 60% → 35% do dano mágico)." },
  },

  // ===== SUPER RAROS =====
  macaco_prego: {
    id: "macaco_prego", name: "Macaco-Prego", element: "grass", role: "assassin", rarity: "super_rare",
    emoji: "🐒", image: macacoPregoImg,
    description: "Macaquinho astuto da floresta. Rouba turnos com agilidade e crítico afiado.",
    base: { hp: 50, atk: 14, def: 9, spd: 18, int: 9 },
    skill: { name: "Pancada Dupla", emoji: "🐒", kind: "double_strike", cooldown: 3, description: "Bate 2× no alvo de maior ATK (1.3× cada golpe) — desarma adversários." },
  },
  tubarao_abissal: {
    id: "tubarao_abissal", name: "Tubarão Abissal", element: "water", role: "dps", rarity: "super_rare",
    emoji: "🦈", image: tubaraoAbissalImg,
    description: "Predador das profundezas azuis. Mordida feroz que rasga qualquer presa.",
    base: { hp: 60, atk: 17, def: 11, spd: 13, int: 8 },
    skill: { name: "Mordida Sanguinária", emoji: "🦈", kind: "lifesteal_strike", cooldown: 3, description: "Crava os dentes (2× dano) e cura o tubarão em 55% do dano causado." },
  },
  polvo_venenoso: {
    id: "polvo_venenoso", name: "Polvo Venenoso", element: "water", secondaryElement: "shadow", role: "mage", rarity: "super_rare",
    emoji: "🐙", image: polvoVenenosoImg,
    description: "Polvo místico das fossas tóxicas. Mago de veneno: corrói os inimigos turno após turno.",
    base: { hp: 58, atk: 13, def: 11, spd: 12, int: 24 },
    skill: { name: "Tinta Venenosa", emoji: "☠️", kind: "burn_dot", cooldown: 3, description: "Cospe tinta venenosa: dano mágico agora + veneno corrosivo por 3 turnos (INT×0.65 cada turno)." },
  },
  cobra_sangrenta: {
    id: "cobra_sangrenta", name: "Cobra Sangrenta", element: "shadow", secondaryElement: "grass", role: "dps", rarity: "super_rare",
    emoji: "🐍", image: cobraSangrentaImg,
    description: "Víbora ancestral de presas afiadas. Sua mordida provoca hemorragia turno após turno.",
    base: { hp: 50, atk: 15, def: 9, spd: 13, int: 8 },
    skill: { name: "Presa Dilacerante", emoji: "🩸", kind: "bleed_dot", cooldown: 3, description: "Crava as presas no alvo: dano físico agora + sangramento (ATK×0.35) por 3 turnos." },
  },
  borboleta_sonifera: {
    id: "borboleta_sonifera", name: "Borboleta Sonífera", element: "shadow", secondaryElement: "grass", role: "mage", rarity: "super_rare",
    emoji: "🦋💤", image: borboletaSoniferaImg,
    description: "Borboleta onírica de asas hipnóticas. Espalha pó do sono que faz qualquer inimigo cair em sono profundo no meio da batalha.",
    base: { hp: 58, atk: 15, def: 12, spd: 20, int: 20 },
    skill: { name: "Pó do Sono", emoji: "💤", kind: "sleep_strike", cooldown: 4, description: "PASSIVA: ataque básico tem 50% de chance de adormecer o alvo por 2 turnos. ATIVA: dano mágico no alvo com 80% de chance de adormecê-lo por 2 turnos." },
  },
  urso_polar: {
    id: "urso_polar", name: "Urso Polar", element: "water", role: "tank", rarity: "super_rare",
    emoji: "🐻‍❄️❄️", image: ursoPolarImg,
    description: "Urso ártico de pelagem nevada. Cada pata congelada paralisa o inimigo no meio do golpe.",
    base: { hp: 71, atk: 25, def: 12, spd: 13, int: 10 },
    skill: { name: "Toque Glacial", emoji: "❄️", kind: "freeze_strike", cooldown: 4, description: "PASSIVA: ataque básico tem 50% de chance de congelar o alvo por 2 turnos. ATIVA: golpe gélido + 80% de chance de congelar o alvo por 2 turnos." },
  },


  // ===== ÉPICOS =====
  jacare_ancestral: {
    id: "jacare_ancestral", name: "Jacaré Ancestral", element: "water", secondaryElement: "earth", role: "dps", rarity: "epic",
    emoji: "🐊", image: jacareAncestralImg,
    description: "Predador ancestral dos rios esmeralda. Mordida devastadora que ignora defesa leve.",
    base: { hp: 56, atk: 15, def: 10, spd: 11, int: 8 },
    skill: { name: "Mordida Esmeralda", emoji: "🐊", kind: "lifesteal_strike", cooldown: 3, description: "Crava as mandíbulas (2.1× dano) e cura 60% do dano causado." },
  },
  gorila_titan: {
    id: "gorila_titan", name: "Gorila Titã", element: "earth", role: "tank", rarity: "epic",
    emoji: "🦍", image: gorilaTitanImg,
    description: "Titã das montanhas com cristais místicos. Tank brutal que provoca e contra-ataca.",
    base: { hp: 64, atk: 13, def: 14, spd: 8, int: 9 },
    skill: { name: "Fúria Titânica", emoji: "🦍", kind: "berserker_rage", cooldown: 5, description: "Bate no peito: +70% ATK por 3 turnos (perde 30% DEF). Pra trocar dano." },
  },
  aguia_cega: {
    id: "aguia_cega", name: "Águia Ofuscante", element: "earth", secondaryElement: "electric", role: "assassin", rarity: "epic",
    emoji: "🦅", image: aguiaCegaImg,
    description: "Águia marrom ancestral das montanhas. Ágil e implacável: mergulha em alta velocidade e cega os inimigos com um clarão dourado.",
    base: { hp: 55, atk: 18, def: 9, spd: 22, int: 10 },
    skill: { name: "Visão Ofuscante", emoji: "😵‍💫", kind: "blind_debuff", cooldown: 4, description: "Mergulha solta um clarão dourado: dano agora + cega TODOS os inimigos por 3 turnos (50% de chance de errar ataques básicos)." },
  },
  lobo_lua_sangrenta: {
    id: "lobo_lua_sangrenta", name: "Lobo da Lua Sangrenta", element: "shadow", secondaryElement: "fire", role: "assassin", rarity: "epic",
    emoji: "🐺", image: loboLuaSangrentaImg,
    description: "Predador noturno banhado pela lua escarlate. Cada mordida drena a essência vital do inimigo.",
    base: { hp: 75, atk: 25, def: 15, spd: 22, int: 15 },
    skill: { name: "Mordida da Lua Sangrenta", emoji: "🩸", kind: "lifesteal_strike", cooldown: 3, description: "PASSIVA: todo ataque básico cura o lobo em 40% do dano causado. ATIVA: mordida brutal (2× dano) que cura 50% do dano causado." },
  },


  // ===== MÍTICOS =====
  dragao_branco: {
    id: "dragao_branco", name: "Dragão Branco", element: "water", role: "healer", rarity: "mythic",
    emoji: "🐉", image: dragaoBrancoImg,
    description: "Dragão místico de escamas brancas e olhos de safira. Cura divina que ressoa pelo time.",
    base: { hp: 80, atk: 16, def: 16, spd: 14, int: 26 },
    skill: { name: "Sopro da Vida", emoji: "🐉", kind: "revive_ally", cooldown: 6, description: "Ressuscita o aliado caído mais recente com 40% do HP máx. Se ninguém caiu, cura todos." },
  },
  dragao_negro: {
    id: "dragao_negro", name: "Dragão Negro", element: "shadow", role: "dps", rarity: "mythic",
    emoji: "🐲", image: dragaoNegroImg,
    description: "Dragão obsidiana de olhos vermelhos. Dano apocalíptico que devasta inimigos.",
    base: { hp: 75, atk: 24, def: 14, spd: 15, int: 14 },
    skill: { name: "Apocalipse Obsidiana", emoji: "🐲", kind: "true_damage_nuke", cooldown: 5, description: "Sopro apocalíptico: dano VERDADEIRO num alvo (~ATK×3, ignora 100% DEF e elemento)." },
  },
  fenix_vermelha: {
    id: "fenix_vermelha", name: "Fênix Vermelha", element: "fire", role: "dps", rarity: "mythic",
    emoji: "🔥🦅", image: fenixVermelhaImg,
    description: "Fênix carmesim envolta em chamas eternas. Quanto mais sofre, mais perigosa fica.",
    base: { hp: 75, atk: 24, def: 14.29, spd: 15, int: 14 },
    skill: { name: "Brasa Renascida", emoji: "🔥", kind: "phoenix_rage", cooldown: 4, description: "PASSIVA: cada 10% de HP perdido = +6% ATK (até +60% com 1 HP). ATIVA: golpe de fogo (2× dano)." },
  },
  fenix_negra: {
    id: "fenix_negra", name: "Fênix Negra", element: "shadow", role: "dps", rarity: "mythic",
    emoji: "🌑🦅", image: fenixNegraImg,
    description: "Fênix obsidiana de chamas violetas. Devora a essência dos inimigos e cresce sem fim.",
    base: { hp: 78, atk: 25.72, def: 13.14, spd: 14, int: 14 },
    skill: { name: "Comunhão Sombria", emoji: "🌑", kind: "phoenix_growth", cooldown: 4, description: "PASSIVA: cada dano causado vira +4% HP máx e cura na batalha (cap +50%). ATIVA: golpe sombrio (2× dano)." },
  },
  fenix_azul: {
    id: "fenix_azul", name: "Fênix Azul", element: "water", secondaryElement: "fire", role: "healer", rarity: "common",
    emoji: "🔵🦅", image: fenixAzulImg,
    description: "Filhote de fênix de plumas azuis e chamas geladas. Cura aliados com brasas frias.",
    base: { hp: 52, atk: 8, def: 11, spd: 11, int: 20 },
    skill: { name: "Chama Gelada", emoji: "❄️", kind: "heal_lowest", cooldown: 3, description: "Cura o aliado mais ferido (~INT×1.2)." },
  },
  dragao_fogo: {
    id: "dragao_fogo", name: "Dragão de Fogo", element: "fire", secondaryElement: "shadow", role: "mage", rarity: "common",
    emoji: "🐲", image: dragaoFogoImg,
    description: "Filhote de dragão de escamas em brasa. Cospe cinzas que corroem a armadura dos inimigos.",
    base: { hp: 50, atk: 9, def: 10, spd: 11, int: 20 },
    skill: { name: "Baforada de Cinzas", emoji: "🌋", kind: "ash_breath", cooldown: 3, description: "Dano mágico (~INT×1.5) e reduz a DEF do alvo em 20% por 2 turnos." },
  },
};

export const ELEMENT_COLORS: Record<Element, string> = {
  fire: "from-red-400 to-orange-500",
  water: "from-cyan-400 to-blue-500",
  grass: "from-emerald-400 to-green-600",
  electric: "from-yellow-300 to-amber-500",
  shadow: "from-purple-500 to-fuchsia-700",
  earth: "from-amber-700 to-stone-600",
};

export const ELEMENT_NAMES: Record<Element, string> = {
  fire: "Fogo",
  water: "Água",
  grass: "Planta",
  electric: "Elétrico",
  shadow: "Sombra",
  earth: "Terra",
};

// Type effectiveness (multiplier on damage)
export const TYPE_CHART: Record<Element, Partial<Record<Element, number>>> = {
  fire: { grass: 1.5, water: 0.7, fire: 0.8, earth: 0.7 },
  water: { fire: 1.5, grass: 0.7, water: 0.8, earth: 1.5 },
  grass: { water: 1.5, fire: 0.7, grass: 0.8, earth: 1.5 },
  electric: { water: 1.5, grass: 0.7, electric: 0.8, earth: 0.5 },
  shadow: { shadow: 0.8 },
  earth: { fire: 1.5, electric: 1.5, grass: 0.7, water: 0.7, earth: 0.8 },
};

// ===== Items =====
export type Item = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  priceCoins?: number;
  priceGems?: number;
  effect: { hunger?: number; energy?: number; happiness?: number; xp?: number; hp?: number };
};

export const ITEMS: Record<string, Item> = {
  ration: { id: "ration", name: "Ração", emoji: "🍖", description: "+20 fome", priceCoins: 15, effect: { hunger: 20 } },
  candy: { id: "candy", name: "Doce", emoji: "🍬", description: "+25 felicidade", priceCoins: 12, effect: { happiness: 25 } },
  energy_drink: { id: "energy_drink", name: "Energético", emoji: "⚡", description: "+8 energia (regen grátis 1/h)", priceGems: 2, effect: { energy: 8 } },
  premium_meal: { id: "premium_meal", name: "Banquete Real", emoji: "🍱", description: "+100 fome, +50 felicidade", priceGems: 3, effect: { hunger: 100, happiness: 50 } },
  revive: { id: "revive", name: "Revive", emoji: "💖", description: "Cura 100% do HP instantâneo", priceGems: 5, effect: { hp: 9999 } },
};

// ===== Eggs (gacha) =====
export type Egg = {
  id: string;
  name: string;
  emoji: string;
  priceCoins?: number;
  priceGems?: number;
  description: string;
  weights: Record<string, number>;
  pack?: number; // quantos pets vêm
  event?: boolean; // ovo de evento — visível mas não comprável fora do evento
};

// Helpers to build weight tables
const ALL_COMMON = Object.values(SPECIES).filter((s) => s.rarity === "common").map((s) => s.id);
const ALL_RARE = Object.values(SPECIES).filter((s) => s.rarity === "rare").map((s) => s.id);

function makeWeights(commonW: number, rareW: number): Record<string, number> {
  const w: Record<string, number> = {};
  ALL_COMMON.forEach((id) => (w[id] = commonW));
  ALL_RARE.forEach((id) => (w[id] = rareW));
  return w;
}

// Pesos balanceados pra 10% raro / 90% comum no ovo raro
// (multiplicamos pelo contador da outra raridade pra normalizar)
const RARE_EGG_WEIGHTS: Record<string, number> = (() => {
  const w: Record<string, number> = {};
  const nC = ALL_COMMON.length || 1;
  const nR = ALL_RARE.length || 1;
  ALL_COMMON.forEach((id) => (w[id] = 9 * nR));
  ALL_RARE.forEach((id) => (w[id] = 1 * nC));
  return w;
})();

export const EGGS: Record<string, Egg> = {
  basic: {
    id: "basic", name: "Ovo Comum", emoji: "🥚", priceCoins: 1000,
    description: "Sorteia apenas monstros mestiços (comuns).",
    weights: makeWeights(1, 0),
  },
  basic_10: {
    id: "basic_10", name: "Pack 10x Ovo Comum", emoji: "🥚", priceCoins: 9000,
    description: "10 ovos comuns de uma vez. Só pets comuns.",
    weights: makeWeights(1, 0),
    pack: 10,
  },
  rare: {
    id: "rare", name: "Ovo Raro", emoji: "🪺", priceGems: 25,
    description: "10% de chance de vir um pet raro. Resto vem comum.",
    weights: RARE_EGG_WEIGHTS,
  },
  rare_10: {
    id: "rare_10", name: "Pack 10x Ovo Raro", emoji: "🪺", priceGems: 200,
    description: "10 ovos raros. 10% por ovo de vir um raro.",
    weights: RARE_EGG_WEIGHTS,
    pack: 10,
  },
  event_felinos: {
    id: "event_felinos", name: "Ovo de Evento — Felinos Lendários", emoji: "🥚✨", priceGems: 80,
    description: "Evento limitado: Onça Sombria, Leão Dourado, Tigre Infernal, Pantera Negra (rara) e Pantera Áurea (ULTRA rara).",
    event: true,
    weights: {
      onca_sombria: 30,
      leao_dourado: 30,
      tigre_infernal: 30,
      pantera_negra: 9,
      pantera_aurea: 1,
    },
  },
};

// ===== Skins =====
export type Skin = {
  id: string;
  name: string;
  description: string;
  priceGems: number;
  hueRotate: number;
  saturate?: number;
  vipOnly?: boolean;
};

export const SKINS: Record<string, Skin> = {
  default: { id: "default", name: "Padrão", description: "Visual original", priceGems: 0, hueRotate: 0 },
  golden: { id: "golden", name: "Dourado", description: "Brilho dourado luxuoso", priceGems: 15, hueRotate: -30, saturate: 1.4 },
  arctic: { id: "arctic", name: "Ártico", description: "Tons gelados", priceGems: 15, hueRotate: 180 },
  toxic: { id: "toxic", name: "Tóxico", description: "Verde radioativo", priceGems: 20, hueRotate: 90, saturate: 1.6 },
  rainbow: { id: "rainbow", name: "Arco-íris VIP", description: "Skin exclusiva VIP", priceGems: 0, hueRotate: 45, saturate: 1.8, vipOnly: true },
};

// ===== VIP / Gem packs =====
export const VIP_PRICE_GEMS = 50;
export const VIP_DURATION_DAYS = 30;

export const GEM_PACKS = [
  { id: "starter", gems: 30, priceBRL: 9.90, bonus: 0 },
  { id: "pro", gems: 100, priceBRL: 24.90, bonus: 20 },
  { id: "epic", gems: 300, priceBRL: 59.90, bonus: 100 },
  { id: "legend", gems: 800, priceBRL: 119.90, bonus: 300 },
];

// ===== Baús (loja) =====
export type ChestTier = "wood" | "silver" | "gold" | "legendary";

export type Chest = {
  id: ChestTier;
  name: string;
  emoji: string;
  description: string;
  priceCoins?: number;
  priceGems?: number;
  // recompensas garantidas: faixa min-max
  coins: [number, number];
  rations: [number, number];
  // gemas (com chance de não vir nada se gemChance < 1)
  gemChance: number;
  gems: [number, number];
  // pet (chance total de cair) e tabela de raridade quando cair
  petChance: number;
  petRarityWeights: Partial<Record<Rarity, number>>;
};

export const CHESTS: Record<ChestTier, Chest> = {
  wood: {
    id: "wood", name: "Baú de Madeira", emoji: "📦",
    description: "Recompensa básica pra começar a aventura.",
    priceCoins: 1000,
    coins: [200, 500],
    rations: [1, 3],
    gemChance: 0.10, gems: [1, 3],
    petChance: 1,
    petRarityWeights: { common: 100 },
  },
  silver: {
    id: "silver", name: "Baú de Prata", emoji: "🥈",
    description: "Bom equilíbrio de recursos. Chance de pet raro.",
    priceGems: 30,
    priceCoins: 5000,
    coins: [500, 1500],
    rations: [3, 6],
    gemChance: 1, gems: [3, 5],
    petChance: 1,
    petRarityWeights: { common: 80, rare: 20 },
  },
  gold: {
    id: "gold", name: "Baú de Ouro", emoji: "🥇",
    description: "Pets fortes garantidos: raros, super raros e épicos.",
    priceGems: 100,
    priceCoins: 20000,
    coins: [1500, 4000],
    rations: [6, 12],
    gemChance: 1, gems: [5, 10],
    petChance: 1,
    petRarityWeights: { rare: 55, super_rare: 35, epic: 10 },
  },

  legendary: {
    id: "legendary", name: "Baú Lendário", emoji: "👑",
    description: "Recompensa suprema: épicos, lendários e até míticos!",
    priceGems: 300,
    priceCoins: 100000,
    coins: [4000, 10000],
    rations: [12, 24],
    gemChance: 1, gems: [50, 100],
    petChance: 1,
    petRarityWeights: { epic: 30, legendary: 55, mythic: 15 },
  },


};

export type ChestReward = {
  coins: number;
  gems: number;
  rations: number;
  petSpecies?: string; // id da espécie sorteada (se caiu pet)
};

export function rollChest(tier: ChestTier): ChestReward {
  const c = CHESTS[tier];
  const rng = (range: [number, number]) =>
    Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];

  const coins = rng(c.coins);
  const rations = rng(c.rations);
  const gems = Math.random() < c.gemChance ? rng(c.gems) : 0;

  let petSpecies: string | undefined;
  if (Math.random() < c.petChance) {
    // 1) sorteia a raridade
    const totalW = Object.values(c.petRarityWeights).reduce((a, b) => a + (b ?? 0), 0);
    let r = Math.random() * totalW;
    let chosenRarity: Rarity = "common";
    for (const [rarity, weight] of Object.entries(c.petRarityWeights)) {
      r -= weight ?? 0;
      if (r <= 0) { chosenRarity = rarity as Rarity; break; }
    }
    // 2) sorteia uma espécie daquela raridade
    const pool = Object.values(SPECIES).filter((s) => s.rarity === chosenRarity);
    if (pool.length > 0) {
      petSpecies = pool[Math.floor(Math.random() * pool.length)].id;
    }
  }

  return { coins, gems, rations, petSpecies };
}

// Baú de boas-vindas: 2 comuns aleatórios + 1 raro aleatório
export function rollWelcomeChest(): string[] {
  const all = Object.values(SPECIES);
  const commons = all.filter((s) => s.rarity === "common");
  const rares = all.filter((s) => s.rarity === "rare");
  const pickN = <T,>(arr: T[], n: number): T[] => {
    const pool = [...arr];
    const out: T[] = [];
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      out.push(pool.splice(idx, 1)[0]);
    }
    return out;
  };
  return [...pickN(commons, 2), ...pickN(rares, 1)].map((s) => s.id);
}

// === Recompensas por level-up da CONTA ===
// A cada level: 1 Baú de Madeira. A cada múltiplo de 10: Baú de Prata.
// No level 50: Baú de Ouro. No level 100: Baú Lendário.
export type LevelUpReward = {
  coins: number;
  gems: number;
  rations: number;
  petSpecies: string[];
  woodChests: number;
  silverChests: number;
  goldChests: number;
  legendaryChests: number;
  levels: number[]; // levels alcançados
  chests: Array<{ tier: ChestTier; level: number; reward: ChestReward }>;
};

export function chestTierForLevel(lv: number): ChestTier {
  if (lv === 100) return "legendary";
  if (lv === 50) return "gold";
  if (lv % 10 === 0) return "silver";
  return "wood";
}

export function rollLevelUpRewards(prevLevel: number, newLevel: number): LevelUpReward {
  const out: LevelUpReward = { coins: 0, gems: 0, rations: 0, petSpecies: [], woodChests: 0, silverChests: 0, goldChests: 0, legendaryChests: 0, levels: [], chests: [] };
  for (let lv = prevLevel + 1; lv <= newLevel; lv++) {
    out.levels.push(lv);
    const tier = chestTierForLevel(lv);
    if (tier === "legendary") out.legendaryChests += 1;
    else if (tier === "gold") out.goldChests += 1;
    else if (tier === "silver") out.silverChests += 1;
    else out.woodChests += 1;
    const r = rollChest(tier);
    out.coins += r.coins;
    out.gems += r.gems;
    out.rations += r.rations;
    if (r.petSpecies) out.petSpecies.push(r.petSpecies);
    out.chests.push({ tier, level: lv, reward: r });
    if (lv % 3 === 0 && tier === "wood") {
      out.silverChests += 1;
      const rs = rollChest("silver");
      out.coins += rs.coins;
      out.gems += rs.gems;
      out.rations += rs.rations;
      if (rs.petSpecies) out.petSpecies.push(rs.petSpecies);
      out.chests.push({ tier: "silver", level: lv, reward: rs });
    }
  }
  return out;
}

// XP da CONTA (profile) — pets não têm mais XP/level próprio.
export function xpForNextLevel(level: number): number {
  return Math.floor(50 * Math.pow(1.4, level - 1));
}

// ===== Rank (fusion ✦1 a ✦10) =====
export const RANK_MULT: Record<number, number> = {
  1: 1.00, 2: 1.10, 3: 1.22, 4: 1.36, 5: 1.52,
  6: 1.70, 7: 1.90, 8: 2.13, 9: 2.40, 10: 2.70,
};
export const MAX_RANK = 10;

export function rankStars(rank: number): string {
  return "✦".repeat(Math.min(Math.max(rank, 1), MAX_RANK));
}

// Multiplicador global de HP base — aumenta durabilidade pra evitar one-shots
// quando bots de alto rank encontram pets squishy.
export const HP_BASE_MULT = 2.56;

export function totalStats(species: string, rank = 1, bonus = { hp: 0, atk: 0, def: 0, spd: 0, int: 0 }) {
  const s = SPECIES[species];
  if (!s) return { hp: 0, atk: 0, def: 0, spd: 0, int: 0 };
  const r = RANK_MULT[Math.min(Math.max(rank, 1), MAX_RANK)] ?? 1;
  const exactBase = species === "borboleta_sonifera" || species === "urso_polar" || species === "lobo_lua_sangrenta";
  if (exactBase) {
    return {
      hp: Math.round(s.base.hp * r * HP_BASE_MULT) + (bonus.hp ?? 0),
      atk: Math.round(s.base.atk * r) + (bonus.atk ?? 0),
      def: Math.round(s.base.def * r) + (bonus.def ?? 0),
      spd: Math.round(s.base.spd * r) + (bonus.spd ?? 0),
      int: Math.round(s.base.int * r) + (bonus.int ?? 0),
    };
  }
  const mult = RARITY_INFO[s.rarity].statMult * r;
  return {
    hp: Math.round(s.base.hp * mult * HP_BASE_MULT) + (bonus.hp ?? 0),
    atk: Math.round(s.base.atk * mult) + (bonus.atk ?? 0),
    def: Math.round(s.base.def * mult) + (bonus.def ?? 0),
    spd: Math.round(s.base.spd * mult) + (bonus.spd ?? 0),
    int: Math.round(s.base.int * mult) + (bonus.int ?? 0),
  };
}

export function starterMonsterStats(speciesId: string) {
  const sp = SPECIES[speciesId];
  if (speciesId === "borboleta_sonifera" || speciesId === "urso_polar") {
    return { hp: 0, atk: 0, def: 0, spd: 0, int: 0 };
  }
  return {
    hp: sp?.id === "fenix_vermelha" || sp?.id === "fenix_negra" ? 0 : sp?.base.hp ?? 0,
    atk: sp?.base.atk ?? 0,
    def: sp?.base.def ?? 0,
    spd: sp?.base.spd ?? 0,
  };
}

export const TRADE_FEE_COINS = 50;
export const TRADE_FEE_GEMS = 5;
export const MAX_TRADEABLE_RANK = 7; // ✦8+ não pode ser trocado

// ===== Energia de batalha =====
export const MAX_BATTLE_ENERGY = 24;
export const BATTLE_ENERGY_REGEN_MS = 60 * 60 * 1000; // 1 energia por hora
export const ENERGY_REFILL_GEM_COST = 3; // custo pra encher 1 pet
export const ENERGY_REFILL_ALL_GEM_COST = 15; // encher o time inteiro

// ===== Fome → penalidade de combate =====
// hunger 0  → não pode batalhar
// hunger 1-24  → 65% (faminto)
// hunger 25-49 → 85% (com fome)
// hunger 50+   → 100% (saudável)
export function hungerMultiplier(hunger: number): number {
  if (hunger <= 0) return 0;
  if (hunger < 25) return 0.65;
  if (hunger < 50) return 0.85;
  return 1;
}
export function hungerStatusLabel(hunger: number): { label: string; color: string } {
  if (hunger <= 0) return { label: "Faminto (não pode batalhar)", color: "text-red-300" };
  if (hunger < 25) return { label: "Faminto (-35% stats)", color: "text-red-300" };
  if (hunger < 50) return { label: "Com fome (-15% stats)", color: "text-amber-300" };
  return { label: "Saudável", color: "text-emerald-300" };
}

export function computeBattleEnergy(stored: number | undefined | null, at: string | undefined | null): {
  energy: number;
  nextRegenAt: Date | null; // null se cheio
  nextStoredAt: string; // novo timestamp pra persistir após uso
} {
  const base = Math.min(MAX_BATTLE_ENERGY, Math.max(0, stored ?? MAX_BATTLE_ENERGY));
  const atDate = at ? new Date(at) : new Date();
  const now = Date.now();
  const elapsed = now - atDate.getTime();
  const regened = Math.max(0, Math.floor(elapsed / BATTLE_ENERGY_REGEN_MS));
  const energy = Math.min(MAX_BATTLE_ENERGY, base + regened);
  // Avança o timestamp pelos ticks consumidos
  const newAt = new Date(atDate.getTime() + regened * BATTLE_ENERGY_REGEN_MS);
  const nextRegenAt = energy >= MAX_BATTLE_ENERGY ? null : new Date(newAt.getTime() + BATTLE_ENERGY_REGEN_MS);
  return { energy, nextRegenAt, nextStoredAt: newAt.toISOString() };
}

// ===== Expedições (farm offline) =====
export type ExpeditionDuration = {
  id: string;
  label: string;
  minutes: number;
  foodCost: number;     // rações gastas ao iniciar
  baseXp: number;       // XP base (escala com nível)
  baseCoins: number;
  gemChance: number;    // 0..1 chance de cair gema
  gemAmount: [number, number]; // min,max gemas se cair
  rationChance: number; // chance de dropar ração extra
  rationAmount: [number, number];
};

export const EXPEDITION_DURATIONS: ExpeditionDuration[] = [
  { id: "short", label: "1 hora", minutes: 60, foodCost: 1, baseXp: 50, baseCoins: 25, gemChance: 0, gemAmount: [0, 0], rationChance: 0.10, rationAmount: [1, 1] },
  { id: "medium", label: "4 horas", minutes: 240, foodCost: 2, baseXp: 220, baseCoins: 110, gemChance: 0, gemAmount: [0, 0], rationChance: 0.30, rationAmount: [1, 2] },
  { id: "long", label: "8 horas", minutes: 480, foodCost: 3, baseXp: 480, baseCoins: 240, gemChance: 0, gemAmount: [0, 0], rationChance: 0.60, rationAmount: [1, 3] },
  { id: "epic", label: "24 horas", minutes: 1440, foodCost: 5, baseXp: 1500, baseCoins: 700, gemChance: 0, gemAmount: [0, 0], rationChance: 1.0, rationAmount: [2, 5] },
];

export const MAX_EXPEDITION_SLOTS = 5;
// Preço em gemas pra desbloquear o slot N (a partir do 2º)
export const EXPEDITION_SLOT_PRICES: Record<number, number> = {
  2: 25,
  3: 60,
  4: 120,
  5: 250,
};

export function computeExpeditionReward(
  duration: ExpeditionDuration,
  monsterRank: number
): { xp: number; coins: number; gems: number; rations: number } {
  const rankMult = RANK_MULT[Math.min(Math.max(monsterRank, 1), MAX_RANK)] ?? 1;
  const xp = Math.round(duration.baseXp * rankMult);
  const coins = Math.round(duration.baseCoins * rankMult);
  const rollRange = (range: [number, number]) =>
    Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
  const gems = Math.random() < duration.gemChance ? rollRange(duration.gemAmount) : 0;
  const rations = Math.random() < duration.rationChance ? rollRange(duration.rationAmount) : 0;
  return { xp, coins, gems, rations };
}

export function isVip(vipUntil: string | null): boolean {
  if (!vipUntil) return false;
  return new Date(vipUntil).getTime() > Date.now();
}

export function rollEgg(eggId: string): string {
  const egg = EGGS[eggId];
  if (!egg) return "flarepup";
  const total = Object.values(egg.weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [species, weight] of Object.entries(egg.weights)) {
    r -= weight;
    if (r <= 0) return species;
  }
  return Object.keys(egg.weights)[0];
}

export function skinFilter(skinId: string): string {
  const s = SKINS[skinId];
  if (!s || skinId === "default") return "none";
  return `hue-rotate(${s.hueRotate}deg) saturate(${s.saturate ?? 1})`;
}

// Defensive multiplier when an attack of `atkElement` hits a monster of `defSpecies`.
// Hybrids take the BEST (lowest) of both elements' multipliers.
export function defensiveMultiplier(atkElement: Element, defSpecies: string): number {
  const sp = SPECIES[defSpecies];
  if (!sp) return 1;
  const m1 = TYPE_CHART[atkElement]?.[sp.element] ?? 1;
  if (!sp.secondaryElement) return m1;
  const m2 = TYPE_CHART[atkElement]?.[sp.secondaryElement] ?? 1;
  return Math.min(m1, m2);
}

// ===== Ranked ladder =====
export type Tier = {
  name: string;
  division: string; // "I"-"V" or "" for Mestre/Grão-Mestre/Lendário
  short: string;
  color: string;   // tailwind classes (bg + text)
  iconColor: string;
  emoji: string;
};

// Each division = 100 pts. 5 divisions per tier (V→I) = 500 pts per tier.
export const DIVISION_SIZE = 100;
const LADDER: { name: string; emoji: string; color: string; iconColor: string; start: number }[] = [
  { name: "Ferro",    emoji: "⛓️", color: "bg-zinc-600 text-white",       iconColor: "text-zinc-300",   start: 0    },
  { name: "Bronze",   emoji: "🥉", color: "bg-amber-700 text-amber-50",   iconColor: "text-amber-300",  start: 500  },
  { name: "Prata",    emoji: "🥈", color: "bg-slate-400 text-slate-900",  iconColor: "text-slate-200",  start: 1000 },
  { name: "Ouro",     emoji: "🥇", color: "bg-yellow-500 text-yellow-950",iconColor: "text-yellow-200", start: 1500 },
  { name: "Platina",  emoji: "💠", color: "bg-cyan-500 text-cyan-950",    iconColor: "text-cyan-200",   start: 2000 },
  { name: "Diamante", emoji: "💎", color: "bg-sky-400 text-sky-950",      iconColor: "text-sky-100",    start: 2500 },
];
const MASTER_THRESHOLD = 3000;
const GRAND_MASTER_THRESHOLD = 4000;
const DIVISION_NAMES = ["V", "IV", "III", "II", "I"];

export function getTier(points: number, leaderboardRank?: number): Tier {
  // Lendário: top 10 globally, but only if they reached at least Grão-Mestre points
  if (leaderboardRank !== undefined && leaderboardRank <= 10 && points >= GRAND_MASTER_THRESHOLD) {
    return {
      name: "Lendário", division: "", short: "Lendário",
      color: "bg-gradient-to-r from-fuchsia-500 via-pink-500 to-orange-400 text-white",
      iconColor: "text-yellow-200", emoji: "👑",
    };
  }
  if (points >= GRAND_MASTER_THRESHOLD) {
    return {
      name: "Grão-Mestre", division: "", short: "Grão-Mestre",
      color: "bg-gradient-to-r from-red-500 to-pink-600 text-white",
      iconColor: "text-red-100", emoji: "🔥",
    };
  }
  if (points >= MASTER_THRESHOLD) {
    return {
      name: "Mestre", division: "", short: "Mestre",
      color: "bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white",
      iconColor: "text-fuchsia-100", emoji: "🏆",
    };
  }
  // Walk down LADDER to find current tier
  for (let i = LADDER.length - 1; i >= 0; i--) {
    const t = LADDER[i];
    if (points >= t.start) {
      const over = points - t.start;
      const div = Math.min(4, Math.floor(over / DIVISION_SIZE));
      const division = DIVISION_NAMES[div];
      return {
        name: t.name, division, short: `${t.name} ${division}`,
        color: t.color, iconColor: t.iconColor, emoji: t.emoji,
      };
    }
  }
  return { name: "Ferro", division: "V", short: "Ferro V", color: LADDER[0].color, iconColor: LADDER[0].iconColor, emoji: LADDER[0].emoji };
}

// Points needed to reach the NEXT division (or null at peak)
export function nextTierProgress(points: number): { next: number; current: number; pct: number } | null {
  if (points >= GRAND_MASTER_THRESHOLD) return null;
  if (points >= MASTER_THRESHOLD) return { next: GRAND_MASTER_THRESHOLD, current: MASTER_THRESHOLD, pct: ((points - MASTER_THRESHOLD) / (GRAND_MASTER_THRESHOLD - MASTER_THRESHOLD)) * 100 };
  for (let i = LADDER.length - 1; i >= 0; i--) {
    const t = LADDER[i];
    if (points >= t.start) {
      const over = points - t.start;
      const div = Math.min(4, Math.floor(over / DIVISION_SIZE));
      const divStart = t.start + div * DIVISION_SIZE;
      const divEnd = divStart + DIVISION_SIZE;
      return { current: divStart, next: divEnd, pct: ((points - divStart) / DIVISION_SIZE) * 100 };
    }
  }
  return { current: 0, next: DIVISION_SIZE, pct: 0 };
}

// Current division bounds + whether the next division is a new tier (promo would be md5)
export function divisionBounds(points: number): {
  start: number; end: number; tierIndex: number; divIndex: number; nextIsTierUp: boolean;
} | null {
  if (points >= MASTER_THRESHOLD) return null;
  for (let i = LADDER.length - 1; i >= 0; i--) {
    const t = LADDER[i];
    if (points >= t.start) {
      const over = points - t.start;
      const div = Math.min(4, Math.floor(over / DIVISION_SIZE));
      const start = t.start + div * DIVISION_SIZE;
      return { start, end: start + DIVISION_SIZE, tierIndex: i, divIndex: div, nextIsTierUp: div === 4 };
    }
  }
  return null;
}

export type PromoSeries = { wins: number; losses: number; type: "bo3" | "bo5"; targetFrom: number };

export function promoNeeded(type: "bo3" | "bo5"): number {
  return type === "bo5" ? 3 : 2;
}

// Ordem dos tiers (índice = "rank" do tier). Maior = melhor.
export const TIER_ORDER = ["Ferro", "Bronze", "Prata", "Ouro", "Platina", "Diamante", "Mestre", "Grão-Mestre", "Lendário"] as const;
export function tierRankIndex(name: string): number {
  const i = (TIER_ORDER as readonly string[]).indexOf(name);
  return i < 0 ? 0 : i;
}

// Baús ganhos ao subir para um novo TIER (não divisão)
// Recebe o nome do tier alcançado (ex: "Bronze", "Prata", ...)
export function tierPromotionChests(newTierName: string): { silver: number; gold: number; legendary: number } {
  switch (newTierName) {
    case "Bronze":     return { silver: 1, gold: 0, legendary: 0 };
    case "Prata":      return { silver: 2, gold: 0, legendary: 0 };
    case "Ouro":       return { silver: 3, gold: 0, legendary: 0 };
    case "Platina":    return { silver: 0, gold: 1, legendary: 0 };
    case "Diamante":   return { silver: 1, gold: 1, legendary: 0 };
    case "Mestre":     return { silver: 0, gold: 2, legendary: 0 };
    case "Grão-Mestre":return { silver: 0, gold: 0, legendary: 1 };
    default:           return { silver: 0, gold: 0, legendary: 0 };
  }
}



export const ARENA_WIN_POINTS = 25;
export const ARENA_LOSS_POINTS = 17;

// Faixas de pontos por tier — ganho 19-25, derrota 17-23.
// Quanto mais alto o elo, mais difícil tirar o máximo de vitória e mais fácil
// levar a perda máxima na derrota.
const ARENA_POINT_RANGES: Array<{ name: string; win: [number, number]; loss: [number, number] }> = [
  { name: "Ferro",       win: [22, 25], loss: [17, 19] },
  { name: "Bronze",      win: [21, 25], loss: [17, 20] },
  { name: "Prata",       win: [21, 24], loss: [18, 20] },
  { name: "Ouro",        win: [20, 24], loss: [18, 21] },
  { name: "Platina",     win: [20, 23], loss: [19, 21] },
  { name: "Diamante",    win: [19, 23], loss: [19, 22] },
  { name: "Mestre",      win: [19, 22], loss: [20, 22] },
  { name: "Grão-Mestre", win: [19, 21], loss: [20, 23] },
  { name: "Lendário",    win: [19, 20], loss: [21, 23] },
];

function randInt(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Sorteia os pontos de ganho/perda para uma partida com base nos pontos atuais.
export function rollArenaPoints(currentPoints: number): { win: number; loss: number } {
  const tier = getTier(currentPoints);
  const range = ARENA_POINT_RANGES.find((r) => r.name === tier.name) ?? ARENA_POINT_RANGES[0];
  return {
    win: randInt(range.win[0], range.win[1]),
    loss: randInt(range.loss[0], range.loss[1]),
  };
}



// ===== SINERGIA POR CATEGORIA =====
export type Category =
  | "fogo" | "floresta" | "sombras" | "felinos" | "repteis"
  | "abyssal" | "dragoes" | "gelo" | "aves" | "pedra" | "relampago";

export type SynergyStat = "hp" | "atk" | "def" | "spd" | "int" | "crit";

export const CATEGORY_INFO: Record<Category, { name: string; emoji: string; stat: SynergyStat; statLabel: string }> = {
  floresta:  { name: "Floresta",  emoji: "🌿", stat: "hp",   statLabel: "HP" },
  sombras:   { name: "Sombras",   emoji: "🌑", stat: "atk",  statLabel: "ATK" },
  felinos:   { name: "Felinos",   emoji: "🐱", stat: "crit", statLabel: "CRIT" },
  repteis:   { name: "Répteis",   emoji: "🦎", stat: "def",  statLabel: "DEF" },
  abyssal:   { name: "Abyssal",   emoji: "🌊", stat: "int",  statLabel: "INT" },
  dragoes:   { name: "Dragões",   emoji: "🐉", stat: "atk",  statLabel: "ATK" },
  gelo:      { name: "Gelo",      emoji: "❄️", stat: "def",  statLabel: "DEF" },
  aves:      { name: "Aves",      emoji: "🦅", stat: "spd",  statLabel: "SPD" },
  fogo:      { name: "Fogo",      emoji: "🔥", stat: "atk",  statLabel: "ATK" },
  pedra:     { name: "Pedra",     emoji: "🪨", stat: "def",  statLabel: "DEF" },
  relampago: { name: "Relâmpago", emoji: "⚡", stat: "spd",  statLabel: "SPD" },
};

export const SPECIES_CATEGORIES: Record<string, Category[]> = {
  steamcub: ["fogo"],
  emberleaf: ["floresta", "fogo"],
  sparkpup: ["fogo", "relampago"],
  cinderwisp: ["fogo", "sombras"],
  mossfin: ["floresta", "abyssal"],
  stormtad: ["abyssal", "relampago"],
  tidewraith: ["abyssal", "sombras"],
  voltsprout: ["floresta", "relampago"],
  nightbloom: ["floresta", "sombras"],
  voidspark: ["sombras", "relampago"],
  magmaboulder: ["fogo", "pedra"],
  mudpaw: ["pedra"],
  crystalsprite: ["pedra", "relampago"],
  flarepup: ["fogo"],
  aquakitty: ["felinos", "abyssal"],
  leafox: ["floresta"],
  voltbun: ["relampago"],
  shadepup: ["sombras"],
  rockpup: ["pedra"],
  rato_bomba: ["fogo"],
  macaco_prego: ["floresta"],
  tubarao_abissal: ["abyssal"],
  polvo_venenoso: ["abyssal", "sombras"],
  cobra_sangrenta: ["repteis", "sombras"],
  borboleta_sonifera: ["aves", "floresta"],
  urso_polar: ["abyssal", "gelo"],
  jacare_ancestral: ["repteis", "abyssal"],
  gorila_titan: ["floresta"],
  aguia_cega: ["aves", "relampago"],
  lobo_lua_sangrenta: ["sombras"],
  onca_sombria: ["felinos", "sombras"],
  leao_dourado: ["felinos"],
  tigre_infernal: ["felinos", "fogo"],
  pantera_negra: ["felinos", "sombras"],
  pantera_aurea: ["felinos", "sombras"],
  dragao_branco: ["dragoes", "abyssal"],
  dragao_negro: ["dragoes", "sombras"],
  fenix_vermelha: ["dragoes", "aves", "fogo"],
  fenix_negra: ["dragoes", "aves", "sombras"],
  fenix_azul: ["dragoes", "aves"],
};

export function getSpeciesCategories(speciesId: string): Category[] {
  return SPECIES_CATEGORIES[speciesId] ?? [];
}

export type SynergyEntry = { category: Category; count: number; bonusPct: number; active: boolean };

/** Conta categorias de uma lista de espécies e retorna todas as que aparecem (1+).
 *  bonusPct: 5 quando count==2, 10 quando count>=3, 0 quando count<2.
 *  active: count >= 2 */
export function computeSynergies(speciesIds: string[]): SynergyEntry[] {
  const counts = new Map<Category, number>();
  for (const sid of speciesIds) {
    for (const cat of getSpeciesCategories(sid)) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
  }
  const out: SynergyEntry[] = [];
  for (const [category, count] of counts.entries()) {
    const bonusPct = count >= 3 ? 10 : count >= 2 ? 5 : 0;
    out.push({ category, count, bonusPct, active: count >= 2 });
  }
  // Ordena: ativos primeiro (maior bonus), depois inativos
  out.sort((a, b) => (Number(b.active) - Number(a.active)) || (b.bonusPct - a.bonusPct) || a.category.localeCompare(b.category));
  return out;
}

/** Soma dos bônus % por stat a partir de sinergias ATIVAS. */
export function synergyStatBonuses(speciesIds: string[]): Record<SynergyStat, number> {
  const acc: Record<SynergyStat, number> = { hp: 0, atk: 0, def: 0, spd: 0, int: 0, crit: 0 };
  for (const s of computeSynergies(speciesIds)) {
    if (!s.active) continue;
    const stat = CATEGORY_INFO[s.category].stat;
    acc[stat] += s.bonusPct;
  }
  return acc;
}
