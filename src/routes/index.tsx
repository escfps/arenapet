import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, ELEMENT_NAMES, RARITY_INFO, type Rarity, type Element } from "@/lib/game-data";
import { MonsterCard, type MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { toast, Toaster } from "sonner";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/")({
  component: PatioPage,
  head: () => ({
    meta: [
      { title: "ARENA PET — Colecione e batalhe" },
      { name: "description", content: "Treine monstrinhos e batalhe contra jogadores reais." },
    ],
  }),
});

const TEAM_MAX = 3;

function PatioPage() {
  const navigate = useNavigate();
  const { userId, profile, loading, reload } = useProfile();
  const [monsters, setMonsters] = useState<MonsterRow[]>([]);
  const [hatching, setHatching] = useState(false);

  const loadMonsters = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("monsters")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at");
    if (data) setMonsters(data as MonsterRow[]);
  }, [userId]);

  useEffect(() => { if (userId) loadMonsters(); }, [userId, loadMonsters]);

  async function pickStarter(speciesId: string) {
    if (!userId || hatching) return;
    setHatching(true);
    const sp = SPECIES[speciesId];
    const { error } = await supabase.from("monsters").insert({
      owner_id: userId,
      species: speciesId,
      name: sp.name,
      hp: sp.base.hp,
      atk: sp.base.atk,
      def: sp.base.def,
      spd: sp.base.spd,
      in_team: true,
    });
    setHatching(false);
    if (error) { toast.error("Erro ao escolher: " + error.message); return; }
    toast.success(`${sp.name} é seu! 🎉`);
    loadMonsters();
  }

  async function toggleTeam(m: MonsterRow) {
    if (!profile) return;
    const teamMax = TEAM_MAX;
    const teamCount = monsters.filter((x) => x.in_team).length;
    if (!m.in_team && teamCount >= teamMax) {
      toast.error(`Time cheio (${teamMax}).`);
      return;
    }
    const newVal = !m.in_team;
    setMonsters(monsters.map((x) => x.id === m.id ? { ...x, in_team: newVal } : x));
    await supabase.from("monsters").update({ in_team: newVal }).eq("id", m.id);
  }

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white text-xl">🌟 Carregando...</div>;
  }

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(30,10,60,0.65),rgba(30,10,60,0.85)),url(${arenaBg})` }}
    >
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />

      <div className="max-w-6xl mx-auto px-4 mt-6 space-y-6">
        {monsters.length === 0 ? (
          <section className="text-center text-white">
            <h1 className="text-3xl font-extrabold mb-2">🥚 Escolha seu primeiro monstro!</h1>
            <p className="text-white/80 mb-6 text-sm">Esse parceiro vai te acompanhar nas primeiras batalhas. Escolha com carinho.</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.values(SPECIES).map((sp) => (
                <button
                  key={sp.id}
                  onClick={() => pickStarter(sp.id)}
                  disabled={hatching}
                  className={`group rounded-2xl overflow-hidden border-2 border-white/30 hover:border-yellow-400 hover:scale-105 transition shadow-xl bg-gradient-to-br ${ELEMENT_COLORS[sp.element]}`}
                >
                  <div className="aspect-square p-2 flex items-center justify-center">
                    <img src={sp.image} alt={sp.name} className="h-full w-auto drop-shadow-2xl group-hover:scale-110 transition" loading="lazy" />
                  </div>
                  <div className="bg-card/95 backdrop-blur-sm p-2">
                    <div className="font-extrabold text-sm">{sp.emoji} {sp.name}</div>
                    <div className="text-[10px] text-muted-foreground">{ELEMENT_NAMES[sp.element]}</div>
                    <div className="text-[10px] mt-1 text-foreground/80">{sp.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h2 className="text-xl font-extrabold">🏠 Seu Pátio</h2>
                  <p className="text-xs opacity-80">
                    {monsters.length} monstro{monsters.length > 1 ? "s" : ""} • Time: {monsters.filter((m) => m.in_team).length}/{TEAM_MAX}
                  </p>
                </div>
                <button
                  onClick={() => navigate({ to: "/arena" })}
                  disabled={monsters.filter((m) => m.in_team).length === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-red-400 to-red-600 text-white font-extrabold shadow-lg hover:scale-105 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ⚔️ Ir pra Arena
                </button>
              </div>
              <p className="text-[11px] opacity-80">Toque num monstro pra cuidar dele. Toque no botão de TIME pra alternar quem batalha.</p>
            </section>

            <section>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {monsters.map((m) => (
                  <div key={m.id} className="space-y-2">
                    <MonsterCard
                      monster={m}
                      onClick={() => navigate({ to: "/monster/$id", params: { id: m.id } })}
                    />
                    <button
                      onClick={() => toggleTeam(m)}
                      className={`w-full text-[11px] font-bold rounded-lg py-1.5 transition ${
                        m.in_team
                          ? "bg-yellow-400 text-yellow-950 hover:bg-yellow-300"
                          : "bg-white/15 text-white hover:bg-white/25"
                      }`}
                    >
                      {m.in_team ? "✓ No time" : "+ Time"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
