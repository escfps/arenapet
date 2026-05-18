import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  SPECIES,
  ELEMENT_COLORS,
  ELEMENT_NAMES,
  ROLE_INFO,
  RARITY_INFO,
  type Rarity,
  type Element,
} from "@/lib/game-data";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/collection")({
  component: CollectionPage,
  head: () => ({
    meta: [{ title: "Coleção — ARENA PET" }],
  }),
});

type Filter = "all" | "owned" | "missing";
type RarityFilter = Rarity | "all";
type ElementFilter = Element | "all";

const ALL_RARITIES: Rarity[] = ["common", "rare", "super_rare", "epic", "legendary", "mythic"];
const ALL_ELEMENTS: Element[] = ["fire", "water", "grass", "electric", "shadow", "earth"];

function CollectionPage() {
  const navigate = useNavigate();
  const { userId, profile, loading } = useProfile();
  const [ownedSpecies, setOwnedSpecies] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [elementFilter, setElementFilter] = useState<ElementFilter>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("monsters")
      .select("species")
      .eq("owner_id", userId)
      .then(({ data }) => {
        if (data) setOwnedSpecies(new Set(data.map((m) => m.species)));
      });
  }, [userId]);

  const allSpecies = useMemo(() => Object.values(SPECIES), []);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allSpecies.filter((s) => {
      if (filter === "owned" && !ownedSpecies.has(s.id)) return false;
      if (filter === "missing" && ownedSpecies.has(s.id)) return false;
      if (rarityFilter !== "all" && s.rarity !== rarityFilter) return false;
      if (elementFilter !== "all" && s.element !== elementFilter && s.secondaryElement !== elementFilter) return false;
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allSpecies, ownedSpecies, filter, rarityFilter, elementFilter, search]);

  const ownedCount = ownedSpecies.size;
  const totalCount = allSpecies.length;
  const pct = Math.round((ownedCount / totalCount) * 100);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando...</div>;
  }

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(20,5,50,0.7),rgba(20,5,50,0.85)),url(${arenaBg})` }}
    >
      <HUD profile={profile} />

      <div className="max-w-5xl mx-auto px-4 mt-4 space-y-4">
        <button onClick={() => navigate({ to: "/" })} className="text-white/80 hover:text-white text-sm font-bold">
          ← Pátio
        </button>

        <header className="text-center text-white">
          <h1 className="text-4xl font-extrabold drop-shadow-lg">📖 Coleção</h1>
          <p className="opacity-80 text-sm mt-1">
            {ownedCount} / {totalCount} bichinhos descobertos ({pct}%)
          </p>
          <div className="max-w-md mx-auto mt-2 h-3 bg-black/40 rounded-full overflow-hidden border border-white/20">
            <div
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </header>

        {/* Filter tabs */}
        <div className="flex justify-center gap-2">
          {(["all", "owned", "missing"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-extrabold transition ${
                filter === f
                  ? "bg-yellow-400 text-yellow-950 shadow-lg"
                  : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              {f === "all" && `Todos (${totalCount})`}
              {f === "owned" && `Tenho (${ownedCount})`}
              {f === "missing" && `Faltam (${totalCount - ownedCount})`}
            </button>
          ))}
        </div>

        {/* Search + advanced filters */}
        <div className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 p-3 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Buscar pelo nome..."
            className="w-full px-4 py-2 rounded-full bg-white/10 text-white placeholder-white/50 text-sm font-bold border border-white/20 focus:outline-none focus:border-yellow-400"
          />

          <div className="space-y-1">
            <div className="text-white/70 text-[10px] font-extrabold uppercase tracking-wider px-1">Raridade</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setRarityFilter("all")}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                  rarityFilter === "all" ? "bg-yellow-400 text-yellow-950" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Todas
              </button>
              {ALL_RARITIES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRarityFilter(r)}
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                    rarityFilter === r
                      ? `${RARITY_INFO[r].color} ring-2 ${RARITY_INFO[r].ringColor}`
                      : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                >
                  {RARITY_INFO[r].emoji} {RARITY_INFO[r].name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-white/70 text-[10px] font-extrabold uppercase tracking-wider px-1">Elemento</div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setElementFilter("all")}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition ${
                  elementFilter === "all" ? "bg-yellow-400 text-yellow-950" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                Todos
              </button>
              {ALL_ELEMENTS.map((el) => (
                <button
                  key={el}
                  onClick={() => setElementFilter(el)}
                  className={`px-3 py-1 rounded-full text-[11px] font-extrabold text-white transition bg-gradient-to-r ${ELEMENT_COLORS[el]} ${
                    elementFilter === el ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  {ELEMENT_NAMES[el]}
                </button>
              ))}
            </div>
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-white/60 text-sm py-2">Nenhum bichinho com esses filtros.</div>
          )}
        </div>

        {/* Grid grouped by element */}
        <div className="space-y-6">
          {(["fire", "water", "grass", "electric", "shadow", "earth"] as Element[]).map((el) => {
            const list = filtered.filter((s) => s.element === el || s.secondaryElement === el);
            if (list.length === 0) return null;
            return (
              <section key={el}>
                <h2 className="text-white font-extrabold text-lg mb-2 flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-lg bg-gradient-to-r ${ELEMENT_COLORS[el]} text-white text-sm`}>
                    {ELEMENT_NAMES[el]}
                  </span>
                  <span className="text-white/60 text-xs">{list.length} espécies</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {list.map((sp) => (
                    <DexCard key={sp.id} sp={sp} owned={ownedSpecies.has(sp.id)} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 p-4 text-white text-xs space-y-2">
          <h3 className="font-extrabold text-sm">Legenda</h3>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(RARITY_INFO) as Rarity[]).map((r) => (
              <span key={r} className={`px-2 py-1 rounded ${RARITY_INFO[r].color} font-bold`}>
                {RARITY_INFO[r].emoji} {RARITY_INFO[r].name}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 pt-1">
            {Object.values(ROLE_INFO).map((r) => (
              <span key={r.name} className={`px-2 py-1 rounded ${r.color} text-white font-bold`}>
                {r.emoji} {r.name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function DexCard({ sp, owned }: { sp: (typeof SPECIES)[string]; owned: boolean }) {
  const gradient = ELEMENT_COLORS[sp.element];
  return (
    <div
      className={`relative rounded-2xl overflow-hidden border-2 shadow-xl transition ${
        owned ? `border-white/40 ring-2 ${RARITY_INFO[sp.rarity].ringColor}` : "border-white/10 opacity-90"
      }`}
      title={owned ? sp.description : "Ainda não descoberto"}
    >
      <span className={`absolute top-2 left-2 z-10 px-2 py-0.5 rounded-full ${RARITY_INFO[sp.rarity].color} text-[10px] font-extrabold shadow`}>
        {RARITY_INFO[sp.rarity].emoji}
      </span>
      <span className={`absolute top-2 right-2 z-10 px-2 py-0.5 rounded-full ${ROLE_INFO[sp.role].color} text-white text-[10px] font-extrabold shadow`}>
        {ROLE_INFO[sp.role].emoji}
      </span>

      <div className={`bg-gradient-to-br ${gradient} p-3 ${owned ? "" : "saturate-0 brightness-50"}`}>
        <div className="flex items-center justify-center h-28">
          <img
            src={sp.image}
            alt={owned ? sp.name : "???"}
            loading="lazy"
            className={`h-full w-auto object-contain drop-shadow-2xl transition ${
              owned ? "" : "brightness-0 opacity-70"
            }`}
          />
        </div>
      </div>

      <div className="p-2 bg-card/95 backdrop-blur-sm text-center">
        <div className={`font-extrabold text-sm truncate ${owned ? "" : "text-muted-foreground"}`}>
          {owned ? sp.name : "???"}
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {owned ? (
            <>
              {sp.emoji} {ELEMENT_NAMES[sp.element]}
              {sp.secondaryElement ? ` / ${ELEMENT_NAMES[sp.secondaryElement]}` : ""}
            </>
          ) : (
            "Espécie não descoberta"
          )}
        </div>
      </div>
    </div>
  );
}
