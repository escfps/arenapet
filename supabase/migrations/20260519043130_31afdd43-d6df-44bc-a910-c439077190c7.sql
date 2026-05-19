-- ===== Tabelas =====
CREATE TABLE public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_at timestamptz NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','finished')),
  champion_id uuid,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tournaments_slot_idx ON public.tournaments(slot_at DESC);
CREATE INDEX tournaments_status_idx ON public.tournaments(status, slot_at);

CREATE TABLE public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  is_bot boolean NOT NULL DEFAULT false,
  seed int,
  power numeric DEFAULT 0,
  eliminated_round int,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tournament_id, user_id)
);
CREATE INDEX te_tournament_idx ON public.tournament_entries(tournament_id);

CREATE TABLE public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  round int NOT NULL,
  slot int NOT NULL,
  p1_id uuid,
  p2_id uuid,
  winner_id uuid,
  score text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tm_tournament_idx ON public.tournament_matches(tournament_id, round, slot);

CREATE TABLE public.tournament_champions (
  user_id uuid PRIMARY KEY,
  wins int NOT NULL DEFAULT 0,
  last_win_at timestamptz
);

-- ===== RLS =====
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_champions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read tournaments" ON public.tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "read entries" ON public.tournament_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "read matches" ON public.tournament_matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "read champions" ON public.tournament_champions FOR SELECT TO authenticated USING (true);

-- ===== Helpers =====
CREATE OR REPLACE FUNCTION public._tour_rank_mult(r int)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path=public AS $$
  SELECT CASE GREATEST(LEAST(r,10),1)
    WHEN 1 THEN 1.0 WHEN 2 THEN 1.2 WHEN 3 THEN 1.5 WHEN 4 THEN 1.9
    WHEN 5 THEN 2.4 WHEN 6 THEN 3.0 WHEN 7 THEN 3.8 WHEN 8 THEN 4.7
    WHEN 9 THEN 5.7 WHEN 10 THEN 7.0 ELSE 1.0 END
$$;

CREATE OR REPLACE FUNCTION public._tour_team_power(uid uuid)
RETURNS numeric LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT COALESCE(SUM(
    (COALESCE(m.hp,0) + COALESCE(m.atk,0)*3 + COALESCE(m.def,0)*2 + COALESCE(m.spd,0)*2 + COALESCE(m.int,0))
    * public._tour_rank_mult(COALESCE(m.rank,1))
  ), 1)
  FROM (
    SELECT * FROM public.monsters
    WHERE owner_id = uid AND in_team = true
    ORDER BY team_position ASC, created_at ASC
    LIMIT 3
  ) m
$$;

CREATE OR REPLACE FUNCTION public._tour_next_slot()
RETURNS timestamptz LANGUAGE sql STABLE AS $$
  SELECT date_trunc('hour', now())
       + ((floor(extract(minute from now())::int / 10) + 1) * interval '10 minutes')
$$;

CREATE OR REPLACE FUNCTION public.ensure_tournament(slot timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE tid uuid;
BEGIN
  SELECT id INTO tid FROM public.tournaments WHERE slot_at = slot;
  IF tid IS NULL THEN
    INSERT INTO public.tournaments(slot_at) VALUES (slot) RETURNING id INTO tid;
  END IF;
  RETURN tid;
END $$;

-- ===== Inscrição (paga 1 diamante) =====
CREATE OR REPLACE FUNCTION public.join_tournament(p_tournament_id uuid)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  t record;
  uid uuid := auth.uid();
  cur_gems int;
  team_cnt int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = p_tournament_id;
  IF t IS NULL THEN RAISE EXCEPTION 'torneio nao existe'; END IF;
  IF t.status <> 'open' THEN RAISE EXCEPTION 'inscricoes fechadas'; END IF;
  IF now() >= t.slot_at + interval '1 minute' THEN RAISE EXCEPTION 'inscricoes fechadas'; END IF;
  IF EXISTS (SELECT 1 FROM public.tournament_entries WHERE tournament_id = p_tournament_id AND user_id = uid) THEN
    RAISE EXCEPTION 'voce ja esta inscrito';
  END IF;
  SELECT count(*) INTO team_cnt FROM public.monsters WHERE owner_id = uid AND in_team = true;
  IF team_cnt < 3 THEN RAISE EXCEPTION 'monte um time com 3 pets antes'; END IF;
  SELECT gems INTO cur_gems FROM public.profiles WHERE id = uid;
  IF COALESCE(cur_gems,0) < 1 THEN RAISE EXCEPTION 'diamantes insuficientes'; END IF;
  UPDATE public.profiles SET gems = gems - 1 WHERE id = uid;
  INSERT INTO public.tournament_entries(tournament_id, user_id, is_bot, power)
  VALUES (p_tournament_id, uid, false, public._tour_team_power(uid));
  RETURN json_build_object('ok', true);
END $$;

-- ===== Roda o torneio (chaveamento + MD3 + premiação) =====
CREATE OR REPLACE FUNCTION public.run_tournament(p_tournament_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  cnt int;
  need int;
  bot record;
  entries_arr uuid[];
  next_arr uuid[];
  match_winner uuid;
  p1 uuid; p2 uuid;
  pw1 numeric; pw2 numeric;
  w1 int; w2 int;
  i int;
  round_num int;
  match_slot int;
  champion uuid;
  reward_coins int := 5000;
  reward_gems int := 80;
  reward_rations int := 10;
  bonus_species text;
  updated_rations int;
BEGIN
  PERFORM 1 FROM public.tournaments WHERE id = p_tournament_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO cnt FROM public.tournament_entries WHERE tournament_id = p_tournament_id;
  need := 32 - cnt;

  IF need > 0 THEN
    FOR bot IN
      SELECT p.id
      FROM public.profiles p
      WHERE p.is_bot = true
        AND p.id NOT IN (SELECT user_id FROM public.tournament_entries WHERE tournament_id = p_tournament_id)
        AND (SELECT count(*) FROM public.monsters m WHERE m.owner_id = p.id AND m.in_team = true) >= 3
      ORDER BY random()
      LIMIT need
    LOOP
      INSERT INTO public.tournament_entries(tournament_id, user_id, is_bot, power)
      VALUES (p_tournament_id, bot.id, true, public._tour_team_power(bot.id));
    END LOOP;
  END IF;

  SELECT count(*) INTO cnt FROM public.tournament_entries WHERE tournament_id = p_tournament_id;
  IF cnt < 32 THEN
    UPDATE public.tournaments SET status='finished', finished_at=now() WHERE id = p_tournament_id;
    RETURN;
  END IF;

  -- Sorteio dos seeds
  WITH shuffled AS (
    SELECT id, (row_number() OVER (ORDER BY random()) - 1)::int AS s
    FROM public.tournament_entries WHERE tournament_id = p_tournament_id
  )
  UPDATE public.tournament_entries te SET seed = s.s
  FROM shuffled s WHERE te.id = s.id;

  SELECT array_agg(user_id ORDER BY seed) INTO entries_arr
  FROM public.tournament_entries WHERE tournament_id = p_tournament_id;

  round_num := 1;
  WHILE array_length(entries_arr, 1) > 1 LOOP
    next_arr := ARRAY[]::uuid[];
    match_slot := 0;
    FOR i IN 0..(array_length(entries_arr,1)/2 - 1) LOOP
      p1 := entries_arr[i*2 + 1];
      p2 := entries_arr[i*2 + 2];
      SELECT power INTO pw1 FROM public.tournament_entries WHERE tournament_id = p_tournament_id AND user_id = p1;
      SELECT power INTO pw2 FROM public.tournament_entries WHERE tournament_id = p_tournament_id AND user_id = p2;
      pw1 := GREATEST(COALESCE(pw1, 1), 1);
      pw2 := GREATEST(COALESCE(pw2, 1), 1);
      w1 := 0; w2 := 0;
      WHILE w1 < 2 AND w2 < 2 LOOP
        IF random() < (pw1 / (pw1 + pw2)) THEN w1 := w1 + 1; ELSE w2 := w2 + 1; END IF;
      END LOOP;
      IF w1 = 2 THEN match_winner := p1; ELSE match_winner := p2; END IF;
      INSERT INTO public.tournament_matches(tournament_id, round, slot, p1_id, p2_id, winner_id, score)
      VALUES (p_tournament_id, round_num, match_slot, p1, p2, match_winner, w1 || '-' || w2);
      UPDATE public.tournament_entries
        SET eliminated_round = round_num
        WHERE tournament_id = p_tournament_id
          AND user_id = CASE WHEN match_winner = p1 THEN p2 ELSE p1 END;
      next_arr := array_append(next_arr, match_winner);
      match_slot := match_slot + 1;
    END LOOP;
    entries_arr := next_arr;
    round_num := round_num + 1;
  END LOOP;
  champion := entries_arr[1];

  UPDATE public.tournaments
    SET status='finished', finished_at=now(), champion_id=champion
    WHERE id = p_tournament_id;

  IF champion IS NOT NULL THEN
    UPDATE public.profiles
      SET coins = coins + reward_coins, gems = gems + reward_gems
      WHERE id = champion;
    UPDATE public.inventory SET quantity = quantity + reward_rations
      WHERE user_id = champion AND item_type = 'ration'
      RETURNING quantity INTO updated_rations;
    IF updated_rations IS NULL THEN
      INSERT INTO public.inventory(user_id, item_type, quantity)
      VALUES (champion, 'ration', reward_rations);
    END IF;
    SELECT public._bot_random_species(
      CASE WHEN random() < 0.10 THEN 'epic'
           WHEN random() < 0.45 THEN 'super_rare'
           ELSE 'rare' END
    ) INTO bonus_species;
    INSERT INTO public.monsters(owner_id, species, name, hp, atk, def, spd, in_team)
    SELECT champion, bonus_species, public._bot_species_name(bonus_species), s.hp, s.atk, s.def, s.spd, false
    FROM public._bot_species_stats(bonus_species) s
    LIMIT 1;
    INSERT INTO public.tournament_champions(user_id, wins, last_win_at)
    VALUES (champion, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET wins = public.tournament_champions.wins + 1, last_win_at = now();
  END IF;
END $$;

-- ===== Tick automático: fecha torneios expirados e garante o próximo =====
CREATE OR REPLACE FUNCTION public.tournaments_tick()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t record; next_slot timestamptz;
BEGIN
  FOR t IN
    SELECT id FROM public.tournaments
    WHERE status='open' AND now() >= slot_at + interval '1 minute'
  LOOP
    PERFORM public.run_tournament(t.id);
  END LOOP;
  next_slot := public._tour_next_slot();
  PERFORM public.ensure_tournament(next_slot);
END $$;

-- ===== Cron a cada minuto =====
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('tournaments-tick', '* * * * *', $$SELECT public.tournaments_tick();$$);

-- Garante o primeiro torneio aberto agora
SELECT public.ensure_tournament(public._tour_next_slot());