import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, ELEMENT_COLORS, ELEMENT_NAMES, RARITY_INFO, rollWelcomeChest, starterMonsterStats, type Rarity, type Element } from "@/lib/game-data";
import { MonsterCard, type MonsterRow } from "@/components/MonsterCard";
import { HUD } from "@/components/HUD";
import { TutorialOverlay } from "@/components/TutorialOverlay";
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
const ALL_RARITIES: Rarity[] = ["common", "rare", "super_rare", "epic", "legendary", "mythic"];
const ALL_ELEMENTS: Element[] = ["fire", "water", "grass", "electric", "shadow", "earth"];

function PatioPage() {
  const navigate = useNavigate();
  const { userId, profile, loading, reload } = useProfile();
  const [monsters, setMonsters] = useState<MonsterRow[]>([]);
  const [hatching, setHatching] = useState(false);
  const [welcomeReveal, setWelcomeReveal] = useState<string[] | null>(null);
  const [search, setSearch] = useState("");
  const [rarityFilter, setRarityFilter] = useState<Rarity | "all">("all");
  const [elementFilter, setElementFilter] = useState<Element | "all">("all");
  const [groupModal, setGroupModal] = useState<string | null>(null);
  const [slotPicker, setSlotPicker] = useState<number | null>(null);
  const [showTutorial, setShowTutorial] = useState(false);

  // Mostra tutorial após o baú ser aberto (uma vez por conta)
  useEffect(() => {
    if (!userId || !profile) return;
    if (!profile.welcome_chest_claimed) return;
    if (welcomeReveal) return; // ainda mostrando os pets do baú
    const done = localStorage.getItem(`tutorial_done_${userId}`);
    if (!done) setShowTutorial(true);
  }, [userId, profile, welcomeReveal]);

  const loadMonsters = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from("monsters")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at");
    if (!data) return;
    let list = data as MonsterRow[];
    // 🛡️ Normalizar time: garantir no máx TEAM_MAX pets in_team, sem posições duplicadas.
    const inTeam = list.filter((m) => m.in_team);
    const needsFix = inTeam.length > TEAM_MAX ||
      new Set(inTeam.map((m) => m.team_position ?? 0)).size !== inTeam.length;
    if (needsFix) {
      const sorted = [...inTeam].sort((a, b) => (a.team_position ?? 0) - (b.team_position ?? 0));
      const keep = sorted.slice(0, TEAM_MAX);
      const drop = sorted.slice(TEAM_MAX);
      const updates: { id: string; in_team: boolean; team_position: number }[] = [];
      keep.forEach((m, idx) => {
        if ((m.team_position ?? -1) !== idx || !m.in_team) {
          updates.push({ id: m.id, in_team: true, team_position: idx });
        }
      });
      drop.forEach((m) => updates.push({ id: m.id, in_team: false, team_position: 0 }));
      for (const u of updates) {
        await supabase.from("monsters").update({ in_team: u.in_team, team_position: u.team_position }).eq("id", u.id);
      }
      list = list.map((m) => {
        const u = updates.find((x) => x.id === m.id);
        return u ? { ...m, in_team: u.in_team, team_position: u.team_position } : m;
      });
    }
    setMonsters(list);
  }, [userId]);


  useEffect(() => { if (userId) loadMonsters(); }, [userId, loadMonsters]);

  const filteredMonsters = useMemo(() => {
    const q = search.trim().toLowerCase();
    return monsters.filter((m) => {
      const sp = SPECIES[m.species];
      if (!sp) return true;
      if (rarityFilter !== "all" && sp.rarity !== rarityFilter) return false;
      if (elementFilter !== "all" && sp.element !== elementFilter && sp.secondaryElement !== elementFilter) return false;
      if (q) {
        const hay = `${m.name ?? ""} ${sp.name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [monsters, search, rarityFilter, elementFilter]);

  const groupedSpecies = useMemo(() => {
    const map = new Map<string, MonsterRow[]>();
    for (const m of filteredMonsters) {
      if (!map.has(m.species)) map.set(m.species, []);
      map.get(m.species)!.push(m);
    }
    return Array.from(map.entries()).map(([species, list]) => {
      const sorted = [...list].sort((a, b) => {
        if (a.in_team !== b.in_team) return a.in_team ? -1 : 1;
        return (b.rank ?? 1) - (a.rank ?? 1);
      });
      return { species, list: sorted, rep: sorted[0], teamCount: list.filter((x) => x.in_team).length };
    });
  }, [filteredMonsters]);

  const groupModalList = groupModal ? (groupedSpecies.find((g) => g.species === groupModal)?.list ?? []) : [];

  async function openWelcomeChest() {
    if (!userId || !profile || hatching) return;
    if (profile.welcome_chest_claimed) {
      toast.error("Você já abriu seu baú de boas-vindas.");
      return;
    }
    setHatching(true);
    const speciesIds = rollWelcomeChest();
    const rows = speciesIds.map((id, idx) => {
      const sp = SPECIES[id];
      return {
        owner_id: userId,
        species: id,
        name: sp.name,
        ...starterMonsterStats(id),
        in_team: idx < TEAM_MAX,
        team_position: idx < TEAM_MAX ? idx : 0,
      };
    });
    const { error: insErr } = await supabase.from("monsters").insert(rows);
    if (insErr) {
      setHatching(false);
      toast.error("Erro ao abrir baú: " + insErr.message);
      return;
    }
    const { error: updErr } = await supabase
      .from("profiles")
      .update({ welcome_chest_claimed: true })
      .eq("id", userId);
    setHatching(false);
    if (updErr) {
      toast.error("Baú aberto, mas falhou ao registrar: " + updErr.message);
    }
    await reload();
    await loadMonsters();
    setWelcomeReveal(speciesIds);
    toast.success("Baú de boas-vindas aberto! 🎁");
  }


  const PILLS = ["🛡️ Frente", "⚔️ Meio", "🏹 Trás"] as const;

  async function setSlot(m: MonsterRow, slot: number) {
    if (!profile) return;
    // If another monster occupies that slot, swap
    const occupant = monsters.find((x) => x.in_team && x.team_position === slot && x.id !== m.id);
    // 🚫 Bloquear espécie duplicada no time (ignora o ocupante do slot, que vai sair)
    const duplicate = monsters.find(
      (x) => x.in_team && x.id !== m.id && x.id !== occupant?.id && x.species === m.species,
    );
    if (duplicate) {
      toast.error(`Você já tem um ${m.name || m.species} no time. Só 1 de cada espécie!`);
      return;
    }
    // 🛡️ Se m ainda não está no time e o slot está vazio, verificar limite
    if (!m.in_team && !occupant) {
      const currentTeam = monsters.filter((x) => x.in_team).length;
      if (currentTeam >= TEAM_MAX) {
        toast.error(`Time cheio (${TEAM_MAX}). Remova um pet antes.`);
        return;
      }
    }
    const updates: { id: string; in_team: boolean; team_position: number }[] = [
      { id: m.id, in_team: true, team_position: slot },
    ];
    if (occupant) {
      // give occupant the old position of m if m was in team, else mark as removed
      if (m.in_team) {
        updates.push({ id: occupant.id, in_team: true, team_position: m.team_position ?? slot });
      } else {
        updates.push({ id: occupant.id, in_team: false, team_position: 0 });
      }
    }
    setMonsters(monsters.map((x) => {
      const u = updates.find((u) => u.id === x.id);
      return u ? { ...x, in_team: u.in_team, team_position: u.team_position } : x;
    }));
    for (const u of updates) {
      await supabase.from("monsters").update({ in_team: u.in_team, team_position: u.team_position }).eq("id", u.id);
    }
  }


  async function toggleTeam(m: MonsterRow) {
    if (!profile) return;
    const teamMembers = monsters.filter((x) => x.in_team);
    if (!m.in_team) {
      if (teamMembers.length >= TEAM_MAX) {
        toast.error(`Time cheio (${TEAM_MAX}).`);
        return;
      }
      // 🚫 Bloquear espécie duplicada no time
      if (teamMembers.some((x) => x.species === m.species)) {
        toast.error(`Você já tem um ${m.name || m.species} no time. Só 1 de cada espécie!`);
        return;
      }
      const used = new Set(teamMembers.map((x) => x.team_position ?? 0));
      let slot = 0;
      while (slot < TEAM_MAX && used.has(slot)) slot += 1;
      await setSlot(m, slot);
      return;
    }
    setMonsters(monsters.map((x) => x.id === m.id ? { ...x, in_team: false } : x));
    await supabase.from("monsters").update({ in_team: false }).eq("id", m.id);
  }


  async function swapPositions(slotA: number, slotB: number) {
    const a = monsters.find((x) => x.in_team && (x.team_position ?? 0) === slotA);
    const b = monsters.find((x) => x.in_team && (x.team_position ?? 0) === slotB);
    if (!a) return;
    setMonsters(monsters.map((x) => {
      if (a && x.id === a.id) return { ...x, team_position: slotB };
      if (b && x.id === b.id) return { ...x, team_position: slotA };
      return x;
    }));
    await supabase.from("monsters").update({ team_position: slotB }).eq("id", a.id);
    if (b) await supabase.from("monsters").update({ team_position: slotA }).eq("id", b.id);
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
              <p className="text-[11px] opacity-80">Posicione mages/healers à <b>esquerda (Trás)</b>, DPS no <b>Meio</b> e tank à <b>direita (Frente)</b>. Arraste pra trocar ou use ◀ ▶.</p>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {[2, 1, 0].map((i) => {
                  const m = monsters.find((x) => x.in_team && (x.team_position ?? 0) === i);
                  if (!m) {
                    return (
                      <button
                        key={`slot-${i}`}
                        onClick={() => setSlotPicker(i)}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-2","ring-yellow-300"); }}
                        onDragLeave={(e) => e.currentTarget.classList.remove("ring-2","ring-yellow-300")}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove("ring-2","ring-yellow-300");
                          const from = Number(e.dataTransfer.getData("text/plain"));
                          if (!Number.isNaN(from) && from !== i) swapPositions(from, i);
                        }}
                        className="aspect-square rounded-2xl border-2 border-dashed border-white/30 bg-white/5 hover:bg-white/15 hover:border-yellow-300 transition flex flex-col items-center justify-center text-white/60"
                      >
                        <div className="text-[10px] font-extrabold opacity-80">{PILLS[i]}</div>
                        <span className="text-3xl mt-1">＋</span>
                        <span className="text-[10px] font-bold">Adicionar</span>
                      </button>
                    );
                  }
                  const sp = SPECIES[m.species];
                  // Visual order is reversed: leftmost is "Trás" (i=2), rightmost is "Frente" (i=0).
                  // ◀ moves visually left (toward backline → higher index).
                  // ▶ moves visually right (toward frontline → lower index).
                  const canMoveLeft = i < TEAM_MAX - 1;   // can increase position number
                  const canMoveRight = i > 0;             // can decrease position number
                  return (
                    <div
                      key={m.id}
                      draggable
                      onDragStart={(e) => { e.dataTransfer.setData("text/plain", String(i)); e.dataTransfer.effectAllowed = "move"; }}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("ring-4","ring-yellow-300"); }}
                      onDragLeave={(e) => e.currentTarget.classList.remove("ring-4","ring-yellow-300")}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("ring-4","ring-yellow-300");
                        const from = Number(e.dataTransfer.getData("text/plain"));
                        if (!Number.isNaN(from) && from !== i) swapPositions(from, i);
                      }}
                      className={`relative aspect-square rounded-2xl border-2 border-yellow-300 bg-gradient-to-br ${ELEMENT_COLORS[sp.element]} shadow-lg overflow-hidden cursor-grab active:cursor-grabbing`}
                    >
                      <div className="absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded-md bg-black/70 text-yellow-300 text-[9px] font-extrabold shadow">
                        {PILLS[i]}
                      </div>
                      <button
                        onClick={() => navigate({ to: "/monster/$id", params: { id: m.id } })}
                        className="absolute inset-0 flex items-center justify-center p-2"
                        title={m.name}
                      >
                        <img src={sp.image} alt={sp.name} className="h-full w-auto drop-shadow-2xl pointer-events-none" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-black/70 px-1 py-0.5 text-white text-[10px] font-extrabold truncate text-center pointer-events-none">
                        {m.name}
                      </div>
                      <button
                        onClick={() => toggleTeam(m)}
                        className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-red-500 hover:bg-red-400 text-white text-xs font-black shadow-lg flex items-center justify-center"
                        title="Remover do time"
                      >
                        ×
                      </button>
                      <div className="absolute inset-x-0 bottom-6 flex justify-between px-1 z-10">
                        {canMoveLeft ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); swapPositions(i, i + 1); }}
                            className="w-6 h-6 rounded-full bg-black/70 hover:bg-yellow-400 hover:text-yellow-950 text-white text-xs font-black flex items-center justify-center shadow"
                            title="Mover pra trás"
                          >◀</button>
                        ) : <span />}
                        {canMoveRight ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); swapPositions(i, i - 1); }}
                            className="w-6 h-6 rounded-full bg-black/70 hover:bg-yellow-400 hover:text-yellow-950 text-white text-xs font-black flex items-center justify-center shadow"
                            title="Mover pra frente"
                          >▶</button>
                        ) : <span />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>




            <section className="bg-black/40 backdrop-blur-md rounded-2xl border border-white/20 p-3 space-y-3">
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
            </section>

            <section>
              {filteredMonsters.length === 0 ? (
                <div className="text-center text-white/70 text-sm py-8">Nenhum monstro com esses filtros.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {groupedSpecies.map((g) => {
                    const count = g.list.length;
                    const handleCardClick = () => {
                      if (count === 1) navigate({ to: "/monster/$id", params: { id: g.rep.id } });
                      else setGroupModal(g.species);
                    };
                    return (
                      <div key={g.species} className="space-y-2">
                        <div className="relative">
                          <MonsterCard monster={g.rep} onClick={handleCardClick} />
                          {count > 1 && (
                            <div className="absolute top-2 right-2 z-10 px-2 py-1 rounded-lg bg-black/80 text-yellow-300 text-xs font-extrabold border border-yellow-300/50 shadow-lg pointer-events-none">
                              x{count}
                            </div>
                          )}
                        </div>
                        {count === 1 ? (
                          <button
                            onClick={() => toggleTeam(g.rep)}
                            className={`w-full text-[11px] font-bold rounded-lg py-1.5 transition ${
                              g.rep.in_team
                                ? "bg-yellow-400 text-yellow-950 hover:bg-yellow-300"
                                : "bg-white/15 text-white hover:bg-white/25"
                            }`}
                          >
                            {g.rep.in_team ? "✓ No time" : "+ Time"}
                          </button>
                        ) : (
                          <button
                            onClick={() => setGroupModal(g.species)}
                            className="w-full text-[11px] font-bold rounded-lg py-1.5 transition bg-white/15 text-white hover:bg-white/25"
                          >
                            Ver todos ({g.teamCount}/{count} no time)
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
      </div>

      {slotPicker !== null && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSlotPicker(null)}>
          <div className="max-w-3xl w-full max-h-[85vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-white/20 shadow-2xl p-5 text-white animate-in zoom-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">⚔️ Pet pra {PILLS[slotPicker]}</h2>
              <button onClick={() => setSlotPicker(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            {monsters.filter((m) => !m.in_team).length === 0 ? (
              <p className="text-center text-white/60 py-6 text-sm">Todos os seus pets já estão no time.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {monsters.filter((m) => !m.in_team).map((m) => (
                  <MonsterCard
                    key={m.id}
                    monster={m}
                    onClick={async () => { await setSlot(m, slotPicker); setSlotPicker(null); }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {groupModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in" onClick={() => setGroupModal(null)}>
          <div className="max-w-3xl w-full max-h-[85vh] overflow-y-auto rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-white/20 shadow-2xl p-5 text-white animate-in zoom-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-extrabold">
                {SPECIES[groupModal]?.emoji} {SPECIES[groupModal]?.name}
                <span className="ml-2 text-sm font-bold text-white/60">x{groupModalList.length}</span>
              </h2>
              <button onClick={() => setGroupModal(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {groupModalList.map((m) => (
                <div key={m.id} className="space-y-2">
                  <MonsterCard
                    monster={m}
                    onClick={() => { setGroupModal(null); navigate({ to: "/monster/$id", params: { id: m.id } }); }}
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
          </div>
        </div>
      )}

      {!profile.welcome_chest_claimed && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="max-w-2xl w-full rounded-3xl bg-gradient-to-br from-purple-900 via-fuchsia-900 to-amber-900 border-4 border-yellow-300 shadow-2xl p-6 text-center text-white animate-in zoom-in">
            {!welcomeReveal ? (
              <>
                <div className="text-7xl mb-2 animate-bounce">🎁</div>
                <h2 className="text-3xl font-black drop-shadow-lg">Baú de Boas-Vindas!</h2>
                <p className="text-white/90 mt-2 text-sm">
                  Bem-vindo à <b>ARENA PET</b>! Abra seu baú de cadastro e ganhe<br />
                  <b>2 bichinhos comuns</b> + <b>1 raro</b> totalmente aleatórios.
                </p>
                <button
                  onClick={openWelcomeChest}
                  disabled={hatching}
                  className="mt-5 px-8 py-4 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 text-yellow-950 font-black text-xl shadow-2xl hover:scale-105 transition disabled:opacity-60 disabled:cursor-wait border-4 border-yellow-200"
                >
                  {hatching ? "Abrindo..." : "🎁 Abrir Baú"}
                </button>
                <p className="text-[11px] opacity-70 mt-3">⚠️ Apenas 1 baú por conta</p>
              </>
            ) : (
              <>
                <div className="text-sm font-bold opacity-90">VOCÊ GANHOU</div>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {welcomeReveal.map((id) => {
                    const sp = SPECIES[id];
                    return (
                      <div key={id} className={`rounded-2xl overflow-hidden border-2 border-white/40 bg-gradient-to-br ${ELEMENT_COLORS[sp.element]} shadow-xl`}>
                        <div className="aspect-square flex items-center justify-center p-2">
                          <img src={sp.image} alt={sp.name} className="h-full w-auto drop-shadow-2xl" />
                        </div>
                        <div className="bg-card/95 p-2 text-center">
                          <div className="font-extrabold text-xs truncate">{sp.emoji} {sp.name}</div>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full ${RARITY_INFO[sp.rarity].color} text-[9px] font-extrabold`}>
                            {RARITY_INFO[sp.rarity].emoji} {RARITY_INFO[sp.rarity].name}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => setWelcomeReveal(null)}
                  className="mt-5 px-6 py-2.5 rounded-xl bg-yellow-300 text-yellow-950 font-extrabold hover:bg-yellow-200 transition shadow-lg"
                >
                  Vamos lá! 🚀
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showTutorial && userId && (
        <TutorialOverlay userId={userId} onClose={() => setShowTutorial(false)} />
      )}
    </main>
  );
}
