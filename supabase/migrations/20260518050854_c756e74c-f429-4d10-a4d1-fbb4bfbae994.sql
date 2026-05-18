
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS arena_points integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_profiles_arena_points ON public.profiles (arena_points DESC);

-- seed bots with varied points so the ladder is populated
UPDATE public.profiles
SET arena_points = floor(random() * 4500)::int
WHERE username LIKE 'Bot%' AND arena_points = 0;
