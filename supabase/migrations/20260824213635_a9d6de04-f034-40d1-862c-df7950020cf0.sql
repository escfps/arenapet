CREATE OR REPLACE FUNCTION public.gym_start_challenge(p_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  g record;
  badge_count int;
  spent int := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO g FROM public.gyms WHERE type = p_type FOR UPDATE;
  IF g IS NULL THEN RAISE EXCEPTION 'ginasio inexistente'; END IF;

  IF g.starter THEN
    RETURN jsonb_build_object('ok', true, 'spent', 0);
  END IF;

  SELECT count(DISTINCT gym_type) INTO badge_count FROM public.gym_badges WHERE user_id = uid;
  IF badge_count < 5 THEN
    RAISE EXCEPTION 'precisa de 5 insignias diferentes';
  END IF;

  WITH doomed AS (
    SELECT id FROM public.gym_badges
    WHERE user_id = uid
    ORDER BY (gym_type = p_type) DESC, earned_at ASC
    LIMIT 5
  )
  DELETE FROM public.gym_badges gb USING doomed d WHERE gb.id = d.id;
  GET DIAGNOSTICS spent = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'spent', spent);
END $$;

REVOKE EXECUTE ON FUNCTION public.gym_start_challenge(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gym_start_challenge(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.gym_report_result(p_type text, p_won boolean, p_pure boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  g record;
  has_badge boolean;
  badge_earned boolean := false;
  became_leader boolean := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO g FROM public.gyms WHERE type = p_type FOR UPDATE;
  IF g IS NULL THEN RAISE EXCEPTION 'ginasio inexistente'; END IF;

  IF NOT p_won THEN
    RETURN jsonb_build_object('ok', true, 'badge_earned', false, 'became_leader', false);
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.gym_badges WHERE user_id = uid AND gym_type = p_type) INTO has_badge;
  IF NOT has_badge AND random() < 0.30 THEN
    INSERT INTO public.gym_badges(user_id, gym_type) VALUES (uid, p_type)
    ON CONFLICT (user_id, gym_type) DO NOTHING;
    badge_earned := true;
  END IF;

  IF p_pure AND COALESCE(g.leader_id, '00000000-0000-0000-0000-000000000000'::uuid) <> uid THEN
    UPDATE public.gyms
      SET leader_id = uid, leader_claimed_at = now(), last_reward_at = now(), defends = 0
      WHERE type = p_type;
    became_leader := true;
  ELSIF p_pure AND g.leader_id = uid THEN
    UPDATE public.gyms SET defends = defends + 1 WHERE type = p_type;
  END IF;

  RETURN jsonb_build_object('ok', true, 'badge_earned', badge_earned, 'became_leader', became_leader);
END $$;

CREATE OR REPLACE FUNCTION public.simulate_bot_gyms()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b record;
  g record;
  badge_count int;
  target text;
  cand_id uuid;
  bot_power numeric;
  leader_power numeric;
  leader_is_bot boolean;
BEGIN
  FOR b IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.is_bot = true
      AND (SELECT count(*) FROM public.monsters m WHERE m.owner_id = p.id AND m.in_team = true) >= 3
    ORDER BY random()
    LIMIT 120
  LOOP
    SELECT count(DISTINCT gym_type) INTO badge_count FROM public.gym_badges WHERE user_id = b.id;

    SELECT gy.type INTO target
    FROM public.gyms gy
    WHERE (gy.starter OR badge_count >= 5)
      AND NOT EXISTS (SELECT 1 FROM public.gym_badges gb WHERE gb.user_id = b.id AND gb.gym_type = gy.type)
    ORDER BY gy.starter DESC, random()
    LIMIT 1;

    IF target IS NULL THEN CONTINUE; END IF;

    IF NOT (SELECT starter FROM public.gyms WHERE type = target) THEN
      WITH doomed AS (
        SELECT id FROM public.gym_badges WHERE user_id = b.id ORDER BY earned_at ASC LIMIT 5
      )
      DELETE FROM public.gym_badges gb USING doomed d WHERE gb.id = d.id;
    END IF;

    IF random() < 0.65 AND random() < 0.30 THEN
      INSERT INTO public.gym_badges(user_id, gym_type) VALUES (b.id, target)
      ON CONFLICT (user_id, gym_type) DO NOTHING;
    END IF;
  END LOOP;

  FOR g IN SELECT * FROM public.gyms ORDER BY random() LOOP
    leader_is_bot := false;
    IF g.leader_id IS NOT NULL THEN
      SELECT is_bot INTO leader_is_bot FROM public.profiles WHERE id = g.leader_id;
      IF NOT COALESCE(leader_is_bot, false) THEN CONTINUE; END IF;
    END IF;

    IF random() > 0.40 THEN CONTINUE; END IF;

    cand_id := NULL;
    SELECT p.id INTO cand_id
    FROM public.profiles p
    WHERE p.is_bot = true
      AND p.id IS DISTINCT FROM g.leader_id
      AND (g.starter OR (SELECT count(DISTINCT gym_type) FROM public.gym_badges gb WHERE gb.user_id = p.id) >= 5)
      AND (
        SELECT count(*) FROM public.monsters m
        JOIN public.species_types st ON st.id = m.species
        WHERE m.owner_id = p.id AND (st.element = g.type OR st.secondary_element = g.type)
      ) >= 3
    ORDER BY random()
    LIMIT 1;

    IF cand_id IS NULL THEN CONTINUE; END IF;
    IF NOT public._bot_set_type_team(cand_id, g.type) THEN CONTINUE; END IF;

    IF NOT g.starter THEN
      WITH doomed AS (
        SELECT id FROM public.gym_badges WHERE user_id = cand_id ORDER BY (gym_type = g.type) DESC, earned_at ASC LIMIT 5
      )
      DELETE FROM public.gym_badges gb USING doomed d WHERE gb.id = d.id;
    END IF;

    bot_power := COALESCE(public._tour_team_power(cand_id), 0);
    leader_power := CASE WHEN g.leader_id IS NULL THEN 0 ELSE COALESCE(public._tour_team_power(g.leader_id), 0) END;

    IF g.leader_id IS NULL
       OR random() < LEAST(0.85, GREATEST(0.15, 0.5 + 0.4 * (bot_power - leader_power) / GREATEST(1, bot_power + leader_power))) THEN
      UPDATE public.gyms
        SET leader_id = cand_id, leader_claimed_at = now(), last_reward_at = now(), defends = 0
        WHERE type = g.type;
      INSERT INTO public.gym_badges(user_id, gym_type) VALUES (cand_id, g.type)
      ON CONFLICT (user_id, gym_type) DO NOTHING;
    ELSE
      UPDATE public.gyms SET defends = defends + 1 WHERE type = g.type;
    END IF;
  END LOOP;

  UPDATE public.profiles p
  SET gems = COALESCE(p.gems, 0) + 50
  FROM public.gyms gy
  WHERE gy.leader_id = p.id AND p.is_bot = true
    AND (gy.last_reward_at IS NULL OR now() >= gy.last_reward_at + interval '24 hours');

  UPDATE public.gyms gy
  SET last_reward_at = now()
  FROM public.profiles p
  WHERE gy.leader_id = p.id AND p.is_bot = true
    AND (gy.last_reward_at IS NULL OR now() >= gy.last_reward_at + interval '24 hours');
END $$;

REVOKE EXECUTE ON FUNCTION public.simulate_bot_gyms() FROM PUBLIC, anon, authenticated;