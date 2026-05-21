
-- 1) last_seen_at on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- 2) friendships table (canonical ordering user_a < user_b)
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  requester_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  CONSTRAINT friendships_order CHECK (user_a < user_b),
  CONSTRAINT friendships_unique UNIQUE (user_a, user_b)
);
CREATE INDEX IF NOT EXISTS friendships_user_a_idx ON public.friendships(user_a);
CREATE INDEX IF NOT EXISTS friendships_user_b_idx ON public.friendships(user_b);

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select" ON public.friendships;
CREATE POLICY "friendships_select" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
CREATE POLICY "friendships_insert" ON public.friendships
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id AND (auth.uid() = user_a OR auth.uid() = user_b));

DROP POLICY IF EXISTS "friendships_update" ON public.friendships;
CREATE POLICY "friendships_update" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b)
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

DROP POLICY IF EXISTS "friendships_delete" ON public.friendships;
CREATE POLICY "friendships_delete" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);

-- 3) friend_messages
CREATE TABLE IF NOT EXISTS public.friend_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS friend_messages_pair_idx
  ON public.friend_messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS friend_messages_receiver_idx
  ON public.friend_messages(receiver_id, read_at);

ALTER TABLE public.friend_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON public.friend_messages;
CREATE POLICY "messages_select" ON public.friend_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "messages_insert" ON public.friend_messages;
CREATE POLICY "messages_insert" ON public.friend_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "messages_update" ON public.friend_messages;
CREATE POLICY "messages_update" ON public.friend_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 4) friend_gifts (one per day per sender->receiver)
CREATE TABLE IF NOT EXISTS public.friend_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  gift_type text NOT NULL CHECK (gift_type IN ('ration','coins')),
  amount integer NOT NULL DEFAULT 1,
  claimed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date
);
CREATE UNIQUE INDEX IF NOT EXISTS friend_gifts_daily_unique
  ON public.friend_gifts(sender_id, receiver_id, sent_date);
CREATE INDEX IF NOT EXISTS friend_gifts_receiver_idx
  ON public.friend_gifts(receiver_id, claimed_at);

ALTER TABLE public.friend_gifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gifts_select" ON public.friend_gifts;
CREATE POLICY "gifts_select" ON public.friend_gifts
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "gifts_insert" ON public.friend_gifts;
CREATE POLICY "gifts_insert" ON public.friend_gifts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "gifts_update" ON public.friend_gifts;
CREATE POLICY "gifts_update" ON public.friend_gifts
  FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id)
  WITH CHECK (auth.uid() = receiver_id);

-- 5) friend_challenges
CREATE TABLE IF NOT EXISTS public.friend_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL,
  target_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','expired')),
  battle_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz
);
CREATE INDEX IF NOT EXISTS friend_challenges_target_idx
  ON public.friend_challenges(target_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS friend_challenges_challenger_idx
  ON public.friend_challenges(challenger_id, status, created_at DESC);

ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "challenges_select" ON public.friend_challenges;
CREATE POLICY "challenges_select" ON public.friend_challenges
  FOR SELECT TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = target_id);

DROP POLICY IF EXISTS "challenges_insert" ON public.friend_challenges;
CREATE POLICY "challenges_insert" ON public.friend_challenges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

DROP POLICY IF EXISTS "challenges_update" ON public.friend_challenges;
CREATE POLICY "challenges_update" ON public.friend_challenges
  FOR UPDATE TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = target_id)
  WITH CHECK (auth.uid() = challenger_id OR auth.uid() = target_id);

-- 6) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_gifts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_challenges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
