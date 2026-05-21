import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { simulateBattle, toBattleMonster, type DBMonster } from "@/lib/battle";
import { getChallenge, saveChallengeResult } from "@/lib/friends.functions";

export const Route = createFileRoute("/friend-battle/$challengeId")({
  component: FriendBattlePage,
});

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}

function FriendBattlePage() {
  const { challengeId } = Route.useParams();
  const { profile } = useProfile();
  const navigate = useNavigate();
  const getChal = useServerFn(getChallenge);
  const saveResult = useServerFn(saveChallengeResult);

  const [status, setStatus] = useState<string>("Carregando…");
  const [result, setResult] = useState<{ winnerId: string; log: any[]; challengerId: string; targetId: string } | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      try {
        const c = await getChal({ data: { challengeId } });
        if (c.winner_id && c.battle_log) {
          setResult({ winnerId: c.winner_id, log: c.battle_log as any[], challengerId: c.challenger_id, targetId: c.target_id });
          return;
        }
        setStatus("Carregando times…");
        const [{ data: ta }, { data: tb }] = await Promise.all([
          supabase.from("monsters").select("*").eq("owner_id", c.challenger_id).eq("in_team", true).order("team_position"),
          supabase.from("monsters").select("*").eq("owner_id", c.target_id).eq("in_team", true).order("team_position"),
        ]);
        if (!ta?.length || !tb?.length) {
          setStatus("Um dos jogadores não tem time montado.");
          return;
        }
        setStatus("Simulando batalha…");
        const teamA = (ta as DBMonster[]).map(toBattleMonster);
        const teamB = (tb as DBMonster[]).map(toBattleMonster);
        const seed = hashSeed(challengeId);
        const r = simulateBattle(teamA, teamB, seed);
        const winnerId = r.winner === "team_a" ? c.challenger_id : r.winner === "team_b" ? c.target_id : c.challenger_id;
        await saveResult({ data: { challengeId, winnerId, log: r.log } });
        setResult({ winnerId, log: r.log, challengerId: c.challenger_id, targetId: c.target_id });
      } catch (e) {
        setStatus((e as Error).message);
      }
    })();
  }, [profile?.id, challengeId]);

  if (!profile) return null;

  return (
    <div className="min-h-screen pb-20">
      <HUD profile={profile} />
      <div className="max-w-3xl mx-auto p-3 md:p-4">
        <Link to="/friends" className="text-white/70 text-sm">← Amigos</Link>
        <h1 className="text-2xl font-extrabold text-white my-3">⚔️ Batalha de Amigos</h1>

        {!result && <div className="text-white/80">{status}</div>}

        {result && (
          <div className="bg-purple-900/60 border border-purple-400/30 rounded-2xl p-4">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">{result.winnerId === profile.id ? "🏆" : "💔"}</div>
              <div className="text-white font-extrabold text-2xl">
                {result.winnerId === profile.id ? "Você venceu!" : "Você perdeu"}
              </div>
            </div>
            <div className="bg-black/30 rounded-xl p-3 max-h-[400px] overflow-y-auto text-sm space-y-1">
              {result.log.map((e: any, i: number) => (
                <div key={i} className="text-white/90">
                  <span className="text-yellow-300">T{e.turn}</span> {e.message}
                </div>
              ))}
            </div>
            <div className="text-center mt-4">
              <button
                onClick={() => navigate({ to: "/friends" })}
                className="px-4 py-2 rounded-lg bg-purple-500 text-white font-bold"
              >
                Voltar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
