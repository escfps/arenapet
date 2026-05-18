-- Mark bot accounts
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_is_bot ON public.profiles(is_bot) WHERE is_bot = true;
CREATE INDEX IF NOT EXISTS idx_profiles_arena_points ON public.profiles(arena_points);

-- Flag existing bots (the 10 originals seeded earlier)
UPDATE public.profiles SET is_bot = true WHERE username IN
  ('xX_Faker_Xx','shroud420','NinjaKzin','TenZ_BR','Loud_Aspas','gaules_TV','CoringaGOD','cellbit77','YoDa_PvP','Pinguim_Doido');

-- Background bot-vs-bot ladder simulator
CREATE OR REPLACE FUNCTION public.simulate_bot_battles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pair RECORD;
  winner_id uuid;
  loser_id uuid;
  win_pts int := 25;
  loss_pts int := 15;
BEGIN
  -- Sample ~120 random bot pairs (similar rating) per tick
  FOR pair IN
    WITH pool AS (
      SELECT id, arena_points,
             row_number() OVER (ORDER BY arena_points, random()) AS rn
      FROM public.profiles
      WHERE is_bot = true
      ORDER BY random()
      LIMIT 240
    )
    SELECT a.id AS a_id, a.arena_points AS a_pts,
           b.id AS b_id, b.arena_points AS b_pts
    FROM pool a
    JOIN pool b ON b.rn = a.rn + 1
    WHERE a.rn % 2 = 1
  LOOP
    -- Higher-rated wins ~60%, lower-rated ~40%
    IF pair.a_pts >= pair.b_pts THEN
      IF random() < 0.6 THEN winner_id := pair.a_id; loser_id := pair.b_id;
      ELSE winner_id := pair.b_id; loser_id := pair.a_id; END IF;
    ELSE
      IF random() < 0.6 THEN winner_id := pair.b_id; loser_id := pair.a_id;
      ELSE winner_id := pair.a_id; loser_id := pair.b_id; END IF;
    END IF;

    UPDATE public.profiles
      SET arena_points = arena_points + win_pts,
          wins = wins + 1
      WHERE id = winner_id;

    UPDATE public.profiles
      SET arena_points = GREATEST(0, arena_points - loss_pts),
          losses = losses + 1
      WHERE id = loser_id;
  END LOOP;
END;
$$;

-- Schedule it every 5 minutes via pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule('simulate-bot-battles');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'simulate-bot-battles',
  '*/5 * * * *',
  $$ SELECT public.simulate_bot_battles(); $$
);