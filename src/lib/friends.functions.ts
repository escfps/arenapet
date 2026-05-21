import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function pair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// ---------- Heartbeat / online ----------
export const heartbeat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await supabaseAdmin
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", context.userId);
    return { ok: true };
  });

// ---------- Search ----------
export const searchPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ q: z.string().trim().min(2).max(30) }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id, username, level, arena_points, last_seen_at, is_bot")
      .ilike("username", `%${data.q}%`)
      .neq("id", context.userId)
      .eq("is_bot", false)
      .limit(20);
    return { players: rows ?? [] };
  });

// ---------- List friends + pending requests ----------
export const listFriends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const { data: rows } = await supabaseAdmin
      .from("friendships")
      .select("id, user_a, user_b, requester_id, status, created_at, accepted_at")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`)
      .order("created_at", { ascending: false });

    const list = rows ?? [];
    const otherIds = list.map((r) => (r.user_a === uid ? r.user_b : r.user_a));

    let profiles: Record<string, { id: string; username: string; level: number; arena_points: number; last_seen_at: string | null; wins: number; losses: number }> = {};
    if (otherIds.length > 0) {
      const { data: ps } = await supabaseAdmin
        .from("profiles")
        .select("id, username, level, arena_points, last_seen_at, wins, losses")
        .in("id", otherIds);
      profiles = Object.fromEntries((ps ?? []).map((p) => [p.id, p]));
    }

    // unread counts per friend
    const { data: unread } = await supabaseAdmin
      .from("friend_messages")
      .select("sender_id")
      .eq("receiver_id", uid)
      .is("read_at", null);
    const unreadCount: Record<string, number> = {};
    (unread ?? []).forEach((m) => {
      unreadCount[m.sender_id] = (unreadCount[m.sender_id] ?? 0) + 1;
    });

    // unclaimed gifts
    const { data: gifts } = await supabaseAdmin
      .from("friend_gifts")
      .select("sender_id")
      .eq("receiver_id", uid)
      .is("claimed_at", null);
    const giftFrom = new Set((gifts ?? []).map((g) => g.sender_id));

    const friends = list
      .filter((r) => r.status === "accepted")
      .map((r) => {
        const otherId = r.user_a === uid ? r.user_b : r.user_a;
        const p = profiles[otherId];
        return {
          friendshipId: r.id,
          id: otherId,
          username: p?.username ?? "?",
          level: p?.level ?? 1,
          arena_points: p?.arena_points ?? 0,
          last_seen_at: p?.last_seen_at ?? null,
          wins: p?.wins ?? 0,
          losses: p?.losses ?? 0,
          unread: unreadCount[otherId] ?? 0,
          hasGift: giftFrom.has(otherId),
        };
      });

    const incoming = list
      .filter((r) => r.status === "pending" && r.requester_id !== uid)
      .map((r) => {
        const otherId = r.user_a === uid ? r.user_b : r.user_a;
        const p = profiles[otherId];
        return {
          friendshipId: r.id,
          id: otherId,
          username: p?.username ?? "?",
          level: p?.level ?? 1,
        };
      });

    const outgoing = list
      .filter((r) => r.status === "pending" && r.requester_id === uid)
      .map((r) => {
        const otherId = r.user_a === uid ? r.user_b : r.user_a;
        const p = profiles[otherId];
        return {
          friendshipId: r.id,
          id: otherId,
          username: p?.username ?? "?",
        };
      });

    return { friends, incoming, outgoing };
  });

// ---------- Send / accept / reject / remove ----------
export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ targetId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    if (data.targetId === context.userId) throw new Error("Você não pode adicionar a si mesmo");
    const { data: target } = await supabaseAdmin
      .from("profiles")
      .select("id, is_bot")
      .eq("id", data.targetId)
      .maybeSingle();
    if (!target) throw new Error("Jogador não encontrado");
    if (target.is_bot) throw new Error("Você não pode adicionar um bot");

    const [a, b] = pair(context.userId, data.targetId);
    const { data: existing } = await supabaseAdmin
      .from("friendships")
      .select("id, status")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (existing) {
      if (existing.status === "accepted") throw new Error("Vocês já são amigos");
      throw new Error("Já existe uma solicitação pendente");
    }
    const { error } = await supabaseAdmin.from("friendships").insert({
      user_a: a,
      user_b: b,
      requester_id: context.userId,
      status: "pending",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const respondFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ friendshipId: z.string().uuid(), accept: z.boolean() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: row } = await supabaseAdmin
      .from("friendships")
      .select("id, user_a, user_b, requester_id, status")
      .eq("id", data.friendshipId)
      .maybeSingle();
    if (!row) throw new Error("Solicitação não encontrada");
    if (row.user_a !== context.userId && row.user_b !== context.userId)
      throw new Error("Sem permissão");
    if (row.requester_id === context.userId) throw new Error("Aguarde a resposta do outro");
    if (row.status !== "pending") throw new Error("Solicitação já respondida");

    if (data.accept) {
      const { error } = await supabaseAdmin
        .from("friendships")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", row.id);
      if (error) throw new Error(error.message);
    } else {
      await supabaseAdmin.from("friendships").delete().eq("id", row.id);
    }
    return { ok: true };
  });

export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ friendId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [a, b] = pair(context.userId, data.friendId);
    await supabaseAdmin.from("friendships").delete().eq("user_a", a).eq("user_b", b);
    return { ok: true };
  });

// ---------- Friend profile ----------
export const getFriendProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ friendId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [a, b] = pair(context.userId, data.friendId);
    const { data: f } = await supabaseAdmin
      .from("friendships")
      .select("id, status")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (!f || f.status !== "accepted") throw new Error("Não é seu amigo");

    const { data: p } = await supabaseAdmin
      .from("profiles")
      .select("id, username, level, xp, arena_points, wins, losses, last_seen_at, vip_until")
      .eq("id", data.friendId)
      .single();

    const { data: team } = await supabaseAdmin
      .from("monsters")
      .select("id, name, species, rank, hp, atk, def, spd, int, in_team, team_position")
      .eq("owner_id", data.friendId)
      .eq("in_team", true)
      .order("team_position", { ascending: true })
      .limit(3);

    // today gift sent?
    const today = new Date().toISOString().slice(0, 10);
    const { data: giftToday } = await supabaseAdmin
      .from("friend_gifts")
      .select("id")
      .eq("sender_id", context.userId)
      .eq("receiver_id", data.friendId)
      .eq("sent_date", today)
      .maybeSingle();

    return { profile: p, team: team ?? [], giftSentToday: !!giftToday };
  });

// ---------- Chat ----------
export const listMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ friendId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { data: msgs } = await supabaseAdmin
      .from("friend_messages")
      .select("id, sender_id, receiver_id, content, read_at, created_at")
      .or(
        `and(sender_id.eq.${uid},receiver_id.eq.${data.friendId}),and(sender_id.eq.${data.friendId},receiver_id.eq.${uid})`
      )
      .order("created_at", { ascending: true })
      .limit(200);
    // mark received as read
    await supabaseAdmin
      .from("friend_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("sender_id", data.friendId)
      .eq("receiver_id", uid)
      .is("read_at", null);
    return { messages: msgs ?? [] };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        friendId: z.string().uuid(),
        content: z.string().trim().min(1).max(500),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const [a, b] = pair(context.userId, data.friendId);
    const { data: f } = await supabaseAdmin
      .from("friendships")
      .select("status")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (!f || f.status !== "accepted") throw new Error("Não é seu amigo");
    const { error } = await supabaseAdmin.from("friend_messages").insert({
      sender_id: context.userId,
      receiver_id: data.friendId,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Gifts ----------
export const sendGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ friendId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [a, b] = pair(context.userId, data.friendId);
    const { data: f } = await supabaseAdmin
      .from("friendships")
      .select("status")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (!f || f.status !== "accepted") throw new Error("Não é seu amigo");

    // random ration or 50 coins
    const isRation = Math.random() < 0.5;
    const giftType = isRation ? "ration" : "coins";
    const amount = isRation ? 1 : 50;
    const { error } = await supabaseAdmin.from("friend_gifts").insert({
      sender_id: context.userId,
      receiver_id: data.friendId,
      gift_type: giftType,
      amount,
    });
    if (error) {
      if (error.message.includes("friend_gifts_daily_unique") || error.code === "23505")
        throw new Error("Você já enviou um presente hoje para esse amigo");
      throw new Error(error.message);
    }
    return { ok: true, giftType, amount };
  });

export const listIncomingGifts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: gifts } = await supabaseAdmin
      .from("friend_gifts")
      .select("id, sender_id, gift_type, amount, created_at")
      .eq("receiver_id", context.userId)
      .is("claimed_at", null)
      .order("created_at", { ascending: false })
      .limit(50);
    const senderIds = Array.from(new Set((gifts ?? []).map((g) => g.sender_id)));
    let usernames: Record<string, string> = {};
    if (senderIds.length) {
      const { data: ps } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", senderIds);
      usernames = Object.fromEntries((ps ?? []).map((p) => [p.id, p.username]));
    }
    return {
      gifts: (gifts ?? []).map((g) => ({ ...g, sender_name: usernames[g.sender_id] ?? "?" })),
    };
  });

export const claimGift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ giftId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: g } = await supabaseAdmin
      .from("friend_gifts")
      .select("id, receiver_id, gift_type, amount, claimed_at")
      .eq("id", data.giftId)
      .maybeSingle();
    if (!g || g.receiver_id !== context.userId) throw new Error("Presente inválido");
    if (g.claimed_at) throw new Error("Já resgatado");

    const { data: claimed } = await supabaseAdmin
      .from("friend_gifts")
      .update({ claimed_at: new Date().toISOString() })
      .eq("id", g.id)
      .is("claimed_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("Já resgatado");

    if (g.gift_type === "coins") {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("coins")
        .eq("id", context.userId)
        .single();
      await supabaseAdmin
        .from("profiles")
        .update({ coins: (p?.coins ?? 0) + g.amount })
        .eq("id", context.userId);
    } else if (g.gift_type === "ration") {
      const { data: inv } = await supabaseAdmin
        .from("inventory")
        .select("quantity")
        .eq("user_id", context.userId)
        .eq("item_type", "ration")
        .maybeSingle();
      if (inv) {
        await supabaseAdmin
          .from("inventory")
          .update({ quantity: inv.quantity + g.amount })
          .eq("user_id", context.userId)
          .eq("item_type", "ration");
      } else {
        await supabaseAdmin
          .from("inventory")
          .insert({ user_id: context.userId, item_type: "ration", quantity: g.amount });
      }
    }
    return { ok: true, type: g.gift_type, amount: g.amount };
  });

// ---------- Challenges ----------
export const sendChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ friendId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const [a, b] = pair(context.userId, data.friendId);
    const { data: f } = await supabaseAdmin
      .from("friendships")
      .select("status")
      .eq("user_a", a)
      .eq("user_b", b)
      .maybeSingle();
    if (!f || f.status !== "accepted") throw new Error("Não é seu amigo");

    // expire old pending challenges between them
    await supabaseAdmin
      .from("friend_challenges")
      .update({ status: "expired" })
      .eq("status", "pending")
      .or(
        `and(challenger_id.eq.${context.userId},target_id.eq.${data.friendId}),and(challenger_id.eq.${data.friendId},target_id.eq.${context.userId})`
      );

    const { data: ins, error } = await supabaseAdmin
      .from("friend_challenges")
      .insert({
        challenger_id: context.userId,
        target_id: data.friendId,
        status: "pending",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, challengeId: ins.id };
  });

export const respondChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ challengeId: z.string().uuid(), accept: z.boolean() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: c } = await supabaseAdmin
      .from("friend_challenges")
      .select("id, challenger_id, target_id, status")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!c || c.target_id !== context.userId) throw new Error("Desafio inválido");
    if (c.status !== "pending") throw new Error("Desafio já respondido");
    await supabaseAdmin
      .from("friend_challenges")
      .update({
        status: data.accept ? "accepted" : "declined",
        responded_at: new Date().toISOString(),
      })
      .eq("id", c.id);
    return { ok: true };
  });

export const listIncomingChallenges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: chals } = await supabaseAdmin
      .from("friend_challenges")
      .select("id, challenger_id, created_at")
      .eq("target_id", context.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    const ids = Array.from(new Set((chals ?? []).map((c) => c.challenger_id)));
    let names: Record<string, string> = {};
    if (ids.length) {
      const { data: ps } = await supabaseAdmin
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      names = Object.fromEntries((ps ?? []).map((p) => [p.id, p.username]));
    }
    return {
      challenges: (chals ?? []).map((c) => ({
        ...c,
        challenger_name: names[c.challenger_id] ?? "?",
      })),
    };
  });

export const saveChallengeResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        challengeId: z.string().uuid(),
        winnerId: z.string().uuid(),
        log: z.any(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { data: c } = await supabaseAdmin
      .from("friend_challenges")
      .select("id, challenger_id, target_id, status, winner_id")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!c) throw new Error("Desafio inválido");
    if (c.challenger_id !== context.userId && c.target_id !== context.userId)
      throw new Error("Sem permissão");
    if (c.winner_id) return { ok: true, alreadySet: true };
    await supabaseAdmin
      .from("friend_challenges")
      .update({ winner_id: data.winnerId, battle_log: data.log, status: "accepted" })
      .eq("id", c.id)
      .is("winner_id", null);
    return { ok: true };
  });

export const getChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ challengeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: c } = await supabaseAdmin
      .from("friend_challenges")
      .select("id, challenger_id, target_id, status, winner_id, battle_log, created_at")
      .eq("id", data.challengeId)
      .maybeSingle();
    if (!c) throw new Error("Desafio não encontrado");
    if (c.challenger_id !== context.userId && c.target_id !== context.userId)
      throw new Error("Sem permissão");
    return c;
  });
