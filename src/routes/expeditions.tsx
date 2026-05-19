import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import {
  SPECIES,
  ELEMENT_COLORS,
  EXPEDITION_DURATIONS,
  EXPEDITION_SLOT_PRICES,
  MAX_EXPEDITION_SLOTS,
  MAX_BATTLE_ENERGY,
  computeExpeditionReward,
  computeBattleEnergy,
  rankStars,
  skinFilter,
  type ExpeditionDuration,
} from "@/lib/game-data";
import {
  startExpedition,
  claimExpedition,
  cancelExpedition,
  buyExpeditionSlot,
  swapExpeditionMonster,
  EXPEDITION_SWAP_GEM_COST,
} from "@/lib/expeditions.functions";
import { toast, Toaster } from "sonner";
import type { MonsterRow } from "@/components/MonsterCard";
import { ChestRewardPopup, type PendingChest } from "@/components/ChestRewardPopup";

export const Route = createFileRoute("/expeditions")({
  component: ExpeditionsPage,
});

type ExpRow = {
  id: string;
  monster_id: string;
  duration_minutes: number;
  started_at: string;
  ends_at: string;
  claimed: boolean;
  xp_reward: number;
  coins_reward: number;
  gems_reward: number;
  ration_drop: number;
};

function ExpeditionsPage() {
  const navigate = useNavigate();
  const { userId, profile, loading, reload } = useProfile();
  const [monsters, setMonsters] = useState<MonsterRow[]>([]);
  const [expeditions, setExpeditions] = useState<ExpRow[]>([]);
  const [foodQty, setFoodQty] = useState(0);
  const [pickMonsterFor, setPickMonsterFor] = useState<ExpeditionDuration | null>(null);
  const [swapForExp, setSwapForExp] = useState<ExpRow | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [chestQueue, setChestQueue] = useState<PendingChest[]>([]);

  const start = useServerFn(startExpedition);
  const claim = useServerFn(claimExpedition);
  const cancel = useServerFn(cancelExpedition);
  const buySlot = useServerFn(buyExpeditionSlot);
  const swap = useServerFn(swapExpeditionMonster);

  const refresh = useCallback(async () => {
    if (!userId) return;
    const [{ data: ms }, { data: exps }, { data: food }] = await Promise.all([
      supabase.from("monsters").select("*").eq("owner_id", userId),
      supabase.from("expeditions").select("*").eq("user_id", userId).eq("claimed", false).order("ends_at"),
      supabase.from("inventory").select("quantity").eq("user_id", userId).eq("item_type", "ration").maybeSingle(),
    ]);
    if (ms) setMonsters(ms as MonsterRow[]);
    if (exps) setExpeditions(exps as ExpRow[]);
    setFoodQty(food?.quantity ?? 0);
  }, [userId]);

  useEffect(() => { if (userId) refresh(); }, [userId, refresh]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  async function handleStart(monsterId: string, duration: ExpeditionDuration) {
    setBusy(true);
    try {
      await start({ data: { monsterId, durationId: duration.id } });
      toast.success(`Expedição iniciada! Volta em ${duration.label}`);
      setPickMonsterFor(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleClaim(exp: ExpRow) {
    setBusy(true);
    try {
      const r = await claim({ data: { expeditionId: exp.id } });
      const parts = [`+✨ ${r.xp} XP`, `+🪙 ${r.coins}`];
      if (r.gems > 0) parts.push(`+💎 ${r.gems}`);
      if (r.rations > 0) parts.push(`+🍖 ${r.rations}`);
      toast.success(`Recompensa: ${parts.join(" • ")}`);
      if (r.levelUp) {
        const lu = r.levelUp;
        for (let lv = lu.fromLevel + 1; lv <= lu.toLevel; lv++) {
          const tier = lv === 100 ? "👑 Baú LENDÁRIO" : lv === 50 ? "🥇 Baú de OURO" : lv % 10 === 0 ? "🥈 Baú de PRATA" : "📦 Baú de Madeira";
          toast.success(`🎉 Level ${lv}! ${tier} aberto`, { duration: 4000 });
        }
        const lp: string[] = [];
        if (lu.coins) lp.push(`🪙 ${lu.coins}`);
        if (lu.gems) lp.push(`💎 ${lu.gems}`);
        if (lu.rations) lp.push(`🍖 ${lu.rations}`);
        if (lu.pets) lp.push(`🥚 ${lu.pets} pet${lu.pets > 1 ? "s" : ""}`);
        if (lp.length) toast(`Recompensas dos baús: ${lp.join(" • ")}`, { duration: 5000 });
      }
      await Promise.all([refresh(), reload()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(exp: ExpRow) {
    if (!confirm("Cancelar a expedição? A energia gasta NÃO volta.")) return;
    setBusy(true);
    try {
      await cancel({ data: { expeditionId: exp.id } });
      toast("Expedição cancelada");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleBuySlot() {
    setBusy(true);
    try {
      const r = await buySlot({});
      toast.success(`Slot ${r.slots} desbloqueado! (-${r.paid} 💎)`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSwap(exp: ExpRow, newMonsterId: string) {
    setBusy(true);
    try {
      const r = await swap({ data: { expeditionId: exp.id, newMonsterId } });
      toast.success(`Bichinho trocado! (-${r.paid} 💎)`);
      setSwapForExp(null);
      await Promise.all([refresh(), reload()]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  const slots = profile.expedition_slots ?? 1;
  const activeCount = expeditions.length;
  const slotsLeft = Math.max(0, slots - activeCount);
  const busyMonsterIds = new Set(expeditions.map((e) => e.monster_id));
  const availableMonsters = monsters.filter((m) => !m.in_team && !busyMonsterIds.has(m.id));
  const nextSlot = slots + 1;
  const nextSlotPrice = EXPEDITION_SLOT_PRICES[nextSlot];

  return (
    <main className="min-h-screen pb-12 bg-gradient-to-b from-amber-900 via-orange-900 to-purple-950">
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />

      <div className="max-w-5xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Home</button>

        <header className="text-center text-white">
          <h1 className="text-4xl font-extrabold drop-shadow-lg">🗺️ Expedições</h1>
          <p className="opacity-80 text-sm">Mande seus bichinhos farmarem XP e itens enquanto você está offline</p>
        </header>

        <div className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white flex items-center gap-4 flex-wrap">
          <div className="text-sm">
            <div className="font-bold">📦 Slots: {activeCount} / {slots}</div>
            <div className="text-xs opacity-80">🍖 Rações: {foodQty}</div>
          </div>
          {slots < MAX_EXPEDITION_SLOTS && (
            <button
              onClick={handleBuySlot}
              disabled={busy || (profile.gems ?? 0) < (nextSlotPrice ?? 999)}
              className="ml-auto px-3 py-2 rounded-lg bg-fuchsia-500 hover:bg-fuchsia-600 text-white text-xs font-bold disabled:opacity-50"
            >
              + Comprar slot {nextSlot} ({nextSlotPrice} 💎)
            </button>
          )}
        </div>

        {/* Active expeditions */}
        {expeditions.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-white font-extrabold text-lg">⏳ Em andamento</h2>
            {expeditions.map((exp) => {
              const monster = monsters.find((m) => m.id === exp.monster_id);
              const remaining = Math.max(0, new Date(exp.ends_at).getTime() - now);
              const done = remaining === 0;
              const total = exp.duration_minutes * 60_000;
              const pct = Math.min(100, ((total - remaining) / total) * 100);
              const sp = monster ? SPECIES[monster.species] : null;
              return (
                <div key={exp.id} className={`rounded-xl bg-white/10 backdrop-blur-md border-2 ${done ? "border-emerald-400" : "border-white/20"} p-3 text-white`}>
                  <div className="flex items-center gap-3">
                    {sp && monster && (
                      <img
                        src={sp.image}
                        alt=""
                        className="h-14 w-14 object-contain drop-shadow-lg"
                        style={{ filter: skinFilter(monster.skin) }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold flex items-center gap-2 flex-wrap">
                        {monster?.name ?? "?"}
                        {monster && <span className="text-xs opacity-80">{rankStars(monster.rank ?? 1)}</span>}
                      </div>
                      <div className="text-xs opacity-90">
                        🎯 +{exp.xp_reward} XP • +🪙 {exp.coins_reward}
                        {exp.gems_reward > 0 && ` • +💎 ${exp.gems_reward}`}
                        {exp.ration_drop > 0 && ` • +🍖 ${exp.ration_drop}`}
                      </div>
                      <div className="mt-1 h-2 bg-black/40 rounded-full overflow-hidden">
                        <div className={`h-full ${done ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] mt-0.5 opacity-80">
                        {done ? "✅ Pronto!" : `Falta ${formatRemaining(remaining)}`}
                      </div>
                    </div>
                    {done ? (
                      <button
                        onClick={() => handleClaim(exp)}
                        disabled={busy}
                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 font-bold text-white disabled:opacity-50"
                      >
                        Reclamar
                      </button>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => setSwapForExp(exp)}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg bg-fuchsia-500/90 hover:bg-fuchsia-600 text-xs font-bold text-white disabled:opacity-50 whitespace-nowrap"
                        >
                          🔄 Trocar ({EXPEDITION_SWAP_GEM_COST}💎)
                        </button>
                        <button
                          onClick={() => handleCancel(exp)}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg bg-red-500/80 hover:bg-red-600 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* New expedition launcher */}
        <section className="space-y-2">
          <h2 className="text-white font-extrabold text-lg">🚀 Nova expedição</h2>
          {slotsLeft === 0 ? (
            <div className="rounded-xl bg-white/10 border border-white/20 p-4 text-white/80 text-sm text-center">
              Todos os slots estão ocupados. Espere ou compre mais slots.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {EXPEDITION_DURATIONS.map((d) => {
                return (
                  <button
                    key={d.id}
                    onClick={() => setPickMonsterFor(d)}
                    disabled={busy}
                    className="rounded-xl bg-white/10 border-2 border-white/20 p-3 text-white text-left hover:bg-white/20 hover:scale-105 transition disabled:opacity-40 disabled:hover:scale-100"
                  >
                    <div className="font-extrabold text-lg">{d.label}</div>
                    <div className="text-xs opacity-90 mt-1">
                      💪 +{d.baseXp} XP base<br/>
                      🪙 +{d.baseCoins}<br/>
                      {d.rationChance > 0 && <>🍖 {Math.round(d.rationChance * 100)}% ({d.rationAmount[0]}-{d.rationAmount[1]})<br/></>}
                    </div>
                    <div className="text-xs mt-2 font-bold text-amber-300">
                      Custo: ⚡ {d.foodCost}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Picker modal */}
        {pickMonsterFor && (
          <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4" onClick={() => setPickMonsterFor(null)}>
            <div className="bg-purple-950 border-2 border-white/30 rounded-2xl p-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3 text-white">
                <h3 className="font-extrabold text-lg">Escolher bichinho — {pickMonsterFor.label}</h3>
                <button onClick={() => setPickMonsterFor(null)} className="text-white/60 hover:text-white">✕</button>
              </div>
              {availableMonsters.length === 0 ? (
                <p className="text-white/70 text-sm text-center py-6">
                  Nenhum bichinho disponível. Bichinhos no time ou já em expedição não podem ser enviados.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableMonsters.map((m) => {
                    const sp = SPECIES[m.species];
                    if (!sp) return null;
                    const preview = computeExpeditionReward(pickMonsterFor, m.rank ?? 1);
                    const en = computeBattleEnergy(m.battle_energy, m.battle_energy_at);
                    const enough = en.energy >= pickMonsterFor.foodCost;
                    return (
                      <button
                        key={m.id}
                        onClick={() => enough && handleStart(m.id, pickMonsterFor)}
                        disabled={busy || !enough}
                        className={`rounded-xl bg-gradient-to-r ${ELEMENT_COLORS[sp.element]} p-3 text-white text-left hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100`}
                      >
                        <div className="flex items-center gap-2">
                          <img src={sp.image} alt="" className="h-12 w-12 object-contain drop-shadow-lg" style={{ filter: skinFilter(m.skin) }} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{m.name}</div>
                            <div className="text-[10px] opacity-90">{rankStars(m.rank ?? 1)}</div>
                            <div className="text-[10px] mt-1">
                              ✨{preview.xp} 🪙{preview.coins} • <span className={enough ? "" : "text-red-200 font-bold"}>⚡{en.energy}/{MAX_BATTLE_ENERGY}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Swap modal */}
        {swapForExp && (
          <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4" onClick={() => setSwapForExp(null)}>
            <div className="bg-purple-950 border-2 border-fuchsia-400/50 rounded-2xl p-4 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3 text-white">
                <h3 className="font-extrabold text-lg">🔄 Trocar bichinho ({EXPEDITION_SWAP_GEM_COST} 💎)</h3>
                <button onClick={() => setSwapForExp(null)} className="text-white/60 hover:text-white">✕</button>
              </div>
              <p className="text-white/70 text-xs mb-3">A expedição continua de onde parou; só o bichinho muda.</p>
              {availableMonsters.length === 0 ? (
                <p className="text-white/70 text-sm text-center py-6">Nenhum bichinho disponível pra trocar.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableMonsters.map((m) => {
                    const sp = SPECIES[m.species];
                    if (!sp) return null;
                    const canPay = (profile.gems ?? 0) >= EXPEDITION_SWAP_GEM_COST;
                    return (
                      <button
                        key={m.id}
                        onClick={() => canPay && handleSwap(swapForExp, m.id)}
                        disabled={busy || !canPay}
                        className={`rounded-xl bg-gradient-to-r ${ELEMENT_COLORS[sp.element]} p-3 text-white text-left hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100`}
                      >
                        <div className="flex items-center gap-2">
                          <img src={sp.image} alt="" className="h-12 w-12 object-contain drop-shadow-lg" style={{ filter: skinFilter(m.skin) }} />
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-sm truncate">{m.name}</div>
                            <div className="text-[10px] opacity-90">{rankStars(m.rank ?? 1)}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function formatRemaining(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
