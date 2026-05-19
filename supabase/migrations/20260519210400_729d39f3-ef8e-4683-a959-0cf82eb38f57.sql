-- Teto de rank por raridade (para bots)
CREATE OR REPLACE FUNCTION public._bot_max_rank_for_rarity(r text)
RETURNS int
LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE r
    WHEN 'common' THEN 10
    WHEN 'rare' THEN 8
    WHEN 'super_rare' THEN 6
    WHEN 'epic' THEN 5
    WHEN 'legendary' THEN 4
    WHEN 'mythic' THEN 3
    ELSE 10
  END
$$;

-- Atualiza simulate_bot_battles para respeitar o teto
CREATE OR REPLACE FUNCTION public.simulate_bot_battles()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pair RECORD;
  winner_id uuid;
  loser_id uuid;
  win_pts int := 15;
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
      LIMIT 1800
    )
    SELECT a.id AS a_id, a.arena_points AS a_pts,
           b.id AS b_id, b.arena_points AS b_pts
    FROM pool a JOIN pool b ON b.rn = a.rn + 1
    WHERE a.rn % 2 = 1
  LOOP
    IF pair.a_pts >= pair.b_pts THEN
      IF random() < 0.55 THEN winner_id := pair.a_id; loser_id := pair.b_id;
      ELSE winner_id := pair.b_id; loser_id := pair.a_id; END IF;
    ELSE
      IF random() < 0.55 THEN winner_id := pair.b_id; loser_id := pair.a_id;
      ELSE winner_id := pair.a_id; loser_id := pair.b_id; END IF;
    END IF;

    UPDATE public.profiles
      SET arena_points = arena_points + win_pts, wins = wins + 1, coins = coins + win_coins
      WHERE id = winner_id;
    UPDATE public.profiles
      SET arena_points = GREATEST(0, arena_points - loss_pts), losses = losses + 1
      WHERE id = loser_id;

    PERFORM public._bot_award_xp(winner_id, win_xp);
    PERFORM public._bot_award_xp(loser_id, loss_xp);

    SELECT arena_points INTO winner_pts FROM public.profiles WHERE id = winner_id;
    IF winner_pts > 2000 AND random() < 0.03 THEN
      SELECT m.id INTO rankup_target
      FROM public.monsters m
      WHERE m.owner_id = winner_id
        AND m.in_team = true
        AND m.rank < public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species))
      ORDER BY random() LIMIT 1;
      IF rankup_target IS NOT NULL THEN
        UPDATE public.monsters SET rank = rank + 1 WHERE id = rankup_target;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- Atualiza train_bot_pets com teto por raridade
CREATE OR REPLACE FUNCTION public.train_bot_pets()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bot RECORD;
  promote_chance numeric;
  target_id uuid;
BEGIN
  FOR bot IN
    SELECT id, arena_points FROM public.profiles
    WHERE is_bot = true ORDER BY random() LIMIT 500
  LOOP
    promote_chance := LEAST(0.6, 0.15 + (COALESCE(bot.arena_points, 0)::numeric / 5000.0));

    IF random() < promote_chance THEN
      SELECT m.id INTO target_id
      FROM public.monsters m
      WHERE m.owner_id = bot.id
        AND m.in_team = true
        AND m.rank < public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species))
      ORDER BY m.rank ASC, random()
      LIMIT 1;

      IF target_id IS NOT NULL THEN
        UPDATE public.monsters SET rank = rank + 1 WHERE id = target_id;
      END IF;
    END IF;
  END LOOP;
END;
$function$;

-- Corrige pets de bots que já estouraram o teto
UPDATE public.monsters m
SET rank = public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species))
FROM public.profiles p
WHERE p.id = m.owner_id
  AND p.is_bot = true
  AND m.rank > public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species));