import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, RARITY_INFO, MAX_RANK, rankStars, RANK_MULT } from "@/lib/game-data";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/forge")({
  component: ForgePage,
  head: () => ({ meta: [{ title: "Elevar — ARENA PET" }] }),
});

type ForgeMonster = {
  id: string;
  owner_id: string;
  species: string;
  name: string;
  rank: number;
  in_team: boolean;
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
      .select("id,owner_id,species,name,rank,in_team")
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
    const keep = available[0];
    const consume = available[1];
    const sp = SPECIES[group.species];
    const newRank = group.rank + 1;
    const ok = confirm(
      `Fundir 2x ${sp?.name} ${rankStars(group.rank)} → 1x ${sp?.name} ${rankStars(newRank)}?\n\n` +
      `Você vai PERDER "${consume.name}" permanentemente.\nO "${keep.name}" sobe pra ${rankStars(newRank)} (+${Math.round((RANK_MULT[newRank] / RANK_MULT[group.rank] - 1) * 100)}% stats).`
    );
    if (!ok) return;

    setFusing(true);
    const { error: delErr } = await supabase.from("monsters").delete().eq("id", consume.id);
    if (delErr) {
      setFusing(false);
      toast.error("Erro ao fundir: " + delErr.message);
      return;
    }
    const { error: updErr } = await supabase
      .from("monsters")
      .update({ rank: newRank })
      .eq("id", keep.id);
    setFusing(false);
    if (updErr) {
      toast.error("Erro ao upar rank: " + updErr.message);
      return;
    }
    toast.success(`🔨 ${keep.name} subiu para ${rankStars(newRank)}!`);
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
  const canFuse = available >= 2 && group.rank < MAX_RANK;
  return (
    <div className={`rounded-xl bg-gradient-to-br ${ELEMENT_COLORS[sp.element]} p-3 shadow-xl ring-2 ${RARITY_INFO[sp.rarity].ringColor}`}>
      <div className="flex items-center gap-3">
        <img src={sp.image} alt={sp.name} className="h-16 w-16 object-contain drop-shadow-xl" />
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-white text-sm truncate">{sp.name}</div>
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
