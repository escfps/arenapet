import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { SPECIES, rankStars, getTier } from "@/lib/game-data";
import {
  getFriendProfile,
  listMessages,
  sendMessage,
  sendGift,
  sendChallenge,
  respondChallenge,
} from "@/lib/friends.functions";

export const Route = createFileRoute("/friends/$friendId")({
  component: FriendProfilePage,
});

type TeamPet = {
  id: string;
  name: string;
  species: string;
  rank: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
};

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

function isOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

function FriendProfilePage() {
  const { friendId } = Route.useParams();
  const { profile } = useProfile();
  const navigate = useNavigate();

  const getProfile = useServerFn(getFriendProfile);
  const loadMsgs = useServerFn(listMessages);
  const sendMsg = useServerFn(sendMessage);
  const sendG = useServerFn(sendGift);
  const sendChal = useServerFn(sendChallenge);
  const respondChal = useServerFn(respondChallenge);

  const [data, setData] = useState<{ profile: any; team: TeamPet[]; giftSentToday: boolean } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [pendingChallenge, setPendingChallenge] = useState<{ id: string; from: "me" | "them" } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  async function reloadProfile() {
    try {
      const r = await getProfile({ data: { friendId } });
      setData(r);
    } catch (e) {
      toast.error((e as Error).message);
      navigate({ to: "/friends" });
    }
  }
  async function reloadMessages() {
    try {
      const r = await loadMsgs({ data: { friendId } });
      setMessages(r.messages as Message[]);
      setTimeout(() => {
        if (scrollerRef.current) scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
      }, 50);
    } catch {}
  }

  useEffect(() => {
    reloadProfile();
    reloadMessages();
  }, [friendId]);

  useEffect(() => {
    if (!profile) return;
    const chan = supabase
      .channel(`friend-chat-${profile.id}-${friendId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "friend_messages" },
        (payload) => {
          const m = payload.new as Message;
          if (
            (m.sender_id === profile.id && m.receiver_id === friendId) ||
            (m.sender_id === friendId && m.receiver_id === profile.id)
          ) {
            reloadMessages();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_challenges" },
        (payload) => {
          const c = payload.new as any;
          if (!c) return;
          if (c.status === "pending" && c.target_id === profile.id && c.challenger_id === friendId) {
            setPendingChallenge({ id: c.id, from: "them" });
          } else if (c.status === "accepted" && c.winner_id) {
            // navigate both to result page
            navigate({ to: "/friend-battle/$challengeId", params: { challengeId: c.id } });
          } else if (c.status === "declined") {
            toast.error("Desafio recusado");
            setPendingChallenge(null);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [profile?.id, friendId]);

  async function doSend() {
    const v = text.trim();
    if (!v) return;
    setText("");
    try {
      await sendMsg({ data: { friendId, content: v } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doGift() {
    try {
      const r = await sendG({ data: { friendId } });
      toast.success(`Presente enviado: ${r.amount} ${r.giftType === "ration" ? "🍖" : "🪙"}`);
      reloadProfile();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doChallenge() {
    try {
      const r = await sendChal({ data: { friendId } });
      setPendingChallenge({ id: r.challengeId, from: "me" });
      toast.success("Desafio enviado! Aguardando resposta…");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function acceptChal() {
    if (!pendingChallenge) return;
    try {
      await respondChal({ data: { challengeId: pendingChallenge.id, accept: true } });
      navigate({ to: "/friend-battle/$challengeId", params: { challengeId: pendingChallenge.id } });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function declineChal() {
    if (!pendingChallenge) return;
    try {
      await respondChal({ data: { challengeId: pendingChallenge.id, accept: false } });
      setPendingChallenge(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!profile) return null;
  if (!data) return <div className="min-h-screen"><HUD profile={profile} /><div className="text-white p-4">Carregando…</div></div>;

  const fp = data.profile;
  const tier = getTier(fp.arena_points ?? 0);
  const online = isOnline(fp.last_seen_at);

  return (
    <div className="min-h-screen pb-20">
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />
      <div className="max-w-3xl mx-auto p-3 md:p-4 space-y-3">
        <Link to="/friends" className="text-white/70 text-sm">← Voltar</Link>

        <div className="bg-purple-900/60 border border-purple-400/30 rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">{online ? "🟢" : "⚫"}</span>
            <div className="flex-1">
              <div className="text-white font-extrabold text-xl">{fp.username}</div>
              <div className="text-xs text-white/70">Lvl {fp.level} • {fp.wins}V / {fp.losses}D</div>
            </div>
            <span className={`px-2 py-1 rounded font-extrabold text-xs ${tier.color}`}>{tier.emoji} {tier.short}</span>
          </div>
          <div className="text-sm text-white/80">{fp.arena_points} pts da arena</div>

          <div className="flex gap-2 mt-3 flex-wrap">
            <button onClick={doChallenge} className="px-3 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-extrabold text-sm">⚔️ Desafiar</button>
            <button
              onClick={doGift}
              disabled={data.giftSentToday}
              className="px-3 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 disabled:bg-white/10 disabled:text-white/50 text-black font-extrabold text-sm"
            >
              🎁 {data.giftSentToday ? "Presente enviado hoje" : "Enviar presente"}
            </button>
          </div>
        </div>

        <div className="bg-purple-900/60 border border-purple-400/30 rounded-2xl p-3">
          <div className="text-white font-bold mb-2">Time atual</div>
          <div className="grid grid-cols-3 gap-2">
            {data.team.length === 0 && <div className="text-white/60 col-span-3 text-sm">Sem pets no time.</div>}
            {data.team.map((m) => {
              const sp = SPECIES[m.species];
              return (
                <div key={m.id} className="bg-purple-950/60 rounded-xl p-2 text-center">
                  {sp?.image ? (
                    <img src={sp.image} alt={m.name} className="w-16 h-16 mx-auto object-contain" />
                  ) : (
                    <div className="text-3xl">🐾</div>
                  )}
                  <div className="text-white text-xs font-bold truncate">{m.name}</div>
                  <div className="text-yellow-300 text-[10px]">{rankStars(m.rank)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-purple-900/60 border border-purple-400/30 rounded-2xl p-3 flex flex-col" style={{ height: 420 }}>
          <div className="text-white font-bold mb-2">💬 Chat</div>
          <div ref={scrollerRef} className="flex-1 overflow-y-auto space-y-1 pr-1">
            {messages.length === 0 && <div className="text-white/50 text-sm">Diga oi!</div>}
            {messages.map((m) => {
              const mine = m.sender_id === profile.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] px-3 py-1.5 rounded-2xl text-sm ${mine ? "bg-purple-500 text-white rounded-br-sm" : "bg-white/15 text-white rounded-bl-sm"}`}>
                    {m.content}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSend()}
              maxLength={500}
              placeholder="Digite uma mensagem…"
              className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-white placeholder:text-white/40 border border-white/20 text-sm"
            />
            <button onClick={doSend} className="px-3 py-2 rounded-lg bg-purple-500 text-white font-bold text-sm">Enviar</button>
          </div>
        </div>
      </div>

      {pendingChallenge?.from === "them" && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-purple-900 border-2 border-yellow-300 rounded-2xl p-6 max-w-sm w-full text-center">
            <div className="text-5xl mb-2">⚔️</div>
            <div className="text-white font-extrabold text-xl mb-1">Desafio recebido!</div>
            <div className="text-white/80 mb-4">{data.profile.username} te chamou para uma batalha</div>
            <div className="flex gap-2 justify-center">
              <button onClick={acceptChal} className="px-4 py-2 rounded-lg bg-green-500 text-white font-extrabold">Aceitar</button>
              <button onClick={declineChal} className="px-4 py-2 rounded-lg bg-red-500/80 text-white font-bold">Recusar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
