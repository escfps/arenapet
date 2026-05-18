
-- Drop old farming tables
DROP TABLE IF EXISTS public.plots CASCADE;
DROP TABLE IF EXISTS public.animals CASCADE;

-- Drop and recreate handle_new_user (no more plots seeding)
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Extend profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS vip_until timestamptz,
  ADD COLUMN IF NOT EXISTS wins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS losses integer NOT NULL DEFAULT 0;

-- Monsters table
CREATE TABLE public.monsters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  species text NOT NULL,
  name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  xp integer NOT NULL DEFAULT 0,
  hp integer NOT NULL DEFAULT 50,
  atk integer NOT NULL DEFAULT 10,
  def integer NOT NULL DEFAULT 10,
  spd integer NOT NULL DEFAULT 10,
  hunger integer NOT NULL DEFAULT 100,
  energy integer NOT NULL DEFAULT 100,
  happiness integer NOT NULL DEFAULT 100,
  skin text NOT NULL DEFAULT 'default',
  in_team boolean NOT NULL DEFAULT false,
  last_tick timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.monsters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own monsters"
  ON public.monsters
  FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Anyone authenticated can read monsters for PvP"
  ON public.monsters
  FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX idx_monsters_owner ON public.monsters(owner_id);
CREATE INDEX idx_monsters_team ON public.monsters(owner_id, in_team);
CREATE INDEX idx_monsters_level ON public.monsters(level);

-- Battles table
CREATE TABLE public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attacker_id uuid NOT NULL,
  defender_id uuid NOT NULL,
  winner_id uuid NOT NULL,
  log jsonb NOT NULL DEFAULT '[]'::jsonb,
  coins_reward integer NOT NULL DEFAULT 0,
  xp_reward integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players see their battles"
  ON public.battles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = attacker_id OR auth.uid() = defender_id);

CREATE POLICY "Players insert own battles"
  ON public.battles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = attacker_id);

CREATE INDEX idx_battles_attacker ON public.battles(attacker_id, created_at DESC);
CREATE INDEX idx_battles_defender ON public.battles(defender_id, created_at DESC);

-- Skins owned
CREATE TABLE public.skins_owned (
  user_id uuid NOT NULL,
  skin_id text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skin_id)
);

ALTER TABLE public.skins_owned ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skins"
  ON public.skins_owned
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- New signup trigger: profile + 1 starter monster (random species)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  species_pool text[] := ARRAY['flarepup','aquakitty','leafox','voltbun','shadepup'];
  chosen text;
BEGIN
  INSERT INTO public.profiles (id, username, coins, gems)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'Treinador'),
    300,
    20
  );

  chosen := species_pool[1 + floor(random() * array_length(species_pool, 1))::int];

  INSERT INTO public.monsters (owner_id, species, name, in_team)
  VALUES (NEW.id, chosen, 'Bichinho', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
