import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/tournament")({
  component: TournamentPage,
});

type Tournament = {
  id: string;
  slot_at: string;
  status: "open" | "finished";
  champion_id: string | null;
  finished_at: string | null;
};

type Entry = {
  id: string;
  tournament_id: string;
  user_id: string;
  is_bot: boolean;
  seed: number | null;
  power: number | null;
  eliminated_round: number | null;
};

type Match = {
  id: string;
  tournament_id: string;
  round: number;
  slot: number;
  p1_id: string | null;
  p2_id: string | null;
  winner_id: string | null;
  score: string | null;
};

type ProfileLite = { id: string; username: string; is_bot: boolean };

const ROUND_NAMES: Record<number, string> = {
  1: "Oitavas de Final",
  2: "Quartas de Final",
  3: "Semifinal",
  4: "Final",
};

function fmtCountdown(ms: number) {
  if (ms <= 0) return "00:00";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function TournamentPage() {
  const { userId, profile, patch } = useProfile();
  const [openT, setOpenT] = useState<Tournament | null>(null);
  const [lastT, setLastT] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [profs, setProfs] = useState<Record<string, ProfileLite>>({});
  const [champs, setChamps] = useState<Array<{ user_id: string; wins: number; last_win_at: string; username: string }>>([]);
  const [joining, setJoining] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [tab, setTab] = useState<"current" | "last" | "leaderboard">("current");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  async function refresh() {
    // Próximo torneio aberto
    const { data: openRows } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", "open")
      .order("slot_at", { ascending: true })
      .limit(1);
    const open = (openRows?.[0] as Tournament | undefined) ?? null;
    setOpenT(open);

    // Último finalizado
    const { data: lastRows } = await supabase
      .from("tournaments")
      .select("*")
      .eq("status", "finished")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(1);
    const last = (lastRows?.[0] as Tournament | undefined) ?? null;
    setLastT(last);

    // Entries e matches dos dois torneios relevantes
    const ids = [open?.id, last?.id].filter(Boolean) as string[];
    if (ids.length > 0) {
      const [{ data: ents }, { data: ms }] = await Promise.all([
        supabase.from("tournament_entries").select("*").in("tournament_id", ids),
        supabase.from("tournament_matches").select("*").in("tournament_id", ids),
      ]);
      setEntries((ents as Entry[]) ?? []);
      setMatches((ms as Match[]) ?? []);

      const userIds = new Set<string>();
      (ents as Entry[] | null)?.forEach((e) => userIds.add(e.user_id));
      (ms as Match[] | null)?.forEach((m) => {
        if (m.p1_id) userIds.add(m.p1_id);
        if (m.p2_id) userIds.add(m.p2_id);
      });
      if (last?.champion_id) userIds.add(last.champion_id);
      if (userIds.size > 0) {
        const { data: ps } = await supabase
          .from("profiles")
          .select("id, username, is_bot")
          .in("id", Array.from(userIds));
        const map: Record<string, ProfileLite> = {};
        (ps as ProfileLite[] | null)?.forEach((p) => (map[p.id] = p));
        setProfs((prev) => ({ ...prev, ...map }));
      }
    } else {
      setEntries([]);
      setMatches([]);
    }

    // Hall dos campeões
    const { data: cs } = await supabase
      .from("tournament_champions")
      .select("user_id, wins, last_win_at")
      .order("wins", { ascending: false })
      .limit(50);
    if (cs && cs.length > 0) {
      const { data: ps } = await supabase
        .from("profiles")
        .select("id, username")
        .in("id", cs.map((c) => c.user_id));
      const nameMap = new Map((ps ?? []).map((p) => [p.id as string, p.username as string]));
      setChamps(
        cs.map((c) => ({
          user_id: c.user_id as string,
          wins: c.wins as number,
          last_win_at: c.last_win_at as string,
          username: nameMap.get(c.user_id as string) ?? "Treinador",
        }))
      );
    } else {
      setChamps([]);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  const openSlotMs = openT ? new Date(openT.slot_at).getTime() : 0;
  const closesAtMs = openSlotMs + 60_000;
  const closesIn = closesAtMs - now;
  const startsIn = openSlotMs - now;
  const isRegistering = openT && now >= openSlotMs && now < closesAtMs;
  const myEntry = openT && userId ? entries.find((e) => e.tournament_id === openT.id && e.user_id === userId) : null;
  const openEntries = openT ? entries.filter((e) => e.tournament_id === openT.id) : [];

  async function join() {
    if (!openT || joining) return;
    if (!profile || (profile.gems ?? 0) < 1) {
      toast.error("Você precisa de 1 💎 pra entrar");
      return;
    }
    setJoining(true);
    const { error } = await supabase.rpc("join_tournament", { p_tournament_id: openT.id });
    setJoining(false);
    if (error) {
      toast.error(error.message ?? "Não foi possível inscrever");
      return;
    }
    patch?.({ gems: (profile.gems ?? 0) - 1 });
    toast.success("Inscrito na copa! 🏆");
    void refresh();
  }

  const lastBracket = useMemo(() => {
    if (!lastT) return null;
    const ms = matches.filter((m) => m.tournament_id === lastT.id);
    const grouped: Record<number, Match[]> = {};
    ms.forEach((m) => {
      grouped[m.round] = grouped[m.round] ?? [];
      grouped[m.round].push(m);
    });
    Object.values(grouped).forEach((arr) => arr.sort((a, b) => a.slot - b.slot));
    return grouped;
  }, [lastT, matches]);

  const pName = (id?: string | null) => (id ? profs[id]?.username ?? "…" : "—");
  const pIsBot = (id?: string | null) => (id ? profs[id]?.is_bot ?? false : false);

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-white">Carregando…</div>;
  }

  return (
    <div className="min-h-screen relative" style={{ backgroundImage: `url(${arenaBg})`, backgroundSize: "cover", backgroundPosition: "center" }}>
      <div className="absolute inset-0 bg-gradient-to-b from-purple-950/85 via-indigo-950/85 to-slate-950/90" />
      <div className="relative">
        <Toaster position="top-center" richColors />
        <HUD profile={profile} />
        <main className="max-w-5xl mx-auto px-3 py-4 space-y-4">
          <div className="text-center text-white">
            <h1 className="text-3xl font-extrabold drop-shadow-lg">🏆 Copa Pet</h1>
            <p className="text-sm opacity-80">Torneios de 32 a cada 10 minutos • MD3 até o campeão</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 justify-center">
            {([
              ["current", "📥 Inscrição"],
              ["last", "🥇 Última Copa"],
              ["leaderboard", "👑 Campeões"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                  tab === k ? "bg-yellow-400 text-yellow-950" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "current" && (
            <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
              {!openT ? (
                <div className="text-center text-sm opacity-80">Carregando próxima copa…</div>
              ) : (
                <>
                  <div className="text-center">
                    <div className="text-xs opacity-80">Próxima copa</div>
                    <div className="text-2xl font-extrabold">
                      {new Date(openT.slot_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    {isRegistering ? (
                      <div className="mt-2 inline-block px-3 py-1 rounded-full bg-emerald-500/80 text-xs font-extrabold animate-pulse">
                        🟢 INSCRIÇÕES ABERTAS — fecham em {fmtCountdown(closesIn)}
                      </div>
                    ) : startsIn > 0 ? (
                      <div className="mt-2 inline-block px-3 py-1 rounded-full bg-amber-500/80 text-xs font-extrabold">
                        ⏳ Abre em {fmtCountdown(startsIn)}
                      </div>
                    ) : (
                      <div className="mt-2 inline-block px-3 py-1 rounded-full bg-red-500/80 text-xs font-extrabold">
                        🔒 Inscrições encerradas
                      </div>
                    )}
                  </div>


                  <div className="mt-4 text-center">
                    {myEntry ? (
                      <div className="px-4 py-2.5 rounded-xl bg-emerald-500/30 border border-emerald-400/60 text-sm font-extrabold">
                        ✅ Você está inscrito! Aguarde a copa começar.
                      </div>
                    ) : isRegistering ? (
                      <button
                        onClick={join}
                        disabled={joining}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-b from-yellow-400 to-amber-500 text-yellow-950 font-extrabold hover:scale-105 transition disabled:opacity-60"
                      >
                        {joining ? "Inscrevendo…" : "Entrar na Copa por 💎 1"}
                      </button>
                    ) : (
                      <div className="text-xs opacity-80">Aguarde abrir a próxima janela de inscrição.</div>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl bg-white/5 p-3 text-xs space-y-1">
                    <div>🥇 <b>Campeão</b> ganha: 🪙 5.000 + 💎 80 + 🍖 10 rações + 🎁 1 pet raro/super raro/épico</div>
                    <div>🤖 Bots completam os 32 grátis assim que as inscrições fecham</div>
                    <div>⚔️ Chaveamento sorteado: oitavas → quartas → semis → final, tudo MD3</div>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "last" && (
            <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
              {!lastT ? (
                <div className="text-center text-sm opacity-80 py-10">Nenhuma copa finalizada ainda. Volte daqui a pouco!</div>
              ) : (
                <>
                  <div className="text-center mb-3">
                    <div className="text-xs opacity-80">Copa de {new Date(lastT.slot_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</div>
                    {lastT.champion_id ? (
                      <div className="mt-1 text-xl font-extrabold">
                        🥇 Campeão: <span className="text-yellow-300">{pName(lastT.champion_id)}</span>
                        {pIsBot(lastT.champion_id) && <span className="ml-1 text-[10px] opacity-70">(bot)</span>}
                      </div>
                    ) : (
                      <div className="mt-1 text-sm opacity-70">Sem campeão</div>
                    )}
                  </div>

                  {lastBracket && (
                    <div className="overflow-x-auto">
                      <div className="flex gap-3 min-w-fit">
                        {[1, 2, 3, 4].map((r) => (
                          <div key={r} className="flex-shrink-0 w-44">
                            <div className="text-[10px] font-extrabold opacity-80 text-center mb-1">{ROUND_NAMES[r]}</div>
                            <div className="space-y-2" style={{ paddingTop: `${(Math.pow(2, r - 1) - 1) * 18}px` }}>
                              {(lastBracket[r] ?? []).map((m) => {
                                const w = m.winner_id;
                                return (
                                  <div key={m.id} className="rounded-lg bg-white/10 border border-white/20 p-1.5 text-[10px] space-y-0.5" style={{ marginBottom: `${(Math.pow(2, r) - 1) * 16}px` }}>
                                    <div className={`flex justify-between gap-1 px-1 py-0.5 rounded ${w === m.p1_id ? "bg-emerald-500/30 font-extrabold" : "opacity-70"}`}>
                                      <span className="truncate">{pName(m.p1_id)}{pIsBot(m.p1_id) && " 🤖"}</span>
                                    </div>
                                    <div className={`flex justify-between gap-1 px-1 py-0.5 rounded ${w === m.p2_id ? "bg-emerald-500/30 font-extrabold" : "opacity-70"}`}>
                                      <span className="truncate">{pName(m.p2_id)}{pIsBot(m.p2_id) && " 🤖"}</span>
                                    </div>
                                    <div className="text-center text-[9px] opacity-70">{m.score}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {tab === "leaderboard" && (
            <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
              <h2 className="text-lg font-extrabold text-center mb-3">👑 Hall dos Campeões</h2>
              {champs.length === 0 ? (
                <div className="text-center text-sm opacity-80 py-8">Ninguém venceu uma copa ainda. Pode ser você!</div>
              ) : (
                <ol className="space-y-1">
                  {champs.map((c, i) => (
                    <li key={c.user_id} className={`flex items-center gap-2 px-3 py-2 rounded-xl ${i === 0 ? "bg-yellow-500/30 border border-yellow-400/60" : i === 1 ? "bg-gray-300/20" : i === 2 ? "bg-amber-700/30" : "bg-white/5"}`}>
                      <span className="w-8 text-center font-extrabold">{i + 1}º</span>
                      <span className="flex-1 truncate font-bold">{i === 0 ? "👑 " : ""}{c.username}</span>
                      <span className="text-sm font-extrabold">{c.wins} 🏆</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
