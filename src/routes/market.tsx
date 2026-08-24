import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import { SPECIES, RARITY_INFO, speciesImage, shinyFallbackFilter, CHESTS, type ChestTier } from "@/lib/game-data";
import { CHEST_ITEM_TYPE } from "@/lib/chest-inventory";
import { TYPE_INFO, type PokeType } from "@/lib/moves";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Mercado de Jogadores — Poke Arena" },
      { name: "description", content: "Compre e venda pokémons, baús, rações e insígnias com outros treinadores usando moedas ou diamantes. Taxa de 3% por venda." },
      { property: "og:title", content: "Mercado de Jogadores — Poke Arena" },
      { property: "og:description", content: "Anuncie pokémons, itens e insígnias por moedas ou diamantes e negocie com outros treinadores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MarketPage,
});

const FEE_PCT = 0.03;

type Listing = {
  id: string;
  seller_id: string;
  buyer_id: string | null;
  kind: "monster" | "item" | "badge";
  monster_id: string | null;
  item_type: string | null;
  gym_type: string | null;
  quantity: number;
  currency: "coins" | "gems";
  price: number;
  fee: number;
  status: "active" | "sold" | "cancelled";
  snapshot: Record<string, any>;
  created_at: string;
};

type Monster = {
  id: string; species: string; name: string; rank: number; is_shiny: boolean;
  in_team: boolean; hp: number; atk: number; def: number; spd: number;
};

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

function money(currency: "coins" | "gems", v: number) {
  return `${currency === "gems" ? "💎" : "🪙"} ${v.toLocaleString("pt-BR")}`;
}

function MarketPage() {
  const navigate = useNavigate();
  const { profile, userId, loading, reload } = useProfile();

  const [tab, setTab] = useState<"browse" | "sell" | "mine">("browse");
  const [listings, setListings] = useState<Listing[]>([]);
  const [mine, setMine] = useState<Listing[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [monsters, setMonsters] = useState<Monster[]>([]);
  const [items, setItems] = useState<Record<string, number>>({});
  const [badges, setBadges] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState<"all" | "monster" | "item" | "badge">("all");

  // form
  const [sellKind, setSellKind] = useState<"monster" | "item" | "badge">("monster");
  const [sellRef, setSellRef] = useState<string>("");
  const [sellQty, setSellQty] = useState(1);
  const [sellCurrency, setSellCurrency] = useState<"coins" | "gems">("coins");
  const [sellPrice, setSellPrice] = useState<string>("");

  const load = useCallback(async () => {
    if (!userId) return;
    const [all, m, inv, b] = await Promise.all([
      (supabase as any).from("market_listings").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("monsters").select("id, species, name, rank, is_shiny, in_team, hp, atk, def, spd").eq("owner_id", userId),
      supabase.from("inventory").select("item_type, quantity").eq("user_id", userId),
      supabase.from("gym_badges").select("gym_type").eq("user_id", userId),
    ]);
    const rows = ((all.data as Listing[]) ?? []);
    setListings(rows.filter((r) => r.status === "active" && r.seller_id !== userId));
    setMine(rows.filter((r) => r.seller_id === userId || r.buyer_id === userId));
    setMonsters(((m.data as Monster[]) ?? []));
    const map: Record<string, number> = {};
    ((inv.data as { item_type: string; quantity: number }[]) ?? []).forEach((r) => { map[r.item_type] = r.quantity; });
    setItems(map);
    setBadges(((b.data as { gym_type: string }[]) ?? []).map((x) => x.gym_type));

    const ids = Array.from(new Set(rows.map((r) => r.seller_id)));
    if (ids.length) {
      const { data } = await (supabase as any).from("public_profiles").select("id, username").in("id", ids);
      const nm: Record<string, string> = {};
      for (const p of (data as { id: string; username: string }[]) ?? []) nm[p.id] = p.username;
      setNames(nm);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const sellableMonsters = useMemo(() => monsters.filter((m) => !m.in_team), [monsters]);
  const sellableItems = useMemo(
    () => Object.entries(items).filter(([, q]) => q > 0),
    [items]
  );

  useEffect(() => {
    setSellRef("");
    setSellQty(1);
  }, [sellKind]);

  async function createListing() {
    const price = parseInt(sellPrice || "0", 10);
    if (!sellRef) { toast.error("Escolha o que você quer anunciar."); return; }
    if (!price || price < 1 || price > 100000) { toast.error("Preço deve ser entre 1 e 100.000."); return; }
    setBusy("create");
    try {
      const { error } = await (supabase as any).rpc("market_create_listing", {
        p_kind: sellKind,
        p_currency: sellCurrency,
        p_price: price,
        p_monster_id: sellKind === "monster" ? sellRef : null,
        p_item_type: sellKind === "item" ? sellRef : null,
        p_gym_type: sellKind === "badge" ? sellRef : null,
        p_quantity: sellKind === "item" ? sellQty : 1,
      });
      if (error) throw error;
      toast.success("📢 Anúncio publicado no mercado!");
      setSellRef(""); setSellPrice(""); setSellQty(1);
      await load();
      setTab("mine");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível anunciar");
    } finally { setBusy(null); }
  }

  async function buy(l: Listing) {
    setBusy(l.id);
    try {
      const { error } = await (supabase as any).rpc("market_buy", { p_id: l.id });
      if (error) throw error;
      toast.success("✅ Compra concluída!");
      await Promise.all([load(), reload()]);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível comprar");
    } finally { setBusy(null); }
  }

  async function cancel(l: Listing) {
    setBusy(l.id);
    try {
      const { error } = await (supabase as any).rpc("market_cancel_listing", { p_id: l.id });
      if (error) throw error;
      toast.success("Anúncio cancelado — item devolvido.");
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível cancelar");
    } finally { setBusy(null); }
  }

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  const shown = listings.filter((l) => filterKind === "all" || l.kind === filterKind);
  const previewPrice = parseInt(sellPrice || "0", 10) || 0;
  const previewFee = previewPrice ? Math.max(1, Math.round(previewPrice * FEE_PCT)) : 0;

  function ListingCard({ l, own }: { l: Listing; own: boolean }) {
    const sp = l.kind === "monster" ? SPECIES[l.snapshot?.species as string] : null;
    return (
      <div className="rounded-2xl bg-black/35 border border-white/15 p-3 text-white flex gap-3 items-center">
        <div className="w-16 h-16 shrink-0 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden">
          {l.kind === "monster" ? (
            <img
              src={speciesImage(l.snapshot?.species, !!l.snapshot?.is_shiny)}
              alt={l.snapshot?.name ?? "Pokémon"}
              className="w-full h-full object-contain"
              style={{ filter: shinyFallbackFilter(l.snapshot?.species, !!l.snapshot?.is_shiny) }}
            />
          ) : l.kind === "item" ? (
            <span className="text-3xl">{itemInfo(l.item_type ?? "").emoji}</span>
          ) : (
            <span className="text-3xl">{TYPE_INFO[l.gym_type as PokeType]?.emoji ?? "🎖️"}</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-sm truncate">
            {l.kind === "monster"
              ? `${l.snapshot?.is_shiny ? "✨ " : ""}${l.snapshot?.name ?? "Pokémon"}`
              : l.kind === "item"
                ? `${itemInfo(l.item_type ?? "").label} ×${l.quantity}`
                : `Insígnia de ${TYPE_INFO[l.gym_type as PokeType]?.name ?? l.gym_type}`}
          </div>
          <div className="text-[11px] opacity-75 truncate">
            {l.kind === "monster" && sp
              ? `${sp.name} • ${RARITY_INFO[sp.rarity].name} • ⭐${l.snapshot?.rank ?? 1} • ${l.snapshot?.hp}HP ${l.snapshot?.atk}ATK ${l.snapshot?.def}DEF ${l.snapshot?.spd}SPD`
              : `Vendedor: ${names[l.seller_id] ?? "Treinador"}`}
          </div>
          <div className="text-xs mt-1 font-extrabold text-yellow-300">{money(l.currency, l.price)}</div>
          {own && l.status !== "active" && (
            <div className="text-[11px] opacity-75">
              {l.status === "sold" ? `Vendido — taxa 3%: ${money(l.currency, l.fee)}` : "Cancelado"}
            </div>
          )}
        </div>

        {own ? (
          l.status === "active" ? (
            <button
              onClick={() => cancel(l)}
              disabled={busy === l.id}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-extrabold disabled:opacity-40"
            >
              Cancelar
            </button>
          ) : null
        ) : (
          <button
            onClick={() => buy(l)}
            disabled={busy === l.id}
            className="px-3 py-2 rounded-xl bg-gradient-to-b from-emerald-400 to-green-600 text-xs font-extrabold hover:scale-105 transition disabled:opacity-40"
          >
            {busy === l.id ? "..." : "Comprar"}
          </button>
        )}
      </div>
    );
  }

  return (
    <main
      className="min-h-screen pb-24 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(20,5,50,0.6),rgba(20,5,50,0.85)),url(${arenaBg})` }}
    >
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />

      <div className="max-w-3xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">← Home</button>

        <header className="text-center text-white">
          <h1 className="text-4xl font-extrabold drop-shadow-lg">🛒 Mercado</h1>
          <p className="text-sm opacity-80">Compre e venda pokémons, itens e insígnias com outros treinadores</p>
          <p className="text-[11px] opacity-70 mt-1">Taxa de <b>3%</b> descontada do vendedor em cada venda concluída</p>
        </header>

        <div className="flex gap-2">
          {([["browse", "🔎 Anúncios"], ["sell", "📢 Anunciar"], ["mine", "📋 Meus"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`flex-1 py-2 rounded-xl text-xs font-extrabold transition ${tab === k ? "bg-white text-violet-800" : "bg-white/15 text-white hover:bg-white/25"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "browse" && (
          <section className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {([["all", "Tudo"], ["monster", "🐾 Pokémons"], ["item", "📦 Itens"], ["badge", "🎖️ Insígnias"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setFilterKind(k)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${filterKind === k ? "bg-yellow-300 text-violet-900" : "bg-white/15 text-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {shown.length === 0 ? (
              <div className="rounded-2xl bg-white/10 border border-white/20 p-6 text-center text-white/80 text-sm">
                Nenhum anúncio por aqui ainda. Seja o primeiro a anunciar! 📢
              </div>
            ) : (
              shown.map((l) => <ListingCard key={l.id} l={l} own={false} />)
            )}
          </section>
        )}

        {tab === "sell" && (
          <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white space-y-3">
            <h2 className="font-extrabold text-lg">📢 Criar anúncio</h2>

            <div className="flex gap-2">
              {([["monster", "🐾 Pokémon"], ["item", "📦 Item"], ["badge", "🎖️ Insígnia"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setSellKind(k)}
                  className={`flex-1 py-2 rounded-xl text-xs font-extrabold ${sellKind === k ? "bg-yellow-300 text-violet-900" : "bg-black/30"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div>
              <label className="text-xs font-bold opacity-80">O que anunciar</label>
              <select
                value={sellRef}
                onChange={(e) => setSellRef(e.target.value)}
                className="w-full mt-1 p-2.5 rounded-xl bg-black/40 border border-white/20 text-sm"
              >
                <option value="">Selecione...</option>
                {sellKind === "monster" && sellableMonsters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.is_shiny ? "✨ " : ""}{m.name} — ⭐{m.rank} ({SPECIES[m.species]?.name ?? m.species})
                  </option>
                ))}
                {sellKind === "item" && sellableItems.map(([it, q]) => (
                  <option key={it} value={it}>{itemInfo(it).emoji} {itemInfo(it).label} (você tem {q})</option>
                ))}
                {sellKind === "badge" && badges.map((b) => (
                  <option key={b} value={b}>{TYPE_INFO[b as PokeType]?.emoji} Insígnia de {TYPE_INFO[b as PokeType]?.name ?? b}</option>
                ))}
              </select>
              {sellKind === "monster" && (
                <p className="text-[11px] opacity-70 mt-1">Pokémons do time não podem ser anunciados. Você precisa manter no mínimo 3 pokémons.</p>
              )}
              {sellKind === "badge" && (
                <p className="text-[11px] opacity-70 mt-1">A insígnia sai da sua conta enquanto o anúncio estiver ativo.</p>
              )}
            </div>

            {sellKind === "item" && (
              <div>
                <label className="text-xs font-bold opacity-80">Quantidade</label>
                <input
                  type="number" min={1} value={sellQty}
                  onChange={(e) => setSellQty(Math.max(1, parseInt(e.target.value || "1", 10)))}
                  className="w-full mt-1 p-2.5 rounded-xl bg-black/40 border border-white/20 text-sm"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold opacity-80">Moeda do anúncio</label>
              <div className="flex gap-2 mt-1">
                {([["coins", "🪙 Moedas"], ["gems", "💎 Diamantes"]] as const).map(([c, label]) => (
                  <button
                    key={c}
                    onClick={() => setSellCurrency(c)}
                    className={`flex-1 py-2 rounded-xl text-xs font-extrabold ${sellCurrency === c ? "bg-yellow-300 text-violet-900" : "bg-black/30"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-bold opacity-80">Preço (1 a 100.000)</label>
              <input
                type="number" min={1} max={100000} value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
                placeholder="Ex: 500"
                className="w-full mt-1 p-2.5 rounded-xl bg-black/40 border border-white/20 text-sm"
              />
              {previewPrice > 0 && (
                <p className="text-[11px] mt-1 opacity-80">
                  Taxa de 3%: <b>{money(sellCurrency, previewFee)}</b> • Você recebe <b className="text-emerald-300">{money(sellCurrency, previewPrice - previewFee)}</b>
                </p>
              )}
            </div>

            <button
              onClick={createListing}
              disabled={busy === "create"}
              className="w-full py-3 rounded-xl bg-gradient-to-b from-fuchsia-400 to-violet-600 font-extrabold hover:scale-[1.02] transition disabled:opacity-40"
            >
              {busy === "create" ? "Publicando..." : "📢 Publicar anúncio"}
            </button>
          </section>
        )}

        {tab === "mine" && (
          <section className="space-y-3">
            {mine.length === 0 ? (
              <div className="rounded-2xl bg-white/10 border border-white/20 p-6 text-center text-white/80 text-sm">
                Você ainda não tem anúncios.
              </div>
            ) : (
              mine.map((l) => <ListingCard key={l.id} l={l} own={l.seller_id === userId} />)
            )}
          </section>
        )}
      </div>
    </main>
  );
}
