
CREATE OR REPLACE FUNCTION public._bot_xp_for_next(lvl int)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT floor(50 * power(1.4, GREATEST(lvl,1) - 1))::int
$$;

CREATE OR REPLACE FUNCTION public._bot_rarity_weight(r text)
RETURNS int LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE r
    WHEN 'common' THEN 1
    WHEN 'rare' THEN 2
    WHEN 'super_rare' THEN 3
    WHEN 'epic' THEN 4
    WHEN 'legendary' THEN 5
    WHEN 'mythic' THEN 6
    ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public._bot_species_rarity(sp text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE
    WHEN sp IN ('steamcub','emberleaf','sparkpup','cinderwisp','mossfin','stormtad','tidewraith','voltsprout','nightbloom','voidspark','magmaboulder','mudpaw','crystalsprite') THEN 'common'
    WHEN sp IN ('flarepup','aquakitty','leafox','voltbun','shadepup','rockpup') THEN 'rare'
    WHEN sp IN ('macaco_prego','tubarao_abissal','polvo_venenoso') THEN 'super_rare'
    WHEN sp IN ('jacare_ancestral','gorila_titan') THEN 'epic'
    WHEN sp IN ('onca_sombria','leao_dourado','tigre_infernal','pantera_negra','pantera_aurea') THEN 'legendary'
    WHEN sp IN ('dragao_branco','dragao_negro') THEN 'mythic'
    ELSE 'common' END
$$;

CREATE OR REPLACE FUNCTION public._bot_random_species(rarity text)
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE pool text[];
BEGIN
  pool := CASE rarity
    WHEN 'common' THEN ARRAY['steamcub','emberleaf','sparkpup','cinderwisp','mossfin','stormtad','tidewraith','voltsprout','nightbloom','voidspark','magmaboulder','mudpaw','crystalsprite']
    WHEN 'rare' THEN ARRAY['flarepup','aquakitty','leafox','voltbun','shadepup','rockpup']
    WHEN 'super_rare' THEN ARRAY['macaco_prego','tubarao_abissal','polvo_venenoso']
    WHEN 'epic' THEN ARRAY['jacare_ancestral','gorila_titan']
    WHEN 'legendary' THEN ARRAY['onca_sombria','leao_dourado','tigre_infernal','pantera_negra','pantera_aurea']
    WHEN 'mythic' THEN ARRAY['dragao_branco','dragao_negro']
    ELSE ARRAY['steamcub']::text[]
  END;
  RETURN pool[1 + floor(random() * array_length(pool,1))::int];
END $$;

CREATE OR REPLACE FUNCTION public._bot_species_stats(sp text)
RETURNS TABLE(hp int, atk int, def int, spd int) LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT t.hp, t.atk, t.def, t.spd FROM (VALUES
    ('flarepup',55,18,10,14),('aquakitty',55,12,12,12),('leafox',70,12,16,9),('voltbun',45,16,9,18),('shadepup',50,17,10,12),
    ('steamcub',60,12,14,9),('emberleaf',55,15,11,12),('sparkpup',45,15,9,16),('cinderwisp',48,16,9,12),
    ('mossfin',55,11,12,11),('stormtad',50,14,10,12),('tidewraith',46,16,9,15),('voltsprout',52,12,11,12),
    ('nightbloom',50,15,10,12),('voidspark',45,16,9,16),('rockpup',72,12,17,8),('magmaboulder',75,12,18,7),
    ('mudpaw',58,15,12,10),('crystalsprite',50,15,10,12),
    ('onca_sombria',80,28,16,22),('leao_dourado',95,30,20,16),('tigre_infernal',90,32,18,18),('pantera_negra',82,29,17,21),('pantera_aurea',78,26,16,20),
    ('macaco_prego',70,24,14,20),('tubarao_abissal',85,26,16,18),('polvo_venenoso',75,25,15,17),
    ('jacare_ancestral',105,32,22,12),('gorila_titan',120,28,26,10),
    ('dragao_branco',110,30,22,18),('dragao_negro',115,34,20,17)
  ) AS t(species,hp,atk,def,spd) WHERE t.species = sp
$$;

CREATE OR REPLACE FUNCTION public._bot_try_upgrade_team(bot_id uuid, new_species text)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  new_w int;
  weak_id uuid;
  weak_species text;
  team_count int;
  stats record;
BEGIN
  new_w := public._bot_rarity_weight(public._bot_species_rarity(new_species));
  SELECT * INTO stats FROM public._bot_species_stats(new_species);
  IF stats.hp IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO team_count FROM public.monsters WHERE owner_id = bot_id AND in_team = true;

  IF team_count < 3 THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, initcap(new_species), stats.hp, stats.atk, stats.def, stats.spd, true);
    RETURN;
  END IF;

  SELECT m.id, m.species INTO weak_id, weak_species
  FROM public.monsters m
  WHERE m.owner_id = bot_id AND m.in_team = true
  ORDER BY public._bot_rarity_weight(public._bot_species_rarity(m.species)) ASC, m.rank ASC
  LIMIT 1;

  IF weak_id IS NULL THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, initcap(new_species), stats.hp, stats.atk, stats.def, stats.spd, true);
    RETURN;
  END IF;

  IF new_w > public._bot_rarity_weight(public._bot_species_rarity(weak_species)) THEN
    UPDATE public.monsters SET in_team = false WHERE id = weak_id;
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, initcap(new_species), stats.hp, stats.atk, stats.def, stats.spd, true);
  ELSE
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, initcap(new_species), stats.hp, stats.atk, stats.def, stats.spd, false);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public._bot_apply_levelup(bot_id uuid, from_lvl int, to_lvl int)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  lv int;
  tier_rarity text;
  coins_gain int;
  gems_gain int;
BEGIN
  FOR lv IN (from_lvl + 1)..to_lvl LOOP
    IF lv = 100 THEN
      tier_rarity := CASE WHEN random() < 0.10 THEN 'mythic' ELSE 'legendary' END;
      coins_gain := 4000 + floor(random()*6000)::int;
      gems_gain := 80 + floor(random()*70)::int;
    ELSIF lv = 50 THEN
      tier_rarity := CASE WHEN random() < 0.10 THEN 'epic' ELSE 'super_rare' END;
      coins_gain := 1500 + floor(random()*2500)::int;
      gems_gain := 25 + floor(random()*25)::int;
    ELSIF lv % 10 = 0 THEN
      tier_rarity := CASE WHEN random() < 0.30 THEN 'rare' ELSE 'common' END;
      coins_gain := 500 + floor(random()*1000)::int;
      gems_gain := 5 + floor(random()*10)::int;
    ELSE
      tier_rarity := CASE WHEN random() < 0.05 THEN 'rare' ELSE 'common' END;
      coins_gain := 200 + floor(random()*300)::int;
      gems_gain := CASE WHEN random() < 0.10 THEN 1 + floor(random()*3)::int ELSE 0 END;
    END IF;

    UPDATE public.profiles
      SET coins = coins + coins_gain,
          gems = gems + gems_gain
      WHERE id = bot_id;

    IF (lv = 100) OR (lv = 50) OR (lv % 10 = 0 AND random() < 0.70) OR (random() < 0.15) THEN
      PERFORM public._bot_try_upgrade_team(bot_id, public._bot_random_species(tier_rarity));
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public._bot_award_xp(bot_id uuid, xp_amount int)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  cur_xp int;
  cur_lvl int;
  new_xp int;
  new_lvl int;
  need int;
BEGIN
  SELECT xp, level INTO cur_xp, cur_lvl FROM public.profiles WHERE id = bot_id;
  IF cur_xp IS NULL THEN RETURN; END IF;
  new_xp := cur_xp + xp_amount;
  new_lvl := cur_lvl;
  LOOP
    need := public._bot_xp_for_next(new_lvl);
    EXIT WHEN new_xp < need;
    new_xp := new_xp - need;
    new_lvl := new_lvl + 1;
    EXIT WHEN new_lvl >= 200;
  END LOOP;

  UPDATE public.profiles SET xp = new_xp, level = new_lvl WHERE id = bot_id;

  IF new_lvl > cur_lvl THEN
    PERFORM public._bot_apply_levelup(bot_id, cur_lvl, new_lvl);
  END IF;
END $$;

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
  win_xp int := 30;
  loss_xp int := 10;
  win_coins int := 100;
  winner_pts int;
  rankup_target uuid;
BEGIN
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
    IF pair.a_pts >= pair.b_pts THEN
      IF random() < 0.6 THEN winner_id := pair.a_id; loser_id := pair.b_id;
      ELSE winner_id := pair.b_id; loser_id := pair.a_id; END IF;
    ELSE
      IF random() < 0.6 THEN winner_id := pair.b_id; loser_id := pair.a_id;
      ELSE winner_id := pair.a_id; loser_id := pair.b_id; END IF;
    END IF;

    UPDATE public.profiles
      SET arena_points = arena_points + win_pts,
          wins = wins + 1,
          coins = coins + win_coins
      WHERE id = winner_id;

    UPDATE public.profiles
      SET arena_points = GREATEST(0, arena_points - loss_pts),
          losses = losses + 1
      WHERE id = loser_id;

    PERFORM public._bot_award_xp(winner_id, win_xp);
    PERFORM public._bot_award_xp(loser_id, loss_xp);

    SELECT arena_points INTO winner_pts FROM public.profiles WHERE id = winner_id;
    IF winner_pts > 2000 AND random() < 0.03 THEN
      SELECT id INTO rankup_target
      FROM public.monsters
      WHERE owner_id = winner_id AND in_team = true AND rank < 10
      ORDER BY random() LIMIT 1;
      IF rankup_target IS NOT NULL THEN
        UPDATE public.monsters SET rank = rank + 1 WHERE id = rankup_target;
      END IF;
    END IF;
  END LOOP;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.simulate_bot_battles() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule('simulate-bot-battles');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'simulate-bot-battles',
  '*/2 * * * *',
  $$ SELECT public.simulate_bot_battles(); $$
);
