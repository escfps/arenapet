import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CHESTS, SPECIES, rankStars, speciesImage, shinyFallbackFilter, type ChestTier,
} from "@/lib/game-data";
import { CHEST_ITEM_TYPE } from "@/lib/chest-inventory";

type Gift = {
  id: string;
  sender_id: string;
  receiver_id: string;
  kind: "monster" | "item" | "gems";
  item_type: string | null;
  quantity: number;
  message: string | null;
  snapshot: Record<string, any>;
  status: "pending" | "claimed" | "cancelled";
  created_at: string;
};

type Mon = { id: string; species: string; name: string; rank: number; in_team: boolean; is_shiny?: boolean };

const ITEM_LABELS: Record<string, { label: string; emoji: string }> = {
  ration: { label: "Ração", emoji: "🍖" },
  ...Object.fromEntries(
    (["wood", "silver", "gold", "legendary", "mythic"] as ChestTier[]).map((t) => [
      CHEST_ITEM_TYPE[t],
      { label: CHESTS[t].name, emoji: CHESTS[t].emoji },
    ])
  ),
};

function itemInfo(itemType: string) {
  return ITEM_LABELS[itemType] ?? { label: itemType, emoji: "📦" };
}

export function GiftPanel({
  userId,
  gems,
  onChanged,
}: {
  userId: string;
  gems: number;
  onChanged: () => void;
}) {
  const [gifts, setGifts] = useState<Gift[]>([]);
  const [monsters, setMonsters] = useState<Mon[]>([]);
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [kind, setKind] = useState<"monster" | "item" | "gems">("gems");
  const [toUsername, setToUsername] = useState("");
  const [monsterId, setMonsterId] = useState<string | null>(null);
  const [itemType, setItemType] = useState<string>("");
  const [qty, setQty] = useState(10);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [gRes, mRes, iRes] = await Promise.all([
      supabase.from("player_gifts" as any).select("*").order("created_at", { ascending: false }).limit(60),
      supabase.from("monsters").select("id,species,name,rank,in_team,is_shiny").eq("owner_id", userId),
      supabase.from("inventory").select("item_type,quantity").eq("user_id", userId),
    ]);
    const list = ((gRes.data ?? []) as unknown) as Gift[];
    setGifts(list);
    setMonsters((mRes.data ?? []) as Mon[]);
    const inv: Record<string, number> = {};
    ((iRes.data as { item_type: string; quantity: number }[]) ?? []).forEach((r) => { inv[r.item_type] = r.quantity; });
    setInventory(inv);

    const ids = Array.from(new Set(list.flatMap((g) => [g.sender_id, g.receiver_id])));
    if (ids.length) {
      const { data } = await (supabase as any).from("public_profiles").select("id,username").in("id", ids);
      const map: Record<string, string> = {};
      ((data ?? []) as Array<{ id: string; username: string }>).forEach((p) => { map[p.id] = p.username; });
      setUsernames(map);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const received = useMemo(() => gifts.filter((g) => g.receiver_id === userId && g.status === "pending"), [gifts, userId]);
  const sent = useMemo(() => gifts.filter((g) => g.sender_id === userId && g.status === "pending"), [gifts, userId]);
  const giftable = useMemo(() => monsters.filter((m) => !m.in_team), [monsters]);
  const ownedItems = useMemo(
    () => Object.entries(inventory).filter(([, q]) => (q ?? 0) > 0),
    [inventory]
  );

  async function send() {
    if (busy) return;
    if (!toUsername.trim()) { toast.error("Informe o username do jogador"); return; }
    if (kind === "monster" && !monsterId) { toast.error("Escolha um pokémon"); return; }
    if (kind === "item" && !itemType) { toast.error("Escolha um item"); return; }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc("gift_send", {
        p_to_username: toUsername.trim(),
        p_kind: kind,
        p_monster_id: kind === "monster" ? monsterId : null,
        p_item_type: kind === "item" ? itemType : null,
        p_quantity: kind === "monster" ? 1 : Math.max(1, qty),
        p_message: message || null,
      });
      if (error) throw new Error(error.message);
      toast.success(`🎁 Presente enviado para ${data?.to_username ?? toUsername}!`);
      setToUsername(""); setMonsterId(null); setMessage("");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar presente");
    } finally { setBusy(false); }
  }

  async function claim(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("gift_claim", { p_id: id });
      if (error) throw new Error(error.message);
      toast.success("🎉 Presente coletado!");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  async function cancel(id: string) {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("gift_cancel", { p_id: id });
      if (error) throw new Error(error.message);
      toast.success("Presente cancelado e devolvido");
      await load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-4 space-y-3">
        <h2 className="text-white font-extrabold">🎁 Enviar presente</h2>
        <p className="text-white/70 text-[11px]">
          O jogador não precisa estar online — o presente fica guardado até ele coletar. Cancelar devolve o que você enviou.
        </p>

        <div className="flex gap-1 bg-black/30 p-1 rounded-lg w-fit">
          {([["gems", "💎 Diamantes"], ["item", "📦 Item"], ["monster", "🐾 Pokémon"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`px-3 py-1.5 rounded-md text-xs font-extrabold transition ${kind === k ? "bg-white text-purple-900" : "text-white/80 hover:bg-white/10"}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-white/80 text-xs block mb-1">Username do jogador</label>
          <input
            value={toUsername}
            onChange={(e) => setToUsername(e.target.value)}
            placeholder="Ex: TreinadorAna"
            className="w-full px-3 py-2 rounded-lg bg-white/90 text-black text-sm"
          />
        </div>

        {kind === "gems" && (
          <div>
            <label className="text-white/80 text-xs block mb-1">Quantidade de diamantes (você tem 💎 {gems})</label>
            <input
              type="number" min={1} max={100000}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-3 py-2 rounded-lg bg-white/90 text-black text-sm"
            />
          </div>
        )}

        {kind === "item" && (
          <div className="space-y-2">
            <label className="text-white/80 text-xs block">Item</label>
            {ownedItems.length === 0 ? (
              <div className="text-white/70 text-xs p-3 bg-black/30 rounded-lg">Você não tem itens no inventário.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {ownedItems.map(([it, q]) => {
                  const info = itemInfo(it);
                  return (
                    <button
                      key={it}
                      onClick={() => setItemType(it)}
                      className={`p-2 rounded-lg border-2 text-left transition ${itemType === it ? "border-yellow-400 bg-yellow-400/20" : "border-white/20 bg-white/5 hover:bg-white/10"}`}
                    >
                      <div className="text-xl">{info.emoji}</div>
                      <div className="text-white text-[11px] font-extrabold truncate">{info.label}</div>
                      <div className="text-white/70 text-[10px]">×{q}</div>
                    </button>
                  );
                })}
              </div>
            )}
            <div>
              <label className="text-white/80 text-xs block mb-1">Quantidade</label>
              <input
                type="number" min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-lg bg-white/90 text-black text-sm"
              />
            </div>
          </div>
        )}

        {kind === "monster" && (
          <div>
            <label className="text-white/80 text-xs block mb-1">Pokémon (fora do time)</label>
            {giftable.length === 0 ? (
              <div className="text-white/70 text-xs p-3 bg-black/30 rounded-lg">Nenhum pokémon disponível. Tire um do time primeiro.</div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto">
                {giftable.map((m) => {
                  const sp = SPECIES[m.species];
                  return (
                    <button
                      key={m.id}
                      onClick={() => setMonsterId(m.id)}
                      className={`p-2 rounded-lg border-2 text-left transition ${monsterId === m.id ? "border-yellow-400 bg-yellow-400/20" : "border-white/20 bg-white/5 hover:bg-white/10"}`}
                    >
                      <img
                        src={speciesImage(m.species, m.is_shiny === true)}
                        alt={sp?.name ?? m.species}
                        className="h-12 w-full object-contain"
                        style={{ filter: shinyFallbackFilter(m.species, m.is_shiny === true) }}
                      />
                      <div className="text-white text-[11px] font-extrabold truncate">{m.is_shiny ? "✨ " : ""}{m.name}</div>
                      <div className="text-white/70 text-[10px]">{rankStars(m.rank ?? 1)}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-white/80 text-xs block mb-1">Mensagem (opcional)</label>
          <input
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 120))}
            placeholder="Boa sorte na arena!"
            className="w-full px-3 py-2 rounded-lg bg-white/90 text-black text-sm"
          />
        </div>

        <button
          onClick={send}
          disabled={busy}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-extrabold disabled:opacity-50 shadow-lg hover:scale-[1.01] transition"
        >
          Enviar presente 🎁
        </button>
      </section>

      <section className="space-y-2">
        <h3 className="text-white font-extrabold text-sm">📥 Presentes recebidos ({received.length})</h3>
        {received.length === 0 ? (
          <div className="rounded-xl bg-white/10 border border-white/20 p-4 text-white/70 text-xs">Nenhum presente pra coletar.</div>
        ) : received.map((g) => (
          <GiftRow key={g.id} gift={g} from={usernames[g.sender_id] ?? "Jogador"} busy={busy}
            action={{ label: "Coletar 🎉", onClick: () => claim(g.id), cls: "bg-emerald-500 hover:bg-emerald-600" }} />
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-white font-extrabold text-sm">📤 Presentes enviados ({sent.length})</h3>
        {sent.length === 0 ? (
          <div className="rounded-xl bg-white/10 border border-white/20 p-4 text-white/70 text-xs">Você não tem presentes pendentes.</div>
        ) : sent.map((g) => (
          <GiftRow key={g.id} gift={g} from={`para ${usernames[g.receiver_id] ?? "Jogador"}`} busy={busy}
            action={{ label: "Cancelar", onClick: () => cancel(g.id), cls: "bg-rose-500 hover:bg-rose-600" }} />
        ))}
      </section>
    </div>
  );
}

function GiftRow({
  gift, from, busy, action,
}: {
  gift: Gift;
  from: string;
  busy: boolean;
  action: { label: string; onClick: () => void; cls: string };
}) {
  const sp = gift.kind === "monster" ? SPECIES[gift.snapshot?.species] : null;
  return (
    <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-3 flex items-center gap-3">
      <div className="shrink-0">
        {gift.kind === "monster" && gift.snapshot?.species ? (
          <img
            src={speciesImage(gift.snapshot.species, gift.snapshot.is_shiny === true)}
            alt={sp?.name ?? "Pokémon"}
            className="h-12 w-12 object-contain"
            style={{ filter: shinyFallbackFilter(gift.snapshot.species, gift.snapshot.is_shiny === true) }}
          />
        ) : (
          <span className="text-3xl">{gift.kind === "gems" ? "💎" : itemInfo(gift.item_type ?? "").emoji}</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-white text-xs font-extrabold truncate">
          {gift.kind === "monster"
            ? `${gift.snapshot?.is_shiny ? "✨ " : ""}${gift.snapshot?.name ?? sp?.name ?? "Pokémon"} ${rankStars(gift.snapshot?.rank ?? 1)}`
            : gift.kind === "gems"
              ? `${gift.quantity} diamantes`
              : `${itemInfo(gift.item_type ?? "").label} ×${gift.quantity}`}
        </div>
        <div className="text-white/70 text-[10px] truncate">{from} • {new Date(gift.created_at).toLocaleString("pt-BR")}</div>
        {gift.message && <div className="text-white/80 text-[11px] italic truncate">"{gift.message}"</div>}
      </div>
      <button
        onClick={action.onClick}
        disabled={busy}
        className={`px-3 py-2 rounded-lg text-white text-xs font-extrabold disabled:opacity-50 ${action.cls}`}
      >
        {action.label}
      </button>
    </div>
  );
}
