import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, RARITY_INFO, MAX_RANK, rankStars, RANK_MULT, speciesImage, shinyFallbackFilter } from "@/lib/game-data";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/forge")({
  component: ForgePage,
  head: () => ({ meta: [{ title: "Elevar — DUELO POKEMON" }] }),
});

type ForgeMonster = {
  id: string;
  owner_id: string;
  species: string;
  name: string;
  rank: number;
  in_team: boolean;
  is_shiny?: boolean | null;
};

function ForgePage() {
  const navigate = useNavigate();
  const { userId, profile, loading } = useProfile();
  const [monsters, setMonsters] = useState<ForgeMonster[]>([]);
  const [fusing, setFusing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("monsters")
      .select("id,owner_id,species,name,rank,in_team,is_shiny")
      .eq("owner_id", userId)
      .order("rank", { ascending: false });
    if (data) setMonsters(data as ForgeMonster[]);
  }, [userId]);

  useEffect(() => { if (userId) load(); }, [userId, load]);

  const groups = useMemo(() => {
    const g = new Map<string, ForgeMonster[]>();
    for (const m of monsters) {
      const key = `${m.species}__${m.rank}`;
      if (!g.has(key)) g.set(key, []);
      g.get(key)!.push(m);
    }
    return Array.from(g.entries())
      .map(([key, list]) => {
        const [species, rankStr] = key.split("__");
        return { species, rank: parseInt(rankStr, 10), list };
      })
      .sort((a, b) => {
        if (b.list.length !== a.list.length) return b.list.length - a.list.length;
        return b.rank - a.rank;
      });
  }, [monsters]);

  const fusable = groups.filter((g) => g.list.length >= 2 && g.rank < MAX_RANK);
  const others = groups.filter((g) => !(g.list.length >= 2 && g.rank < MAX_RANK));

  async function fuse(group: { species: string; rank: number; list: ForgeMonster[] }) {
    if (fusing) return;
    const available = group.list.filter((m) => !m.in_team);
    if (available.length < 2) {
      toast.error("Tire os bichinhos do time antes de fundir!");
      return;
    }
    // Preserva sempre o SHINY: shiny vira o "keep", não-shiny é consumido primeiro.
    const shinySorted = [...available].sort((a, b) => Number(b.is_shiny === true) - Number(a.is_shiny === true));
    const keep = shinySorted[0];
    const consume = [...shinySorted].reverse().find((m) => m.id !== keep.id)!;
    const keepShiny = keep.is_shiny === true || consume.is_shiny === true;
    const sp = SPECIES[group.species];
    const newRank = group.rank + 1;


    setFusing(true);
    try {
      const res = await fuseFn({ data: { species: group.species, rank: group.rank } });
      toast.success(`${res.shiny ? "✨" : "🔨"} ${res.name} subiu para ${rankStars(res.rank)}!${res.shiny ? " (Shiny mantido)" : ""}`);
    } catch (e: any) {
      toast.error((e as Error).message ?? "Erro ao fundir");
      setFusing(false);
      return;
    }
    setFusing(false);
    void newRank; void keep; void keepShiny; void sp;
    load();
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
        <main className="max-w-5xl mx-auto p-4 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-white drop-shadow">🔨 Elevar Pets</h1>
            <p className="text-purple-100/90 text-sm mt-1">
              Junte 2 bichinhos iguais no mesmo ✦ para subir 1 rank. Máximo ✦{MAX_RANK}.
            </p>
            <p className="text-purple-200/70 text-[11px] mt-1">
              ✦1 → ✦2 (2 bichinhos) • ✦9 → ✦10 (precisa de 512 bichinhos base!)
            </p>
          </div>

          <section>
            <h2 className="text-xl font-extrabold text-white mb-3 drop-shadow">✅ Prontos para fundir ({fusable.length})</h2>
            {fusable.length === 0 ? (
              <div className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-6 text-center text-white/80 text-sm">
                Nenhum par disponível. Pegue ovos na Loja pra duplicar espécies!
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {fusable.map((g) => (
                  <FuseCard key={`${g.species}-${g.rank}`} group={g} onFuse={() => fuse(g)} disabled={fusing} />
                ))}
              </div>
            )}
          </section>

          {others.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-white/90 mb-2">Outros bichinhos</h2>
              <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                {others.map((g) => (
                  <OtherCard key={`${g.species}-${g.rank}`} group={g} />
                ))}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function FuseCard({ group, onFuse, disabled }: { group: { species: string; rank: number; list: ForgeMonster[] }; onFuse: () => void; disabled: boolean }) {
  const sp = SPECIES[group.species];
  if (!sp) return null;
  const inTeam = group.list.filter((m) => m.in_team).length;
  const available = group.list.length - inTeam;
  const hasShiny = group.list.some((m) => m.is_shiny === true);
  const canFuse = available >= 2 && group.rank < MAX_RANK;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${ELEMENT_COLORS[sp.element]} p-3 shadow-xl ring-2 ${RARITY_INFO[sp.rarity].ringColor}`}>
      <div className="flex items-center gap-3">
        <img src={speciesImage(group.species, hasShiny)} alt={sp.name} className="h-16 w-16 object-contain drop-shadow-xl" style={{ filter: shinyFallbackFilter(group.species, hasShiny) }} />
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-white text-sm truncate">{hasShiny ? "✨ " : ""}{sp.name}</div>
          {hasShiny && <div className="text-[10px] font-bold text-yellow-200">Shiny é preservado na fusão</div>}
          <div className="text-[10px] text-white/90">
            {group.list.length}× no rank atual
            {inTeam > 0 && <span className="text-yellow-200"> ({inTeam} no time)</span>}
          </div>
          <div className="text-[11px] font-bold text-amber-100 mt-0.5">
            {rankStars(group.rank)} → {rankStars(group.rank + 1)}
          </div>
        </div>
      </div>
      <button
        onClick={onFuse}
        disabled={disabled || !canFuse}
        className="mt-2 w-full py-1.5 rounded-lg bg-black/40 hover:bg-black/60 disabled:opacity-50 text-white text-xs font-extrabold transition"
      >
        {canFuse ? `🔨 Fundir (+${Math.round((RANK_MULT[group.rank + 1] / RANK_MULT[group.rank] - 1) * 100)}% stats)` : "Tire do time"}
      </button>
    </div>
  );
}

function OtherCard({ group }: { group: { species: string; rank: number; list: ForgeMonster[] } }) {
  const sp = SPECIES[group.species];
  if (!sp) return null;
  return (
    <div className="rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 p-2 flex items-center gap-2">
      <img src={sp.image} alt={sp.name} className="h-10 w-10 object-contain" />
      <div className="flex-1 min-w-0">
        <div className="text-white text-xs font-bold truncate">{sp.name}</div>
        <div className="text-[10px] text-white/70">
          {group.list.length}× {rankStars(group.rank)}
          {group.rank >= MAX_RANK && <span className="text-amber-300"> MÁX</span>}
        </div>
      </div>
    </div>
  );
}
