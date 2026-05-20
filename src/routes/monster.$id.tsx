import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ITEMS, SKINS, ELEMENT_COLORS, ROLE_INFO, getSkill, RARITY_INFO, skinFilter, rankStars, totalStats, computeBattleEnergy, MAX_BATTLE_ENERGY, hungerStatusLabel, getSpeciesCategories, CATEGORY_INFO } from "@/lib/game-data";
import type { MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/monster/$id")({
  component: MonsterPage,
});

function MonsterPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { userId, profile, loading, patch } = useProfile();
  const [monster, setMonster] = useState<MonsterRow | null>(null);
  const [ownedSkins, setOwnedSkins] = useState<string[]>(["default"]);
  const [rations, setRations] = useState<number>(0);
  const [tab, setTab] = useState<"care" | "train" | "skin">("care");

  const load = useCallback(async () => {
    if (!userId) return;
    const [{ data: m }, { data: skins }, { data: inv }] = await Promise.all([
      supabase.from("monsters").select("*").eq("id", id).eq("owner_id", userId).maybeSingle(),
      supabase.from("skins_owned").select("skin_id").eq("user_id", userId),
      supabase.from("inventory").select("quantity").eq("user_id", userId).eq("item_type", "ration").maybeSingle(),
    ]);
    if (m) setMonster(m as MonsterRow);
    if (skins) setOwnedSkins(["default", ...skins.map((s) => s.skin_id)]);
    setRations(inv?.quantity ?? 0);
  }, [id, userId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  if (loading || !profile || !monster) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  const sp = SPECIES[monster.species];
  const teamMax = profile.vip_until && new Date(profile.vip_until) > new Date() ? 4 : 3;

  async function patchMonster(updates: Partial<MonsterRow>) {
    if (!monster) return;
    const merged = { ...monster, ...updates };
    setMonster(merged);
    await supabase.from("monsters").update(updates).eq("id", monster.id);
  }

  async function useItem(itemId: string) {
    if (!profile || !monster) return;
    const item = ITEMS[itemId];
    const useFromInventory = itemId === "ration" && rations > 0;
    if (!useFromInventory) {
      if (item.priceCoins && profile.coins < item.priceCoins) { toast.error("Moedas insuficientes!"); return; }
      if (item.priceGems && profile.gems < item.priceGems) { toast.error("Gemas insuficientes!"); return; }
      await patch({
        coins: profile.coins - (item.priceCoins ?? 0),
        gems: profile.gems - (item.priceGems ?? 0),
      });
    } else {
      const newQty = rations - 1;
      setRations(newQty);
      await supabase.from("inventory").update({ quantity: newQty }).eq("user_id", userId!).eq("item_type", "ration");
    }
    const updates: Partial<MonsterRow> = {};
    if (item.effect.hunger) updates.hunger = Math.min(100, monster.hunger + item.effect.hunger);
    if (item.effect.energy) {
      const e = computeBattleEnergy(monster.battle_energy, monster.battle_energy_at);
      updates.battle_energy = Math.min(MAX_BATTLE_ENERGY, e.energy + item.effect.energy);
      updates.battle_energy_at = e.nextStoredAt;
    }
    if (item.effect.happiness) updates.happiness = Math.min(100, monster.happiness + item.effect.happiness);
    await patchMonster(updates);
    toast.success(`Usou ${item.emoji} ${item.name}`);
  }

  const TRAIN_ENERGY_COST = 2;
  const PLAY_ENERGY_COST = 1;

  const TRAIN_GEM_COST = 5;

  async function train(stat: "atk" | "def" | "spd" | "hp" | "int") {
    if (!profile || !monster) return;
    const cost = 20 + (monster.rank ?? 1) * 10;
    if (profile.coins < cost) { toast.error("Moedas insuficientes!"); return; }
    if ((profile.gems ?? 0) < TRAIN_GEM_COST) { toast.error(`Faltam 💎 ${TRAIN_GEM_COST} diamantes!`); return; }
    const e = computeBattleEnergy(monster.battle_energy, monster.battle_energy_at);
    if (e.energy < TRAIN_ENERGY_COST) { toast.error("Sem energia! Dê um energético ou espere regenerar."); return; }
    if (monster.hunger < 20) { toast.error("Está com fome! Alimente primeiro."); return; }
    await patch({ coins: profile.coins - cost, gems: (profile.gems ?? 0) - TRAIN_GEM_COST });
    const gain = stat === "hp" ? 3 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 2);
    const updates: Partial<MonsterRow> = {
      battle_energy: e.energy - TRAIN_ENERGY_COST,
      battle_energy_at: e.nextStoredAt,
      hunger: monster.hunger - 5,
    };
    updates[stat] = (monster[stat] ?? 0) + gain;
    await patchMonster(updates);
    toast.success(`+${gain} ${stat.toUpperCase()}!`);
  }


  async function play() {
    if (!monster) return;
    const e = computeBattleEnergy(monster.battle_energy, monster.battle_energy_at);
    if (e.energy < PLAY_ENERGY_COST) { toast.error("Sem energia!"); return; }
    await patchMonster({
      happiness: Math.min(100, monster.happiness + 20),
      battle_energy: e.energy - PLAY_ENERGY_COST,
      battle_energy_at: e.nextStoredAt,
    });
    toast.success("Que divertido! 🎉 +20 felicidade");
  }

  async function equipSkin(skinId: string) {
    if (!monster) return;
    await patchMonster({ skin: skinId });
    toast.success("Skin equipada!");
  }

  async function toggleTeam() {
    if (!monster || !profile) return;
    if (!monster.in_team) {
      const { data: team } = await supabase.from("monsters").select("id").eq("owner_id", userId!).eq("in_team", true);
      if ((team?.length ?? 0) >= teamMax) {
        toast.error(`Time cheio (${teamMax}).`); return;
      }
    }
    await patchMonster({ in_team: !monster.in_team });
  }

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(30,10,60,0.65),rgba(30,10,60,0.85)),url(${arenaBg})` }}
    >
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />

      <div className="max-w-3xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Home</button>

        {/* Hero */}
        <div className={`rounded-3xl overflow-hidden border-2 border-white/30 shadow-2xl bg-gradient-to-br ${ELEMENT_COLORS[sp.element]}`}>
          <div className="flex flex-col sm:flex-row items-center gap-4 p-4">
            <div className="w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center">
              <img src={sp.image} alt={sp.name} className="h-full w-auto drop-shadow-2xl" style={{ filter: skinFilter(monster.skin) }} loading="lazy" />
            </div>
            <div className="flex-1 text-white">
              <h1 className="text-3xl font-extrabold drop-shadow-md">{monster.name}</h1>
              <p className="text-sm opacity-90">{sp.emoji} {sp.name} • {"✦".repeat(monster.rank)}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {getSpeciesCategories(monster.species).map((cat) => (
                  <span
                    key={cat}
                    title={`+${CATEGORY_INFO[cat].statLabel} com sinergia`}
                    className="px-2 py-0.5 rounded-full bg-black/40 border border-white/30 text-[10px] font-extrabold flex items-center gap-1"
                  >
                    <span>{CATEGORY_INFO[cat].emoji}</span>
                    <span>{CATEGORY_INFO[cat].name}</span>
                    <span className="opacity-80">+{CATEGORY_INFO[cat].statLabel}</span>
                  </span>
                ))}
              </div>
              {(() => {
                const stats = totalStats(monster.species, monster.rank, {
                  hp: monster.hp ?? 0, atk: monster.atk ?? 0, def: monster.def ?? 0, spd: monster.spd ?? 0, int: monster.int ?? 0,
                });
                return (
                  <>
                    <div className="mt-2 space-y-1 text-xs">
                      <Bar label="❤️ HP" value={stats.hp} max={stats.hp} color="bg-rose-500" />
                      <Bar label="🍖 Fome" value={monster.hunger} max={100} color="bg-amber-500" />
                      <div className={`text-[10px] font-bold ${hungerStatusLabel(monster.hunger).color}`}>↳ {hungerStatusLabel(monster.hunger).label}</div>
                      <Bar label="⚡ Energia" value={computeBattleEnergy(monster.battle_energy, monster.battle_energy_at).energy} max={MAX_BATTLE_ENERGY} color="bg-yellow-400" />
                      <Bar label="😊 Felicidade" value={monster.happiness} max={100} color="bg-pink-500" />
                    </div>
                    <div className="mt-2 grid grid-cols-5 gap-1 text-xs font-bold bg-black/30 rounded-lg p-2">
                      <span>❤️ {stats.hp}</span>
                      <span>⚔️ {stats.atk}</span>
                      <span>🛡️ {stats.def}</span>
                      <span>💨 {stats.spd}</span>
                      <span>🧠 {stats.int}</span>
                    </div>
                  </>
                );
              })()}
              <button
                onClick={toggleTeam}
                className={`mt-3 w-full py-2 rounded-lg text-sm font-extrabold transition ${
                  monster.in_team
                    ? "bg-yellow-400 text-yellow-950 hover:bg-yellow-300"
                    : "bg-white/20 text-white hover:bg-white/30"
                }`}
              >
                {monster.in_team ? "✓ No time de batalha" : "Adicionar ao time"}
              </button>
            </div>
          </div>
        </div>

        {/* Skill card */}
        {(() => {
          const skill = getSkill(sp.id);
          const rarity = RARITY_INFO[sp.rarity];
          const role = ROLE_INFO[sp.role];
          const skillMult = rarity.skillMult;
          const stats = totalStats(monster.species, monster.rank, {
            hp: monster.hp ?? 0, atk: monster.atk ?? 0, def: monster.def ?? 0, spd: monster.spd ?? 0, int: monster.int ?? 0,
          });
          const atk = monster.atk ?? stats.atk;
          const int = monster.int ?? stats.int;
          const maxHp = stats.hp;

          // Preview de efeito e ganho por +1 no stat que escala a skill
          let scaleStat: "ATK" | "INT" | "HP" = "ATK";
          let currentLabel = "";
          let perPointLabel = "";
          if (skill.kind === "heavy_strike") {
            scaleStat = "ATK";
            const dmg = Math.round(atk * 2.2 * skillMult);
            const perPoint = (2.2 * skillMult).toFixed(2);
            currentLabel = `💥 ~${dmg} de dano (sem def)`;
            perPointLabel = `+1 ⚔️ ATK ≈ +${perPoint} dano`;
          } else if (skill.kind === "guaranteed_crit") {
            scaleStat = "ATK";
            const dmg = Math.round(atk * 1.8 * 1.7 * skillMult);
            const perPoint = (1.8 * 1.7 * skillMult).toFixed(2);
            currentLabel = `🗡️ ~${dmg} de dano crítico`;
            perPointLabel = `+1 ⚔️ ATK ≈ +${perPoint} dano`;
          } else if (skill.kind === "aoe_magic") {
            scaleStat = "INT";
            const dmg = Math.round(int * 2.2 * 1.2 * skillMult);
            const perPoint = (2.2 * 1.2 * skillMult).toFixed(2);
            currentLabel = `🔮 ~${dmg} de dano em CADA inimigo`;
            perPointLabel = `+1 🧠 INT ≈ +${perPoint} dano por alvo`;
          } else if (skill.kind === "team_heal") {
            scaleStat = "INT";
            const heal = Math.round((int * 1.8 + maxHp * 0.10) * skillMult);
            const perPoint = (1.8 * skillMult).toFixed(2);
            currentLabel = `✨ ~${heal} de cura em cada aliado`;
            perPointLabel = `+1 🧠 INT ≈ +${perPoint} de cura`;
          } else if (skill.kind === "shield_taunt") {
            scaleStat = "HP";
            const shield = Math.round(maxHp * 0.30 * skillMult);
            const perPoint = (0.30 * skillMult).toFixed(2);
            currentLabel = `🛡️ ~${shield} de escudo`;
            perPointLabel = `+1 ❤️ HP máx ≈ +${perPoint} de escudo`;
          } else if (skill.kind === "lifesteal_strike") {
            scaleStat = "ATK";
            const dmg = Math.round(atk * 2 * 2.0 * skillMult);
            const heal = Math.round(dmg * 0.55);
            currentLabel = `🩸 ~${dmg} de dano + ~${heal} de vida roubada`;
            perPointLabel = `+1 ⚔️ ATK ≈ +${(2 * 2.0 * skillMult).toFixed(2)} dano (e ~55% vira cura)`;
          } else if (skill.kind === "execute") {
            scaleStat = "ATK";
            const normal = Math.round(atk * 2 * 1.75 * skillMult);
            const exec = Math.round(atk * 2 * 3.0 * skillMult);
            currentLabel = `☠️ ~${normal} normal / ~${exec} se alvo <30% HP`;
            perPointLabel = `+1 ⚔️ ATK ≈ +${(2 * 3.0 * skillMult).toFixed(2)} dano na execução`;
          } else if (skill.kind === "burn_dot") {
            scaleStat = "INT";
            const hit = Math.round((int * 1.4 + atk * 0.8) * skillMult);
            const dot = Math.round((int * 0.6 + atk * 0.3) * skillMult);
            currentLabel = `🔥 ~${hit} de dano + ~${dot}/turno por 3 turnos (~${dot * 3} total)`;
            perPointLabel = `+1 🧠 INT ≈ +${(1.4 * skillMult).toFixed(2)} no impacto e +${(0.6 * 3 * skillMult).toFixed(2)} total no DoT`;
          } else if (skill.kind === "double_strike") {
            scaleStat = "ATK";
            const each = Math.round(atk * 2 * 1.25 * skillMult);
            currentLabel = `⚡⚡ 2× ~${each} (~${each * 2} total) no alvo mais forte`;
            perPointLabel = `+1 ⚔️ ATK ≈ +${(2 * 1.25 * 2 * skillMult).toFixed(2)} dano total`;
          } else if (skill.kind === "shield_ally") {
            scaleStat = "INT";
            const shield = Math.round(int * 1.4 * skillMult);
            currentLabel = `🛡️ ~${shield} de escudo + 30% DEF (2 turnos) em aliado ferido`;
            perPointLabel = `+1 🧠 INT ≈ +${(1.4 * skillMult).toFixed(2)} de escudo`;
          } else if (skill.kind === "chain_lightning") {
            scaleStat = "INT";
            const d1 = Math.round(int * 1.8 * 1.0 * skillMult);
            const d2 = Math.round(int * 1.8 * 0.6 * skillMult);
            const d3 = Math.round(int * 1.8 * 0.35 * skillMult);
            currentLabel = `⚡ ~${d1} → ~${d2} → ~${d3} (3 alvos)`;
            perPointLabel = `+1 🧠 INT ≈ +${(1.8 * 1.95 * skillMult).toFixed(2)} dano total`;
          } else if (skill.kind === "silence_disable") {
            scaleStat = "INT";
            const dmg = Math.round(int * 1.6 * 1.1 * skillMult);
            currentLabel = `🤐 ~${dmg} de dano + silencia próxima skill (2 turnos)`;
            perPointLabel = `+1 🧠 INT ≈ +${(1.6 * 1.1 * skillMult).toFixed(2)} dano`;
          } else if (skill.kind === "berserker_rage") {
            scaleStat = "ATK";
            const bonus = Math.round(0.65 * skillMult * 100);
            currentLabel = `😡 +${bonus}% ATK e -25% DEF por 3 turnos`;
            perPointLabel = `Buff próprio — escala ataques básicos durante a fúria`;
          } else if (skill.kind === "revive_ally") {
            scaleStat = "INT";
            const heal = Math.round((int * 1.6 + maxHp * 0.10) * skillMult);
            currentLabel = `✨ Ressuscita aliado caído com 40% HP (ou cura time em ~${heal})`;
            perPointLabel = `+1 🧠 INT ≈ +${(1.6 * skillMult).toFixed(2)} de cura no fallback`;
          } else if (skill.kind === "true_damage_nuke") {
            scaleStat = sp.role === "mage" ? "INT" : "ATK";
            const scale = sp.role === "mage" ? int * 2.5 : atk * 2.8;
            const dmg = Math.round(scale * skillMult);
            const per = sp.role === "mage" ? (2.5 * skillMult).toFixed(2) : (2.8 * skillMult).toFixed(2);
            currentLabel = `💥 ~${dmg} de DANO VERDADEIRO (ignora DEF e elemento)`;
            perPointLabel = `+1 ${scaleStat === "INT" ? "🧠 INT" : "⚔️ ATK"} ≈ +${per} dano verdadeiro`;
          }

          return (
            <div className="rounded-2xl bg-gradient-to-br from-purple-900/80 to-fuchsia-900/80 border-2 border-white/30 p-4 text-white shadow-xl">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded-full ${role.color} text-[10px] font-extrabold`}>
                  {role.emoji} {role.name}
                </span>
                <span className={`px-2 py-0.5 rounded-full ${rarity.color} text-[10px] font-extrabold`}>
                  {rarity.emoji} {rarity.name} (×{rarity.skillMult} skill)
                </span>
              </div>
              <div className="text-xs opacity-90 mb-3">
                <span className="font-bold">Passiva:</span> {role.description}
              </div>
              <div className="rounded-xl bg-black/40 p-3 border border-white/20">
                <div className="font-extrabold text-base flex items-center gap-1.5">
                  <span className="text-xl">{skill.emoji}</span>
                  {skill.name}
                  <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full">CD {skill.cooldown}</span>
                </div>
                <div className="text-xs opacity-90 mt-1">{skill.description}</div>

                {/* Preview de dano/efeito */}
                <div className="mt-3 rounded-lg bg-fuchsia-500/20 border border-fuchsia-300/30 p-2 text-xs">
                  <div className="font-extrabold text-fuchsia-100">{currentLabel}</div>
                  <div className="opacity-90 mt-0.5">
                    Escala com <span className="font-bold">{scaleStat}</span> — {perPointLabel}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Tabs */}
        <div className="flex bg-white/10 backdrop-blur-md rounded-xl overflow-hidden border border-white/20">
          {(["care", "train", "skin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-bold transition ${tab === t ? "bg-white/30 text-white" : "text-white/70 hover:bg-white/15"}`}
            >
              {t === "care" ? "🍖 Cuidar" : t === "train" ? "💪 Treinar" : "🎨 Skins"}
            </button>
          ))}
        </div>

        {tab === "care" && (
          <div className="grid sm:grid-cols-2 gap-3">
            <button
              onClick={play}
              className="p-4 rounded-2xl bg-pink-500/90 hover:bg-pink-400 text-white font-extrabold text-left transition shadow-lg"
            >
              🎮 Brincar
              <div className="text-xs font-normal opacity-90">Grátis • +20 felicidade • -{PLAY_ENERGY_COST} energia</div>
            </button>
            {Object.values(ITEMS).map((it) => {
              const qty = it.id === "ration" ? rations : 0;
              const freeFromInv = it.id === "ration" && qty > 0;
              return (
                <button
                  key={it.id}
                  onClick={() => useItem(it.id)}
                  className="p-4 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-left transition border border-white/20 relative"
                >
                  {it.id === "ration" && (
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-extrabold">
                      x{qty}
                    </span>
                  )}
                  <div className="font-extrabold text-sm">{it.emoji} {it.name}</div>
                  <div className="text-xs opacity-90 mb-1">{it.description}</div>
                  <div className="text-xs font-bold">
                    {freeFromInv ? "🎒 Do inventário" : it.priceCoins ? `🪙 ${it.priceCoins}` : `💎 ${it.priceGems}`}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {tab === "train" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {([
              { s: "atk", emoji: "⚔️", grad: "from-orange-500 to-red-600", gain: "+1~2" },
              { s: "def", emoji: "🛡️", grad: "from-blue-500 to-indigo-600", gain: "+1~2" },
              { s: "spd", emoji: "💨", grad: "from-purple-500 to-fuchsia-600", gain: "+1~2" },
              { s: "hp",  emoji: "❤️", grad: "from-rose-500 to-pink-600", gain: "+3~5" },
              { s: "int", emoji: "🧠", grad: "from-fuchsia-500 to-violet-600", gain: "+1~2" },
            ] as const).map(({ s, emoji, grad, gain }) => (
              <button
                key={s}
                onClick={() => train(s)}
                className={`p-4 rounded-2xl bg-gradient-to-br ${grad} text-white font-extrabold transition shadow-lg hover:scale-105`}
              >
                <div className="text-3xl mb-1">{emoji}</div>
                <div>Treinar {s.toUpperCase()}</div>
                <div className="text-xs font-normal opacity-90 mt-1">
                  🪙 {20 + monster.rank * 10} • 💎 {TRAIN_GEM_COST} • -{TRAIN_ENERGY_COST} energia • {gain} {s.toUpperCase()}
                </div>

              </button>
            ))}
          </div>
        )}

        {tab === "skin" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.values(SKINS).map((sk) => {
              const owned = ownedSkins.includes(sk.id);
              const equipped = monster.skin === sk.id;
              return (
                <div key={sk.id} className="rounded-xl bg-white/10 border border-white/20 p-2 text-white">
                  <div className="aspect-square flex items-center justify-center bg-black/30 rounded-lg mb-1">
                    <img src={sp.image} alt="" className="h-3/4 w-auto" style={{ filter: skinFilter(sk.id) }} />
                  </div>
                  <div className="font-bold text-xs">{sk.name}</div>
                  <div className="text-[10px] opacity-80 h-7">{sk.description}</div>
                  {owned ? (
                    <button
                      onClick={() => equipSkin(sk.id)}
                      disabled={equipped}
                      className="mt-1 w-full py-1 rounded text-[11px] font-bold bg-yellow-400 text-yellow-950 disabled:bg-white/20 disabled:text-white"
                    >
                      {equipped ? "✓ Equipada" : "Equipar"}
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate({ to: "/shop" })}
                      className="mt-1 w-full py-1 rounded text-[11px] font-bold bg-fuchsia-500 hover:bg-fuchsia-400"
                    >
                      💎 {sk.priceGems}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-[10px] opacity-90"><span>{label}</span><span>{value}/{max}</span></div>
      <div className="h-2 bg-black/40 rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
