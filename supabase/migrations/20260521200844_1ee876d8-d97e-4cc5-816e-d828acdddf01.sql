
ALTER TABLE public.friend_challenges
  ADD COLUMN IF NOT EXISTS battle_log jsonb,
  ADD COLUMN IF NOT EXISTS winner_id uuid;
