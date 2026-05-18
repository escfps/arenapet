
-- Add expedition slots to profiles (start with 1, buy more with gems up to 5)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expedition_slots integer NOT NULL DEFAULT 1;

-- Expeditions: send monsters to farm XP/coins/items while offline
CREATE TABLE IF NOT EXISTS public.expeditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  monster_id uuid NOT NULL,
  duration_minutes integer NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  claimed boolean NOT NULL DEFAULT false,
  food_cost integer NOT NULL DEFAULT 0,
  xp_reward integer NOT NULL DEFAULT 0,
  coins_reward integer NOT NULL DEFAULT 0,
  gems_reward integer NOT NULL DEFAULT 0,
  ration_drop integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS expeditions_user_active_idx
  ON public.expeditions (user_id) WHERE claimed = false;
CREATE INDEX IF NOT EXISTS expeditions_monster_active_idx
  ON public.expeditions (monster_id) WHERE claimed = false;

ALTER TABLE public.expeditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own expeditions"
  ON public.expeditions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own expeditions"
  ON public.expeditions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own expeditions"
  ON public.expeditions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
