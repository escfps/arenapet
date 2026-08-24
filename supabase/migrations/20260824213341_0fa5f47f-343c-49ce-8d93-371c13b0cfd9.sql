CREATE TABLE IF NOT EXISTS public.species_types (
  id text PRIMARY KEY,
  element text NOT NULL,
  secondary_element text,
  retired boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.species_types TO authenticated;
GRANT SELECT ON public.species_types TO anon;
GRANT ALL ON public.species_types TO service_role;
ALTER TABLE public.species_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Species types are viewable by everyone" ON public.species_types;
CREATE POLICY "Species types are viewable by everyone" ON public.species_types FOR SELECT USING (true);

INSERT INTO public.species_types (id, element, secondary_element)
SELECT unnest(string_to_array(v.ids, ' ')), v.el, v.el2
FROM (VALUES
('ghost','poison','gengar gastly haunter'),
('electric',NULL,'pikachu raichu voltorb electrode electabuzz jolteon'),
('psychic',NULL,'alakazam abra kadabra drowzee hypno mewtwo'),
('fire',NULL,'charmander charmeleon vulpix ninetales growlithe arcanine ponyta rapidash magmar flareon'),
('fire','flying','charizard moltres'),
('water',NULL,'squirtle wartortle blastoise psyduck golduck poliwag poliwhirl seel shellder krabby kingler horsea seadra goldeen seaking staryu magikarp vaporeon'),
('grass','poison','bulbasaur ivysaur venusaur oddish gloom vileplume bellsprout weepinbell victreebel'),
('bug',NULL,'caterpie metapod pinsir'),
('bug','flying','butterfree scyther'),
('bug','poison','weedle kakuna beedrill venonat venomoth'),
('normal','flying','pidgey pidgeotto pidgeot spearow fearow farfetchd doduo dodrio'),
('normal',NULL,'rattata raticate meowth persian lickitung chansey kangaskhan tauros ditto eevee porygon snorlax'),
('poison',NULL,'ekans arbok nidoran_f nidorina nidoran_m nidorino grimer muk koffing weezing'),
('ground',NULL,'sandshrew sandslash diglett dugtrio cubone marowak'),
('poison','ground','nidoqueen nidoking'),
('fairy',NULL,'clefairy clefable'),
('normal','fairy','jigglypuff wigglytuff'),
('poison','flying','zubat golbat'),
('bug','grass','paras parasect'),
('fighting',NULL,'mankey primeape machop machoke machamp hitmonlee hitmonchan'),
('water','fighting','poliwrath'),
('water','poison','tentacool tentacruel'),
('rock','ground','geodude graveler golem onix'),
('water','psychic','slowpoke slowbro starmie'),
('electric','steel','magnemite magneton'),
('water','ice','dewgong cloyster lapras'),
('grass','psychic','exeggcute exeggutor'),
('ground','rock','rhyhorn rhydon'),
('grass',NULL,'tangela'),
('psychic','fairy','mrmime mew'),
('ice','psychic','jynx'),
('water','flying','gyarados'),
('rock','water','omanyte kabuto kabutops omastar'),
('rock','flying','aerodactyl'),
('ice','flying','articuno'),
('electric','flying','zapdos'),
('dragon',NULL,'dratini dragonair'),
('dragon','flying','dragonite')
) AS v(el, el2, ids)
ON CONFLICT (id) DO UPDATE SET element = EXCLUDED.element, secondary_element = EXCLUDED.secondary_element;

CREATE OR REPLACE FUNCTION public._bot_pure_type(p_bot uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE team_size int; t text;
BEGIN
  SELECT count(*) INTO team_size FROM public.monsters WHERE owner_id = p_bot AND in_team = true;
  IF COALESCE(team_size,0) < 3 THEN RETURN NULL; END IF;

  SELECT x.ty INTO t
  FROM (
    SELECT unnest(ARRAY[st.element, st.secondary_element]) AS ty
    FROM public.monsters m
    JOIN public.species_types st ON st.id = m.species
    WHERE m.owner_id = p_bot AND m.in_team = true
  ) x
  WHERE x.ty IS NOT NULL
  GROUP BY x.ty
  HAVING count(*) >= team_size
  ORDER BY random()
  LIMIT 1;
  RETURN t;
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

    IF random() > 0.30 THEN CONTINUE; END IF;

    cand_id := NULL;
    SELECT p.id INTO cand_id
    FROM public.profiles p
    WHERE p.is_bot = true
      AND p.id IS DISTINCT FROM g.leader_id
      AND (g.starter OR (SELECT count(DISTINCT gym_type) FROM public.gym_badges gb WHERE gb.user_id = p.id) >= 4)
      AND public._bot_pure_type(p.id) = g.type
    ORDER BY random()
    LIMIT 1;

    IF cand_id IS NULL THEN CONTINUE; END IF;

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

REVOKE EXECUTE ON FUNCTION public.simulate_bot_gyms() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._bot_pure_type(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simulate_bot_gyms() TO authenticated;
GRANT EXECUTE ON FUNCTION public._bot_pure_type(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.simulate_bot_battles()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  pair RECORD;
  winner_id uuid;
  loser_id uuid;
  win_pts int;
  loss_pts int;
  win_xp int := 30;
  loss_xp int := 10;
  win_coins int := 100;
  winner_pts int;
  chest_rarity text;
  pw_a numeric;
  pw_b numeric;
  p_a numeric;
  activity numeric;
  hour_local int := EXTRACT(hour FROM now() AT TIME ZONE 'America/Sao_Paulo')::int;
BEGIN
  activity := CASE
    WHEN hour_local BETWEEN 0 AND 6 THEN 0.30
    WHEN hour_local BETWEEN 7 AND 11 THEN 0.60
    WHEN hour_local BETWEEN 12 AND 17 THEN 0.80
    ELSE 1.00
  END;

  UPDATE public.monsters m
  SET battle_energy = 24, battle_energy_at = now(), hunger = 100
  FROM public.profiles p
  WHERE p.id = m.owner_id AND p.is_bot = true
    AND (m.battle_energy < 24 OR m.hunger < 100);

  FOR pair IN
    WITH pool AS (
      SELECT id, arena_points,
             row_number() OVER (ORDER BY arena_points, random()) AS rn
      FROM public.profiles
      WHERE is_bot = true AND random() < activity
      ORDER BY random()
      LIMIT 1800
    )
    SELECT a.id AS a_id, a.arena_points AS a_pts,
           b.id AS b_id, b.arena_points AS b_pts
    FROM pool a JOIN pool b ON b.rn = a.rn + 1
    WHERE a.rn % 2 = 1
  LOOP
    pw_a := COALESCE(public._tour_team_power(pair.a_id), 0);
    pw_b := COALESCE(public._tour_team_power(pair.b_id), 0);

    p_a := LEAST(0.85, GREATEST(0.15,
      0.5 + 0.45 * (pw_a - pw_b) / GREATEST(1, pw_a + pw_b)));

    IF random() < p_a THEN winner_id := pair.a_id; loser_id := pair.b_id;
    ELSE winner_id := pair.b_id; loser_id := pair.a_id; END IF;

    win_pts := 15 + floor(random() * 6)::int;
    loss_pts := 15 + floor(random() * 6)::int;

    UPDATE public.profiles
      SET arena_points = arena_points + win_pts, wins = wins + 1, coins = coins + win_coins,
          last_seen_at = now() - (random() * interval '8 minutes')
      WHERE id = winner_id;
    UPDATE public.profiles
      SET arena_points = GREATEST(0, arena_points - loss_pts), losses = losses + 1,
          last_seen_at = now() - (random() * interval '8 minutes')
      WHERE id = loser_id;

    PERFORM public._bot_award_xp(winner_id, win_xp);
    PERFORM public._bot_award_xp(loser_id, loss_xp);

    SELECT arena_points INTO winner_pts FROM public.profiles WHERE id = winner_id;
    IF random() < 0.04 THEN
      chest_rarity := public._bot_pick_chest_rarity(COALESCE(winner_pts, 0));
      PERFORM public._bot_pull_card(winner_id, chest_rarity);
    END IF;
  END LOOP;
END;
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'simulate-bot-gyms') THEN
    PERFORM cron.unschedule('simulate-bot-gyms');
  END IF;
END $$;
SELECT cron.schedule('simulate-bot-gyms', '7,37 * * * *', $$ SELECT public.simulate_bot_gyms(); $$);