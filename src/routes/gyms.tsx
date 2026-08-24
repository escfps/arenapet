import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { BattleScene } from "@/components/BattleScene";
import { simulateBattle, toBattleMonster, type BattleLogEntry } from "@/lib/battle";
import type { MonsterRow } from "@/components/MonsterCard";
import { SPECIES, computeBattleEnergy } from "@/lib/game-data";
import { POKE_TYPES, TYPE_INFO, getTypes, type PokeType } from "@/lib/moves";
import arenaBg from "@/assets/arena-bg.jpg";
import { vacantLeaderName } from "@/lib/gym-npc";
import { useServerFn } from "@tanstack/react-start";
import { gymChallengeStart, gymChallengeFinish } from "@/lib/gyms.functions";

export const Route = createFileRoute("/gyms")({
  component: GymsPage,
  head: () => ({
    meta: [
      { title: "Ginásios Pokémon — Duelo Pokemon" },
      { name: "description", content: "Desafie os 18 ginásios de Duelo Pokemon, conquiste insígnias e domine um ginásio para receber 50 diamantes a cada 24 horas." },
      { property: "og:title", content: "Ginásios Pokémon — Duelo Pokemon" },
      { property: "og:description", content: "Conquiste insígnias, torne-se líder de ginásio e receba diamantes todos os dias." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Team = (MonsterRow & { owner_id: string })[];

type GymRow = {
  type: string;
  starter: boolean;
  leader_id: string | null;
  leader_claimed_at: string | null;
  last_reward_at: string | null;
  defends: number;
};

const BADGES_REQUIRED = 5;
const REWARD_GEMS = 50;

function GymsPage() {
  const { profile, userId, reload } = useProfile();
  const [gyms, setGyms] = useState<GymRow[]>([]);
  const [leaderNames, setLeaderNames] = useState<Record<string, string>>({});
  const [badges, setBadges] = useState<string[]>([]);
  const [myTeam, setMyTeam] = useState<Team>([]);
  const [loading, setLoading] = useState(true);

  const [active, setActive] = useState<PokeType | null>(null);
  const [enemy, setEnemy] = useState<{ team: Team; name: string; isNpc: boolean } | null>(null);
  const [battleLog, setBattleLog] = useState<BattleLogEntry[] | null>(null);
  const [shownLog, setShownLog] = useState<BattleLogEntry[]>([]);
  const [winner, setWinner] = useState<"team_a" | "team_b" | "draw" | null>(null);
  const [outcome, setOutcome] = useState<{ badge: boolean; leader: boolean } | null>(null);
  const [pureTeam, setPureTeam] = useState(false);
  const [busy, setBusy] = useState(false);
  const appliedRef = useRef(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const startChallengeFn = useServerFn(gymChallengeStart);
  const finishChallengeFn = useServerFn(gymChallengeFinish);

  const battleFinished = !!battleLog && shownLog.length >= battleLog.length;

  const loadAll = useCallback(async () => {
    if (!userId) return;
    const [g, b, t] = await Promise.all([
      supabase.from("gyms").select("*"),
      supabase.from("gym_badges").select("gym_type").eq("user_id", userId),
      supabase.from("monsters").select("*").eq("owner_id", userId).eq("in_team", true).order("team_position", { ascending: true }).limit(3),
    ]);
    const rows = ((g.data as GymRow[]) ?? []);
    setGyms(rows);
    setBadges(((b.data as { gym_type: string }[]) ?? []).map((x) => x.gym_type));
    setMyTeam(((t.data as Team) ?? []).slice(0, 3));

    const ids = rows.map((r) => r.leader_id).filter((x): x is string => !!x);
    if (ids.length) {
      const { data } = await (supabase as any).from("public_profiles").select("id, username").in("id", ids);
      const map: Record<string, string> = {};
      for (const p of (data as { id: string; username: string }[]) ?? []) map[p.id] = p.username;
      setLeaderNames(map);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  // Playback do log
  useEffect(() => {
    if (!battleLog || battleLog.length === 0) return;
    let i = 0;
    let cancelled = false;
    let timeoutId: number | undefined;
    function tick() {
      if (cancelled) return;
      i += 1;
      setShownLog(battleLog!.slice(0, i));
      if (i >= battleLog!.length) return;
      const prev = battleLog![i - 1];
      const next = battleLog![i];
      const turnChange = prev && next && prev.turn !== next.turn ? 900 : 0;
      timeoutId = window.setTimeout(tick, (next?.crit ? 2400 : 2000) + turnChange);
    }
    const initial = window.setTimeout(tick, 1600);
    return () => { cancelled = true; clearTimeout(initial); if (timeoutId) clearTimeout(timeoutId); };
  }, [battleLog]);

  // Aplica resultado no servidor quando a animação termina
  useEffect(() => {
    if (!battleFinished || !winner || !sessionId || appliedRef.current) return;
    appliedRef.current = true;
    const sid = sessionId;
    const turns = battleLog?.length ?? 0;
    (async () => {
      try {
        const res = await finishChallengeFn({ data: { sessionId: sid, visibleTurns: turns, forfeit: false } });
        setOutcome({ badge: res.badge, leader: res.leader });
        await Promise.all([loadAll(), reload()]);
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao registrar o desafio");
      }
    })();
  }, [battleFinished, winner, sessionId, battleLog, finishChallengeFn, loadAll, reload]);

  const badgeSet = useMemo(() => new Set(badges), [badges]);
  const distinctBadges = badgeSet.size;

  const teamEnergies = myTeam.map((m) => computeBattleEnergy(m.battle_energy, m.battle_energy_at));
  const minEnergy = teamEnergies.length ? Math.min(...teamEnergies.map((e) => e.energy)) : 0;
  const starving = myTeam.filter((m) => (m.hunger ?? 100) <= 0);

  function myTeamIsPure(t: PokeType): boolean {
    return myTeam.length === 3 && myTeam.every((m) => getTypes(m.species).includes(t));
  }

  async function challenge(gym: GymRow) {
    const t = gym.type as PokeType;
    if (!userId || busy) return;
    if (myTeam.length < 3) { toast.error("Monte um time com 3 pokémons antes! 🎒"); return; }
    if (starving.length > 0) { toast.error(`${starving[0].name} está faminto! Alimente antes. 🍖`); return; }
    if (minEnergy < 1) { toast.error("Algum pokémon do time está sem energia de batalha! ⚡"); return; }
    if (!gym.starter && distinctBadges < BADGES_REQUIRED) {
      toast.error(`Precisa de ${BADGES_REQUIRED} insígnias diferentes para desafiar este ginásio! 🎖️`);
      return;
    }
    if (gym.leader_id === userId) { toast.info("Você já é o líder deste ginásio! 👑"); return; }

    setBusy(true);
    try {
      const res = await startChallengeFn({ data: { type: t } });
      if (!gym.starter) {
        setBadges((prev) => [t, ...prev.filter((x) => x !== t)].slice(5));
        toast.info("🎖️ 5 insígnias consumidas para entrar no ginásio!");
      }
      appliedRef.current = false;
      setOutcome(null);
      setPureTeam(res.pure);
      setActive(t);
      setEnemy({
        team: res.enemyTeam as unknown as Team,
        name: res.enemyName || vacantLeaderName(t),
        isNpc: res.isNpc,
      });
      setMyTeam(res.myTeam as unknown as Team);
      setShownLog([]);
      setSessionId(res.sessionId);
      setWinner(res.winner);
      setBattleLog(res.log);
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível desafiar agora.");
    } finally {
      setBusy(false);
    }
  }

  async function claim(gym: GymRow) {
    try {
      const { error } = await (supabase as any).rpc("gym_claim_reward", { p_type: gym.type });
      if (error) throw error;
      toast.success(`💎 +${REWARD_GEMS} diamantes do Ginásio ${TYPE_INFO[gym.type as PokeType].name}!`);
      await Promise.all([loadAll(), reload()]);
    } catch (e: any) {
      toast.error(e?.message?.includes("recarga") ? "Recompensa ainda em recarga ⏳" : (e?.message ?? "Erro ao coletar"));
    }
  }

  function closeBattle() {
    setSessionId(null);
    setBattleLog(null);
    setShownLog([]);
    setWinner(null);
    setActive(null);
    setEnemy(null);
  }

  function readyIn(gym: GymRow): string | null {
    if (!gym.last_reward_at) return null;
    const next = new Date(gym.last_reward_at).getTime() + 24 * 3600 * 1000;
    const diff = next - Date.now();
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  if (!profile) return null;

  const sortedGyms = POKE_TYPES.map((t) => gyms.find((g) => g.type === t)).filter((g): g is GymRow => !!g)
    .sort((a, b) => Number(b.starter) - Number(a.starter));

  return (
    <div className="min-h-screen bg-cover bg-center" style={{ backgroundImage: `url(${arenaBg})` }}>
      <div className="min-h-screen bg-purple-950/80 backdrop-blur-sm pb-40">

        <HUD profile={profile} />
        <Toaster position="top-center" richColors />

        <main className="max-w-5xl mx-auto px-3 py-4">
          <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">🏛️ Ginásios</h1>
          <p className="text-white/70 text-sm mb-3">
            Vença o líder para tentar a insígnia (30% de chance). Com um time <b>100% do tipo</b>, você também assume o ginásio e recebe 💎 {REWARD_GEMS} a cada 24h.
          </p>

          <div className="rounded-2xl bg-black/40 border border-white/15 p-3 mb-4 text-white/85 text-xs space-y-1">
            <div>🎖️ Suas insígnias: <b className="text-yellow-300">{distinctBadges}</b> / 18</div>
            <div>🔓 Ginásios iniciantes (Normal, Planta e Inseto) são livres. Os outros exigem <b>{BADGES_REQUIRED} insígnias diferentes</b>, que são <b className="text-red-300">consumidas ao desafiar</b> (ganhe ou perca).</div>
            <div>⚠️ Lutar com time fora do tipo serve só para farmar insígnia — não dá liderança.</div>
          </div>

          {loading ? (
            <div className="text-white/70">Carregando ginásios…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedGyms.map((gym) => {
                const t = gym.type as PokeType;
                const info = TYPE_INFO[t];
                const mine = gym.leader_id === userId;
                const locked = !gym.starter && distinctBadges < BADGES_REQUIRED;
                const owned = badgeSet.has(gym.type);
                const cd = readyIn(gym);
                const pure = myTeamIsPure(t);
                return (
                  <div key={gym.type} className={`rounded-2xl border-2 p-3 bg-black/45 ${mine ? "border-yellow-300" : "border-white/15"}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className={`px-2 py-1 rounded-lg text-xs font-black ${info.color}`}>
                        {info.emoji} {info.name}
                      </div>
                      <div className="flex items-center gap-1">
                        {gym.starter && <span className="text-[10px] font-bold text-emerald-300">INICIANTE</span>}
                        {owned && <span title="Insígnia conquistada" className="text-lg">🎖️</span>}
                      </div>
                    </div>

                    <div className="text-white/80 text-xs mb-2">
                      👑 Líder:{" "}
                      <b className="text-white">
                        {gym.leader_id ? (mine ? "Você" : (leaderNames[gym.leader_id] ?? "Treinador")) : vacantLeaderName(t)}
                      </b>
                      {gym.leader_id && gym.defends > 0 && <span className="text-white/60"> · {gym.defends} defesas</span>}
                    </div>

                    {mine ? (
                      <button
                        onClick={() => claim(gym)}
                        disabled={!!cd}
                        className="w-full py-2 rounded-xl font-black text-sm bg-gradient-to-r from-yellow-400 to-amber-500 text-yellow-950 disabled:opacity-50"
                      >
                        {cd ? `⏳ ${cd}` : `💎 Coletar ${REWARD_GEMS}`}
                      </button>
                    ) : (
                      <button
                        onClick={() => challenge(gym)}
                        disabled={locked || busy}
                        className="w-full py-2 rounded-xl font-black text-sm bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white disabled:opacity-50"
                      >
                        {locked ? `🔒 ${BADGES_REQUIRED} insígnias` : pure ? "⚔️ Desafiar (time do tipo)" : "⚔️ Desafiar (só insígnia)"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {battleLog && enemy && active && (
          <div className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm overflow-y-auto p-2">
            <div className="max-w-4xl mx-auto mt-4 relative">
              <div className="text-center text-white font-black mb-2">
                🏛️ Ginásio {TYPE_INFO[active].emoji} {TYPE_INFO[active].name}
                {!pureTeam && <div className="text-[11px] font-bold text-amber-300">Time fora do tipo — só vale insígnia</div>}
              </div>
              <BattleScene
                teamA={myTeam}
                teamB={enemy.team}
                log={battleLog}
                step={shownLog.length}
                playerAName={profile.username}
                playerBName={enemy.name}
              />

              {battleFinished && winner && (
                <div className="mt-3 rounded-2xl border-4 p-4 text-center bg-purple-950 border-white/30 text-white">
                  <div className="text-4xl mb-1">{winner === "team_a" ? "🏆" : winner === "draw" ? "🤝" : "💀"}</div>
                  <div className="text-2xl font-black">
                    {winner === "team_a" ? "VITÓRIA!" : winner === "draw" ? "EMPATE!" : "DERROTA"}
                  </div>
                  {outcome && (
                    <div className="mt-2 text-sm space-y-1">
                      <div>{outcome.badge ? `🎖️ Você conquistou a insígnia de ${TYPE_INFO[active].name}!` : badgeSet.has(active) ? "🎖️ Você já tinha esta insígnia." : "Sem insígnia desta vez (30% de chance)."}</div>
                      {outcome.leader && <div className="text-yellow-300 font-black">👑 Você é o novo líder do Ginásio {TYPE_INFO[active].name}!</div>}
                      {!outcome.leader && winner === "team_a" && !pureTeam && (
                        <div className="text-amber-300">Para virar líder, use um time 100% {TYPE_INFO[active].name}.</div>
                      )}
                    </div>
                  )}
                  <button onClick={closeBattle} className="mt-3 px-5 py-2 rounded-xl font-black bg-white text-purple-950">
                    Voltar aos ginásios
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
