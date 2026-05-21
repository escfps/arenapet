
-- Seasons table: a season lasts 2 months and rewards are distributed at the end
CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','finished'))
);
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seasons readable by all" ON public.seasons FOR SELECT TO authenticated USING (true);

-- Permanent trophies awarded at the end of each season (for Mestre+ recognition)
CREATE TABLE IF NOT EXISTS public.season_trophies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  season_number integer NOT NULL,
  tier text NOT NULL,
  final_rank integer,
  arena_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, season_number)
);
ALTER TABLE public.season_trophies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trophies readable by all" ON public.season_trophies FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS idx_season_trophies_user ON public.season_trophies(user_id);

-- Seed Season 1 ending in 58 days (only if no season exists)
INSERT INTO public.seasons (number, started_at, ends_at, status)
SELECT 1, now(), now() + interval '58 days', 'active'
WHERE NOT EXISTS (SELECT 1 FROM public.seasons);

-- Helper: returns tier name (matches frontend getTier logic)
CREATE OR REPLACE FUNCTION public._season_tier_name(p_points integer, p_rank integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN p_rank IS NOT NULL AND p_rank <= 10 AND p_points >= 4000 THEN 'Lendário'
    WHEN p_points >= 4000 THEN 'Grão-Mestre'
    WHEN p_points >= 3000 THEN 'Mestre'
    WHEN p_points >= 2500 THEN 'Diamante'
    WHEN p_points >= 2000 THEN 'Platina'
    WHEN p_points >= 1500 THEN 'Ouro'
    WHEN p_points >= 1000 THEN 'Prata'
    WHEN p_points >= 500  THEN 'Bronze'
    ELSE 'Ferro'
  END
$$;

-- Add chest item to inventory (or increase qty)
CREATE OR REPLACE FUNCTION public._season_grant_chest(p_user uuid, p_item text, p_qty integer)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE updated int;
BEGIN
  IF p_qty <= 0 THEN RETURN; END IF;
  UPDATE public.inventory SET quantity = quantity + p_qty
    WHERE user_id = p_user AND item_type = p_item
    RETURNING quantity INTO updated;
  IF updated IS NULL THEN
    INSERT INTO public.inventory(user_id, item_type, quantity) VALUES (p_user, p_item, p_qty);
  END IF;
END $$;

-- End a season: distribute rewards, save trophies, reset points, open next season
CREATE OR REPLACE FUNCTION public.end_season(p_season_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s record;
  r record;
  tier_name text;
  rnk int;
  gems_award int;
  next_num int;
  legendary_pet_species text;
  st record;
BEGIN
  SELECT * INTO s FROM public.seasons WHERE id = p_season_id FOR UPDATE;
  IF s IS NULL OR s.status <> 'active' THEN RETURN; END IF;

  rnk := 0;
  FOR r IN
    SELECT id, arena_points, is_bot
    FROM public.profiles
    WHERE COALESCE(arena_points,0) > 0
    ORDER BY arena_points DESC, id ASC
  LOOP
    rnk := rnk + 1;
    tier_name := public._season_tier_name(COALESCE(r.arena_points,0), rnk);

    gems_award := CASE tier_name
      WHEN 'Lendário'    THEN 800
      WHEN 'Grão-Mestre' THEN 600
      WHEN 'Mestre'      THEN 400
      WHEN 'Diamante'    THEN 250
      WHEN 'Platina'     THEN 150
      WHEN 'Ouro'        THEN 100
      WHEN 'Prata'       THEN 50
      WHEN 'Bronze'      THEN 25
      ELSE 10
    END;

    -- Bots não recebem itens (só pra não inflar inventário)
    IF NOT COALESCE(r.is_bot, false) THEN
      UPDATE public.profiles SET gems = COALESCE(gems,0) + gems_award WHERE id = r.id;

      -- Chest rewards
      IF tier_name = 'Bronze'   THEN PERFORM public._season_grant_chest(r.id, 'wood_chest', 1); END IF;
      IF tier_name = 'Prata'    THEN PERFORM public._season_grant_chest(r.id, 'silver_chest', 1); END IF;
      IF tier_name IN ('Ouro','Platina') THEN PERFORM public._season_grant_chest(r.id, 'gold_chest', 1); END IF;
      IF tier_name = 'Diamante' THEN PERFORM public._season_grant_chest(r.id, 'legendary_chest', 1); END IF;
      IF tier_name = 'Mestre'   THEN PERFORM public._season_grant_chest(r.id, 'legendary_chest', 2); END IF;
      IF tier_name = 'Grão-Mestre' THEN PERFORM public._season_grant_chest(r.id, 'legendary_chest', 3); END IF;
      IF tier_name = 'Lendário' THEN PERFORM public._season_grant_chest(r.id, 'legendary_chest', 5); END IF;

      -- Trophy permanente para Mestre+ (titles), e skin/pet para GM e Lendário
      IF tier_name IN ('Mestre','Grão-Mestre','Lendário') THEN
        INSERT INTO public.season_trophies (user_id, season_number, tier, final_rank, arena_points)
        VALUES (r.id, s.number, tier_name, rnk, COALESCE(r.arena_points,0))
        ON CONFLICT (user_id, season_number) DO NOTHING;
      END IF;

      -- Skin exclusiva para GM e Lendário
      IF tier_name IN ('Grão-Mestre','Lendário') THEN
        INSERT INTO public.skins_owned(user_id, skin_id)
        VALUES (r.id, 'season_' || lower(CASE WHEN tier_name='Lendário' THEN 'legendary' ELSE 'grandmaster' END) || '_s' || s.number)
        ON CONFLICT DO NOTHING;
      END IF;

      -- Pet mítico exclusivo para Lendário
      IF tier_name = 'Lendário' THEN
        legendary_pet_species := public._bot_random_species('mythic');
        SELECT * INTO st FROM public._bot_species_stats(legendary_pet_species);
        IF st.hp IS NOT NULL THEN
          INSERT INTO public.monsters(owner_id, species, name, hp, atk, def, spd, in_team, rank)
          VALUES (r.id, legendary_pet_species, public._bot_species_name(legendary_pet_species) || ' ⭐S' || s.number, st.hp, st.atk, st.def, st.spd, false, 1);
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- Reset arena points e estatísticas de temporada
  UPDATE public.profiles SET arena_points = 0;

  -- Marca season como finalizada
  UPDATE public.seasons SET status='finished', ended_at = now() WHERE id = p_season_id;

  -- Cria próxima season (2 meses)
  SELECT COALESCE(MAX(number),0) + 1 INTO next_num FROM public.seasons;
  INSERT INTO public.seasons(number, started_at, ends_at, status)
  VALUES (next_num, now(), now() + interval '2 months', 'active');
END $$;

-- Tick: encerra qualquer season vencida e garante que exista uma ativa
CREATE OR REPLACE FUNCTION public.seasons_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s record; next_num int;
BEGIN
  FOR s IN
    SELECT id FROM public.seasons WHERE status='active' AND now() >= ends_at
  LOOP
    PERFORM public.end_season(s.id);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.seasons WHERE status='active') THEN
    SELECT COALESCE(MAX(number),0) + 1 INTO next_num FROM public.seasons;
    INSERT INTO public.seasons(number, started_at, ends_at, status)
    VALUES (next_num, now(), now() + interval '2 months', 'active');
  END IF;
END $$;
