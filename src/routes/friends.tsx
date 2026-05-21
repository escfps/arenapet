import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { supabase } from "@/integrations/supabase/client";
import {
  listFriends,
  searchPlayer,
  sendFriendRequest,
  respondFriendRequest,
  removeFriend,
  listIncomingGifts,
  claimGift,
  sendChallenge,
} from "@/lib/friends.functions";

export const Route = createFileRoute("/friends")({
  component: FriendsPage,
});

type Friend = {
  friendshipId: string;
  id: string;
  username: string;
  level: number;
  arena_points: number;
  last_seen_at: string | null;
  wins: number;
  losses: number;
  unread: number;
  hasGift: boolean;
};

function isOnline(lastSeen: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 2 * 60 * 1000;
}

function FriendsPage() {
  const { profile } = useProfile();
  const navigate = useNavigate();
  const list = useServerFn(listFriends);
  const search = useServerFn(searchPlayer);
  const sendReq = useServerFn(sendFriendRequest);
  const respond = useServerFn(respondFriendRequest);
  const remove = useServerFn(removeFriend);
  const challenge = useServerFn(sendChallenge);
  const incomingGifts = useServerFn(listIncomingGifts);
  const claim = useServerFn(claimGift);

  const [tab, setTab] = useState<"friends" | "requests" | "search" | "gifts">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<{ friendshipId: string; id: string; username: string; level: number }[]>([]);
  const [outgoing, setOutgoing] = useState<{ friendshipId: string; id: string; username: string }[]>([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<{ id: string; username: string; level: number; last_seen_at: string | null }[]>([]);
  const [gifts, setGifts] = useState<{ id: string; sender_id: string; sender_name: string; gift_type: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const r = await list();
    setFriends(r.friends);
    setIncoming(r.incoming);
    setOutgoing(r.outgoing);
    const g = await incomingGifts();
    setGifts(g.gifts);
    setLoading(false);
  }

  useEffect(() => {
    reload();
    if (!profile) return;
    const chan = supabase
      .channel(`friends-${profile.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => reload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_messages", filter: `receiver_id=eq.${profile.id}` },
        () => reload()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_gifts", filter: `receiver_id=eq.${profile.id}` },
        () => reload()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(chan);
    };
  }, [profile?.id]);

  async function doSearch() {
    if (q.trim().length < 2) return;
    try {
      const r = await search({ data: { q: q.trim() } });
      setResults(r.players);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function addFriend(id: string) {
    try {
      await sendReq({ data: { targetId: id } });
      toast.success("Solicitação enviada!");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function acceptReq(friendshipId: string) {
    try {
      await respond({ data: { friendshipId, accept: true } });
      toast.success("Amigo adicionado!");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function rejectReq(friendshipId: string) {
    try {
      await respond({ data: { friendshipId, accept: false } });
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function doRemove(id: string) {
    if (!confirm("Remover este amigo?")) return;
    try {
      await remove({ data: { friendId: id } });
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function claimOne(giftId: string) {
    try {
      const r = await claim({ data: { giftId } });
      toast.success(`Recebido: ${r.amount} ${r.type === "ration" ? "🍖" : "🪙"}`);
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen pb-20">
      <Toaster position="top-center" richColors />
      <HUD profile={profile} />
      <div className="max-w-3xl mx-auto p-3 md:p-4">
        <h1 className="text-2xl font-extrabold text-white mb-3">👥 Amigos</h1>

        <div className="flex gap-1 mb-3 flex-wrap">
          <TabBtn active={tab === "friends"} onClick={() => setTab("friends")}>
            Amigos ({friends.length})
          </TabBtn>
          <TabBtn active={tab === "requests"} onClick={() => setTab("requests")}>
            Solicitações{incoming.length > 0 && <span className="ml-1 text-red-300">🔴 {incoming.length}</span>}
          </TabBtn>
          <TabBtn active={tab === "gifts"} onClick={() => setTab("gifts")}>
            Presentes{gifts.length > 0 && <span className="ml-1 text-yellow-300">🎁 {gifts.length}</span>}
          </TabBtn>
          <TabBtn active={tab === "search"} onClick={() => setTab("search")}>
            🔍 Buscar
          </TabBtn>
        </div>

        {loading && <div className="text-white/70">Carregando…</div>}

        {tab === "friends" && (
          <div className="space-y-2">
            {friends.length === 0 && <div className="text-white/60">Sem amigos ainda. Use a busca para adicionar!</div>}
            {friends.map((f) => (
              <button
                key={f.id}
                onClick={() => navigate({ to: "/friends/$friendId", params: { friendId: f.id } })}
                className="w-full bg-purple-900/60 hover:bg-purple-900/80 border border-purple-400/30 rounded-xl p-3 flex items-center gap-3 text-left"
              >
                <span className="text-xl">{isOnline(f.last_seen_at) ? "🟢" : "⚫"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold truncate">{f.username}</div>
                  <div className="text-xs text-white/70">Lvl {f.level} • {f.arena_points} pts • {f.wins}V/{f.losses}D</div>
                </div>
                <div className="flex items-center gap-1">
                  {f.hasGift && <span className="text-yellow-300">🎁</span>}
                  {f.unread > 0 && (
                    <span className="bg-red-500 text-white text-xs font-extrabold rounded-full px-2 py-0.5">
                      {f.unread}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); doRemove(f.id); }}
                  className="text-white/50 hover:text-red-300 text-xs px-2"
                  title="Remover"
                >
                  ✕
                </button>
              </button>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div className="space-y-3">
            <div>
              <h3 className="text-white font-bold mb-1">Recebidas</h3>
              {incoming.length === 0 && <div className="text-white/60 text-sm">Nada por aqui.</div>}
              {incoming.map((r) => (
                <div key={r.friendshipId} className="bg-purple-900/60 border border-purple-400/30 rounded-xl p-3 flex items-center gap-3 mb-2">
                  <div className="flex-1">
                    <div className="text-white font-bold">{r.username}</div>
                    <div className="text-xs text-white/70">Lvl {r.level}</div>
                  </div>
                  <button onClick={() => acceptReq(r.friendshipId)} className="px-3 py-1 rounded-lg bg-green-500 text-white font-bold text-sm">Aceitar</button>
                  <button onClick={() => rejectReq(r.friendshipId)} className="px-3 py-1 rounded-lg bg-red-500/80 text-white font-bold text-sm">Recusar</button>
                </div>
              ))}
            </div>
            <div>
              <h3 className="text-white font-bold mb-1">Enviadas</h3>
              {outgoing.length === 0 && <div className="text-white/60 text-sm">Nada pendente.</div>}
              {outgoing.map((r) => (
                <div key={r.friendshipId} className="bg-purple-900/40 rounded-xl p-2 px-3 flex items-center gap-3 mb-1 text-sm">
                  <span className="text-white">{r.username}</span>
                  <span className="text-white/50 ml-auto">aguardando…</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "gifts" && (
          <div className="space-y-2">
            {gifts.length === 0 && <div className="text-white/60">Nenhum presente pendente.</div>}
            {gifts.map((g) => (
              <div key={g.id} className="bg-yellow-500/10 border border-yellow-400/40 rounded-xl p-3 flex items-center gap-3">
                <span className="text-3xl">{g.gift_type === "ration" ? "🍖" : "🪙"}</span>
                <div className="flex-1">
                  <div className="text-white font-bold">{g.amount}× {g.gift_type === "ration" ? "Ração" : "Moedas"}</div>
                  <div className="text-xs text-white/70">de {g.sender_name}</div>
                </div>
                <button onClick={() => claimOne(g.id)} className="px-3 py-1 rounded-lg bg-yellow-400 text-black font-extrabold text-sm">Resgatar</button>
              </div>
            ))}
          </div>
        )}

        {tab === "search" && (
          <div>
            <div className="flex gap-2 mb-3">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()}
                placeholder="Username do jogador…"
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-white placeholder:text-white/40 border border-white/20"
              />
              <button onClick={doSearch} className="px-4 py-2 rounded-lg bg-purple-500 text-white font-bold">Buscar</button>
            </div>
            <div className="space-y-2">
              {results.length === 0 && <div className="text-white/50 text-sm">Digite ao menos 2 caracteres.</div>}
              {results.map((p) => (
                <div key={p.id} className="bg-purple-900/60 border border-purple-400/30 rounded-xl p-3 flex items-center gap-3">
                  <span>{isOnline(p.last_seen_at) ? "🟢" : "⚫"}</span>
                  <div className="flex-1">
                    <div className="text-white font-bold">{p.username}</div>
                    <div className="text-xs text-white/70">Lvl {p.level}</div>
                  </div>
                  <button onClick={() => addFriend(p.id)} className="px-3 py-1 rounded-lg bg-green-500 text-white font-bold text-sm">+ Adicionar</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-bold transition ${
        active ? "bg-yellow-400 text-black" : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}
