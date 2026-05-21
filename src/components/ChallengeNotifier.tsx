import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listIncomingChallenges, respondChallenge } from "@/lib/friends.functions";

type Incoming = { id: string; challenger_id: string; challenger_name: string };

export function ChallengeNotifier({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const loadIncoming = useServerFn(listIncomingChallenges);
  const respond = useServerFn(respondChallenge);
  const [incoming, setIncoming] = useState<Incoming | null>(null);

  async function reload() {
    try {
      const r = await loadIncoming({});
      if (r.challenges.length > 0) {
        const c = r.challenges[0];
        setIncoming({ id: c.id, challenger_id: c.challenger_id, challenger_name: c.challenger_name });
      } else {
        setIncoming(null);
      }
    } catch {}
  }

  useEffect(() => {
    reload();
    const chan = supabase
      .channel(`global-challenges-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_challenges" },
        async (payload) => {
          const c = (payload.new ?? payload.old) as any;
          if (!c) return;
          // incoming for me
          if (c.target_id === userId && c.status === "pending") {
            reload();
          }
          // my challenge was answered
          if (c.challenger_id === userId) {
            if (c.status === "accepted") {
              navigate({ to: "/friend-battle/$challengeId", params: { challengeId: c.id } });
            } else if (c.status === "declined") {
              toast.error("Desafio recusado");
            }
          }
          // pending was resolved (expired/declined/accepted) → refresh
          if (c.target_id === userId && c.status !== "pending") {
            reload();
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [userId]);

  async function accept() {
    if (!incoming) return;
    const id = incoming.id;
    setIncoming(null);
    try {
      await respond({ data: { challengeId: id, accept: true } });
      navigate({ to: "/friend-battle/$challengeId", params: { challengeId: id } });
    } catch (e) {
      toast.error((e as Error).message);
      reload();
    }
  }
  async function decline() {
    if (!incoming) return;
    const id = incoming.id;
    setIncoming(null);
    try {
      await respond({ data: { challengeId: id, accept: false } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!incoming) return null;
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
      <div className="bg-purple-900 border-2 border-yellow-300 rounded-2xl p-6 max-w-sm w-full text-center animate-in zoom-in-95">
        <div className="text-5xl mb-2">⚔️</div>
        <div className="text-white font-extrabold text-xl mb-1">Desafio recebido!</div>
        <div className="text-white/80 mb-4">
          <span className="font-bold text-yellow-300">{incoming.challenger_name}</span> te chamou para uma batalha
        </div>
        <div className="flex gap-2 justify-center">
          <button onClick={accept} className="px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-extrabold">Aceitar</button>
          <button onClick={decline} className="px-4 py-2 rounded-lg bg-red-500/80 hover:bg-red-600 text-white font-bold">Recusar</button>
        </div>
      </div>
    </div>
  );
}
