-- Add rank to monsters
ALTER TABLE public.monsters
  ADD COLUMN IF NOT EXISTS rank int NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE public.monsters
    ADD CONSTRAINT monsters_rank_range CHECK (rank >= 1 AND rank <= 10);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_monsters_owner_species_rank
  ON public.monsters (owner_id, species, rank);

-- Trades table
CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  from_monster_id uuid NOT NULL REFERENCES public.monsters(id) ON DELETE CASCADE,
  to_monster_id uuid REFERENCES public.monsters(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  from_confirmed boolean NOT NULL DEFAULT false,
  to_confirmed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT trades_status_check CHECK (status IN ('pending','accepted','completed','cancelled','expired')),
  CONSTRAINT trades_not_self CHECK (from_user_id <> to_user_id)
);

CREATE INDEX IF NOT EXISTS idx_trades_to_user ON public.trades (to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_trades_from_user ON public.trades (from_user_id, status);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their trades" ON public.trades;
CREATE POLICY "Users see their trades"
  ON public.trades FOR SELECT
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "Users create trades they send" ON public.trades;
CREATE POLICY "Users create trades they send"
  ON public.trades FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Users update their trades" ON public.trades;
CREATE POLICY "Users update their trades"
  ON public.trades FOR UPDATE
  TO authenticated
  USING (auth.uid() = from_user_id OR auth.uid() = to_user_id)
  WITH CHECK (auth.uid() = from_user_id OR auth.uid() = to_user_id);

DROP POLICY IF EXISTS "Anyone authenticated can read profiles for trades" ON public.profiles;
CREATE POLICY "Anyone authenticated can read profiles for trades"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);