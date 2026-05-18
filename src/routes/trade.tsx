import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { SPECIES, rankStars, RARITY_INFO, TRADE_FEE_COINS, TRADE_FEE_GEMS, MAX_TRADEABLE_RANK } from "@/lib/game-data";
import { createTrade, respondToTrade, confirmTrade, cancelTrade } from "@/lib/trades.functions";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/trade")({
  component: TradePage,
  head: () => ({ meta: [{ title: "Trocas — MonstroBattle" }] }),
});

type Mon = {
  id: string;
  owner_id: string;
  species: string;
  name: string;
  level: number;
  rank: number;
  in_team: boolean;
};

type Trade = {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_monster_id: string;
  to_monster_id: string | null;
  status: string;
  from_confirmed: boolean;
  to_confirmed: boolean;
  expires_at: string;
  created_at: string;
};

type Tab = "received" | "sent" | "new";

function TradePage() {
  const navigate = useNavigate();
  const { userId, profile, loading, reload } = useProfile();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [monstersById, setMonstersById] = useState<Map<string, Mon>>(new Map());
  const [usernamesById, setUsernamesById] = useState<Map<string, string>>(new Map());
  const [myMonsters, setMyMonsters] = useState<Mon[]>([]);
  const [tab, setTab] = useState<Tab>("received");
  const [busy, setBusy] = useState(false);

  // New trade form
  const [targetUsername, setTargetUsername] = useState("");
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(null);

  const fnCreate = useServerFn(createTrade);
  const fnRespond = useServerFn(respondToTrade);
  const fnConfirm = useServerFn(confirmTrade);
  const fnCancel = useServerFn(cancelTrade);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    const [tRes, mRes] = await Promise.all([
      supabase.from("trades").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("monsters").select("id,owner_id,species,name,level,rank,in_team").eq("owner_id", userId),
    ]);
    const tradesData = (tRes.data ?? []) as Trade[];
    setTrades(tradesData);
    setMyMonsters((mRes.data ?? []) as Mon[]);

    // gather monster ids and user ids referenced
    const monIds = new Set<string>();
    const userIds = new Set<string>();
    for (const t of tradesData) {
      monIds.add(t.from_monster_id);
      if (t.to_monster_id) monIds.add(t.to_monster_id);
      userIds.add(t.from_user_id);
      userIds.add(t.to_user_id);
    }
    if (monIds.size > 0) {
      const { data: mons } = await supabase
        .from("monsters")
        .select("id,owner_id,species,name,level,rank,in_team")
        .in("id", Array.from(monIds));
      const map = new Map<string, Mon>();
      for (const m of (mons ?? []) as Mon[]) map.set(m.id, m);
      setMonstersById(map);
    }
    if (userIds.size > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id,username")
        .in("id", Array.from(userIds));
      const um = new Map<string, string>();
      for (const p of profs ?? []) um.set(p.id, p.username);
      setUsernamesById(um);
    }
  }, [userId]);

  useEffect(() => { if (userId) loadAll(); }, [userId, loadAll]);

  const received = useMemo(() => trades.filter((t) => t.to_user_id === userId && t.status !== "cancelled"), [trades, userId]);
  const sent = useMemo(() => trades.filter((t) => t.from_user_id === userId && t.status !== "cancelled"), [trades, userId]);
  const tradeableMonsters = useMemo(
    () => myMonsters.filter((m) => !m.in_team && (m.rank ?? 1) <= MAX_TRADEABLE_RANK && SPECIES[m.species]?.rarity !== "legendary"),
    [myMonsters]
  );

  async function handleCreate() {
    if (!targetUsername || !selectedMonsterId || busy) return;
    setBusy(true);
    try {
      const res = await fnCreate({ data: { toUsername: targetUsername.trim(), fromMonsterId: selectedMonsterId } });
      toast.success(`Oferta enviada para ${res.toUsername}!`);
      setTargetUsername("");
      setSelectedMonsterId(null);
      setTab("sent");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar troca");
    } finally {
      setBusy(false);
    }
  }

  async function handleRespond(tradeId: string, monsterId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fnRespond({ data: { tradeId, withMonsterId: monsterId } });
      toast.success("Resposta enviada! Aguarde os dois confirmarem.");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  async function handleConfirm(tradeId: string) {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fnConfirm({ data: { tradeId } });
      if (res.completed) {
        toast.success("🎉 Troca completada!");
        reload();
      } else {
        toast.success("Confirmação registrada. Aguardando o outro jogador.");
      }
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  async function handleCancel(tradeId: string) {
    if (busy) return;
    if (!confirm("Cancelar esta troca?")) return;
    setBusy(true);
    try {
      await fnCancel({ data: { tradeId } });
      toast.success("Troca cancelada");
      await loadAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white bg-purple-950">Carregando…</div>;
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundImage: `url(${arenaBg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-purple-950/70" />
      <div className="relative z-10">
        <HUD profile={profile} />
        <Toaster position="top-center" richColors />
        <main className="max-w-4xl mx-auto p-4 space-y-4">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white drop-shadow">🔄 Trocas</h1>
            <p className="text-purple-100/90 text-sm mt-1">
              Troca 1↔1 com outro jogador. Taxa: <b>{TRADE_FEE_COINS}🪙 + {TRADE_FEE_GEMS}💎</b> de cada lado.
            </p>
            <p className="text-purple-200/70 text-[11px] mt-1">
              Bichinhos lendários ou ✦{MAX_TRADEABLE_RANK + 1}+ não podem ser trocados. Tire do time antes.
            </p>
          </div>

          <div className="flex gap-1 justify-center bg-black/30 p-1 rounded-xl w-fit mx-auto">
            <TabBtn active={tab === "received"} onClick={() => setTab("received")}>📥 Recebidas ({received.filter((t) => t.status === "pending" || t.status === "accepted").length})</TabBtn>
            <TabBtn active={tab === "sent"} onClick={() => setTab("sent")}>📤 Enviadas ({sent.filter((t) => t.status === "pending" || t.status === "accepted").length})</TabBtn>
            <TabBtn active={tab === "new"} onClick={() => setTab("new")}>➕ Nova</TabBtn>
          </div>

          {tab === "new" && (
            <section className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 space-y-3">
              <h2 className="text-white font-extrabold">Propor troca</h2>
              <div>
                <label className="text-white/80 text-xs block mb-1">Username do jogador</label>
                <input
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder="Ex: TreinadorAna"
                  className="w-full px-3 py-2 rounded-lg bg-white/90 text-black text-sm"
                />
              </div>
              <div>
                <label className="text-white/80 text-xs block mb-1">Seu bichinho para oferecer</label>
                {tradeableMonsters.length === 0 ? (
                  <div className="text-white/70 text-xs p-3 bg-black/30 rounded-lg">
                    Nenhum bichinho disponível pra trocar. Tire um do time ou pegue mais ovos!
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {tradeableMonsters.map((m) => (
                      <MonsterPick
                        key={m.id}
                        mon={m}
                        selected={selectedMonsterId === m.id}
                        onClick={() => setSelectedMonsterId(m.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={handleCreate}
                disabled={busy || !targetUsername || !selectedMonsterId}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white font-extrabold disabled:opacity-50 shadow-lg hover:scale-[1.01] transition"
              >
                Enviar oferta ✉️
              </button>
            </section>
          )}

          {tab === "received" && (
            <section className="space-y-3">
              {received.length === 0 ? (
                <EmptyState text="Ninguém te ofereceu uma troca ainda." />
              ) : (
                received.map((t) => (
                  <TradeCard
                    key={t.id}
                    trade={t}
                    side="to"
                    userId={userId!}
                    monstersById={monstersById}
                    usernamesById={usernamesById}
                    myTradeable={tradeableMonsters}
                    busy={busy}
                    onRespond={(mid) => handleRespond(t.id, mid)}
                    onConfirm={() => handleConfirm(t.id)}
                    onCancel={() => handleCancel(t.id)}
                  />
                ))
              )}
            </section>
          )}

          {tab === "sent" && (
            <section className="space-y-3">
              {sent.length === 0 ? (
                <EmptyState text="Você ainda não enviou nenhuma oferta." />
              ) : (
                sent.map((t) => (
                  <TradeCard
                    key={t.id}
                    trade={t}
                    side="from"
                    userId={userId!}
                    monstersById={monstersById}
                    usernamesById={usernamesById}
                    myTradeable={tradeableMonsters}
                    busy={busy}
                    onRespond={() => {}}
                    onConfirm={() => handleConfirm(t.id)}
                    onCancel={() => handleCancel(t.id)}
                  />
                ))
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition ${active ? "bg-white text-purple-900" : "text-white/80 hover:bg-white/10"}`}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm p-6 text-center text-white/80 text-sm">{text}</div>;
}

function MonsterPick({ mon, selected, onClick }: { mon: Mon; selected: boolean; onClick: () => void }) {
  const sp = SPECIES[mon.species];
  if (!sp) return null;
  return (
    <button
      onClick={onClick}
      className={`p-2 rounded-lg border-2 transition text-left ${selected ? "border-yellow-400 bg-yellow-400/20" : "border-white/20 bg-white/5 hover:bg-white/10"}`}
    >
      <img src={sp.image} alt={sp.name} className="h-12 w-full object-contain" />
      <div className="text-white text-[11px] font-extrabold truncate">{mon.name}</div>
      <div className="text-white/70 text-[10px]">Nv {mon.level} {rankStars(mon.rank ?? 1)}</div>
    </button>
  );
}

function MiniMon({ id, monstersById, fallback }: { id: string | null; monstersById: Map<string, Mon>; fallback?: string }) {
  if (!id) return <div className="text-white/60 text-xs italic">{fallback ?? "—"}</div>;
  const m = monstersById.get(id);
  if (!m) return <div className="text-white/60 text-xs italic">Bichinho</div>;
  const sp = SPECIES[m.species];
  return (
    <div className="flex items-center gap-2">
      {sp && <img src={sp.image} alt={sp.name} className="h-12 w-12 object-contain" />}
      <div className="min-w-0">
        <div className="text-white text-xs font-extrabold truncate">{m.name}</div>
        <div className="text-white/70 text-[10px]">{sp?.name} • Nv {m.level} {rankStars(m.rank ?? 1)}</div>
        {sp && <div className={`inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold ${RARITY_INFO[sp.rarity].color}`}>{RARITY_INFO[sp.rarity].name}</div>}
      </div>
    </div>
  );
}

function TradeCard({
  trade, side, userId, monstersById, usernamesById, myTradeable, busy, onRespond, onConfirm, onCancel,
}: {
  trade: Trade;
  side: "from" | "to";
  userId: string;
  monstersById: Map<string, Mon>;
  usernamesById: Map<string, string>;
  myTradeable: Mon[];
  busy: boolean;
  onRespond: (monsterId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const otherId = side === "from" ? trade.to_user_id : trade.from_user_id;
  const otherName = usernamesById.get(otherId) ?? "Jogador";
  const expired = new Date(trade.expires_at).getTime() < Date.now();
  const myConfirmed = side === "from" ? trade.from_confirmed : trade.to_confirmed;
  const otherConfirmed = side === "from" ? trade.to_confirmed : trade.from_confirmed;
  const [pickedResponse, setPickedResponse] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-white text-sm">
          <b>{side === "from" ? "Para" : "De"}: {otherName}</b>
          <span className="ml-2 text-[10px] text-white/60">
            • {new Date(trade.created_at).toLocaleString()}
          </span>
        </div>
        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
          trade.status === "completed" ? "bg-emerald-500 text-white" :
          trade.status === "accepted" ? "bg-amber-400 text-amber-950" :
          "bg-slate-500 text-white"
        }`}>
          {trade.status === "pending" ? "PENDENTE" : trade.status === "accepted" ? "AGUARDANDO CONFIRMAÇÕES" : trade.status.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[10px] text-white/70 mb-1">{side === "from" ? "Você oferece" : `${otherName} oferece`}</div>
          <MiniMon id={trade.from_monster_id} monstersById={monstersById} />
        </div>
        <div className="bg-black/30 rounded-lg p-2">
          <div className="text-[10px] text-white/70 mb-1">{side === "from" ? `${otherName} dá` : "Você dá"}</div>
          <MiniMon id={trade.to_monster_id} monstersById={monstersById} fallback={side === "to" ? "Escolha abaixo ↓" : "Aguardando escolha"} />
        </div>
      </div>

      {/* Recipient picks monster (status pending) */}
      {side === "to" && trade.status === "pending" && !expired && (
        <div className="space-y-2">
          <div className="text-white/80 text-xs">Escolha o bichinho que você dá em troca:</div>
          {myTradeable.length === 0 ? (
            <div className="text-white/60 text-[11px]">Sem bichinhos disponíveis pra trocar.</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {myTradeable.map((m) => (
                <MonsterPick key={m.id} mon={m} selected={pickedResponse === m.id} onClick={() => setPickedResponse(m.id)} />
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => pickedResponse && onRespond(pickedResponse)}
              disabled={busy || !pickedResponse}
              className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-extrabold"
            >
              ✅ Aceitar com esse
            </button>
            <button onClick={onCancel} disabled={busy} className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold">Recusar</button>
          </div>
        </div>
      )}

      {/* Both pick made → confirmation phase */}
      {trade.status === "accepted" && (
        <div className="space-y-2">
          <div className="text-white/80 text-[11px]">
            Taxa: <b>{TRADE_FEE_COINS}🪙 + {TRADE_FEE_GEMS}💎</b> de cada lado. Os dois precisam confirmar.
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className={`p-1.5 rounded text-center font-bold ${myConfirmed ? "bg-emerald-500 text-white" : "bg-black/30 text-white/70"}`}>
              Você: {myConfirmed ? "✅ confirmou" : "⏳ pendente"}
            </div>
            <div className={`p-1.5 rounded text-center font-bold ${otherConfirmed ? "bg-emerald-500 text-white" : "bg-black/30 text-white/70"}`}>
              {otherName}: {otherConfirmed ? "✅ confirmou" : "⏳ pendente"}
            </div>
          </div>
          <div className="flex gap-2">
            {!myConfirmed && (
              <button onClick={onConfirm} disabled={busy} className="flex-1 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-extrabold disabled:opacity-50">
                🤝 Confirmar troca ({TRADE_FEE_COINS}🪙 + {TRADE_FEE_GEMS}💎)
              </button>
            )}
            <button onClick={onCancel} disabled={busy} className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold">Cancelar</button>
          </div>
        </div>
      )}

      {side === "from" && trade.status === "pending" && (
        <div className="flex gap-2">
          <div className="flex-1 text-white/70 text-xs self-center">Aguardando {otherName} escolher um bichinho…</div>
          <button onClick={onCancel} disabled={busy} className="px-3 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold">Cancelar</button>
        </div>
      )}

      {trade.status === "completed" && (
        <div className="text-emerald-300 text-xs font-bold">🎉 Troca completada!</div>
      )}
      {expired && trade.status !== "completed" && (
        <div className="text-amber-300 text-xs">⏰ Esta oferta expirou.</div>
      )}
    </div>
  );
}
