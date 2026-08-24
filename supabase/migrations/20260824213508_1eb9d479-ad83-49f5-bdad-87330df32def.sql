CREATE OR REPLACE FUNCTION public._bot_set_type_team(p_bot uuid, p_type text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ids uuid[];
BEGIN
  SELECT array_agg(m.id ORDER BY (m.hp + m.atk*3 + m.def*2 + m.spd*2 + m.int*2) DESC)
  INTO ids
  FROM public.monsters m
  JOIN public.species_types st ON st.id = m.species
  WHERE m.owner_id = p_bot
    AND (st.element = p_type OR st.secondary_element = p_type);

  IF ids IS NULL OR array_length(ids, 1) < 3 THEN RETURN false; END IF;
  ids := ids[1:3];

  UPDATE public.monsters SET in_team = false WHERE owner_id = p_bot AND in_team = true;
  UPDATE public.monsters m
  SET in_team = true, team_position = x.pos
  FROM (SELECT unnest(ids) AS id, generate_subscripts(ids, 1) - 1 AS pos) x
  WHERE m.id = x.id AND m.owner_id = p_bot;

  RETURN true;
END $$;

REVOKE EXECUTE ON FUNCTION public._bot_set_type_team(uuid, text) FROM PUBLIC, anon, authenticated;

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
    WHERE (gy.starter OR badge_count >= 4)
      AND NOT EXISTS (SELECT 1 FROM public.gym_badges gb WHERE gb.user_id = b.id AND gb.gym_type = gy.type)
    ORDER BY random()
    LIMIT 1;

    IF target IS NULL THEN CONTINUE; END IF;

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
      AND (g.starter OR (SELECT count(DISTINCT gym_type) FROM public.gym_badges gb WHERE gb.user_id = p.id) >= 4)
      AND (
        SELECT count(*) FROM public.monsters m
        JOIN public.species_types st ON st.id = m.species
        WHERE m.owner_id = p.id AND (st.element = g.type OR st.secondary_element = g.type)
      ) >= 3
    ORDER BY random()
    LIMIT 1;

    IF cand_id IS NULL THEN CONTINUE; END IF;
    IF NOT public._bot_set_type_team(cand_id, g.type) THEN CONTINUE; END IF;

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