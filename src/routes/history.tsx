import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { ARENA_WIN_POINTS, ARENA_LOSS_POINTS } from "@/lib/game-data";
import { BattleDetailModal, type BattleRow } from "@/components/BattleDetailModal";
import arenaBg from "@/assets/arena-bg.jpg";

export const Route = createFileRoute("/history")({
  component: HistoryPage,
  head: () => ({
    meta: [
      { title: "Histórico de Batalhas — ARENA PET" },
      { name: "description", content: "Veja suas batalhas recentes na arena." },
    ],
  }),
});

type OpponentMap = Record<string, { username: string; level: number }>;

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s atrás`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

function HistoryPage() {
  const { userId, profile, loading } = useProfile();
  const [battles, setBattles] = useState<BattleRow[]>([]);
  const [opponents, setOpponents] = useState<OpponentMap>({});
  const [filter, setFilter] = useState<"all" | "wins" | "losses">("all");
  const [openLog, setOpenLog] = useState<BattleRow | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("battles")
        .select("*")
        .or(`attacker_id.eq.${userId},defender_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(100);
      const rows = (data ?? []) as BattleRow[];
      setBattles(rows);
      const ids = new Set<string>();
      rows.forEach((b) => {
        ids.add(b.attacker_id);
        ids.add(b.defender_id);
      });
      ids.delete(userId);
      if (ids.size > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,username,level")
          .in("id", Array.from(ids));
        const map: OpponentMap = {};
        (profs ?? []).forEach((p) => { map[p.id] = { username: p.username, level: p.level }; });
        setOpponents(map);
      }
    })();
  }, [userId]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-white text-xl">📜 Carregando histórico...</div>;
  }

  const filtered = battles.filter((b) => {
    if (filter === "all") return true;
    const won = b.winner_id === userId;
    return filter === "wins" ? won : !won;
  });

  const wins = battles.filter((b) => b.winner_id === userId).length;
  const losses = battles.length - wins;

  return (
    <main
      className="min-h-screen pb-12 bg-cover bg-fixed bg-center"
      style={{ backgroundImage: `linear-gradient(rgba(30,10,60,0.7),rgba(30,10,60,0.9)),url(${arenaBg})` }}
    >
      <HUD profile={profile} />

      <div className="max-w-4xl mx-auto px-4 mt-6 space-y-4">
        <section className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-4 text-white">
          <h1 className="text-2xl font-extrabold flex items-center gap-2">📜 Histórico de Batalhas</h1>
          <p className="text-sm opacity-80 mt-1">Suas últimas {battles.length} batalhas • <b className="text-emerald-300">{wins}V</b> / <b className="text-rose-300">{losses}D</b></p>
          <div className="flex gap-2 mt-3">
            {(["all", "wins", "losses"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-extrabold transition ${
                  filter === f ? "bg-yellow-400 text-yellow-950" : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {f === "all" ? "Todas" : f === "wins" ? "🏆 Vitórias" : "💀 Derrotas"}
              </button>
            ))}
          </div>
        </section>

        {filtered.length === 0 ? (
          <div className="text-center text-white/70 py-12">
            <div className="text-5xl mb-2">⚔️</div>
            <p className="font-bold">Nenhuma batalha ainda.</p>
            <Link to="/arena" className="inline-block mt-3 px-5 py-2 rounded-xl bg-gradient-to-b from-red-400 to-red-600 text-white font-extrabold shadow-lg hover:scale-105 transition">
              Ir pra Arena
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b) => {
              const won = b.winner_id === userId;
              const oppId = b.attacker_id === userId ? b.defender_id : b.attacker_id;
              const opp = opponents[oppId];
              const role = b.attacker_id === userId ? "Atacou" : "Defendeu";
              // Pega o delta de pontos certo pro lado em que você jogou.
              // Para batalhas antigas (sem coluna), cai no fallback dos constants.
              const myDelta = b.attacker_id === userId
                ? (b.attacker_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS))
                : (b.defender_points_delta ?? (won ? ARENA_WIN_POINTS : -ARENA_LOSS_POINTS));
              const deltaStr = myDelta >= 0 ? `+${myDelta}` : `${myDelta}`;
              return (
                <button
                  key={b.id}
                  onClick={() => setOpenLog(b)}
                  className={`w-full text-left rounded-2xl border-2 p-3 transition hover:scale-[1.01] flex items-center gap-3 ${
                    won
                      ? "border-emerald-400/60 bg-gradient-to-r from-emerald-900/60 to-emerald-700/30"
                      : "border-rose-400/60 bg-gradient-to-r from-rose-900/60 to-rose-700/30"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-black shadow-lg ${
                    won ? "bg-emerald-400 text-emerald-950" : "bg-rose-400 text-rose-950"
                  }`}>
                    {won ? "🏆" : "💀"}
                  </div>
                  <div className="flex-1 min-w-0 text-white">
                    <div className="font-extrabold truncate">
                      {won ? "Vitória" : "Derrota"} vs {opp?.username ?? "Treinador"} <span className="text-xs opacity-70">Lv {opp?.level ?? "?"}</span>
                    </div>
                    <div className="text-[11px] opacity-80">{role} • {timeAgo(b.created_at)}</div>
                  </div>
                  <div className="text-right text-xs font-bold text-white">
                    <div className={myDelta >= 0 ? "text-emerald-300" : "text-rose-300"}>
                      {deltaStr} 🏆
                    </div>
                    {won ? (
                      <>
                        <div className="text-yellow-300">+{b.coins_reward} 🪙</div>
                        <div className="text-cyan-300">+{b.xp_reward} XP</div>
                      </>
                    ) : (
                      <div className="text-white/50">—</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {openLog && (
        <BattleDetailModal battle={openLog} viewerId={userId!} onClose={() => setOpenLog(null)} />
      )}
    </main>
  );
}


