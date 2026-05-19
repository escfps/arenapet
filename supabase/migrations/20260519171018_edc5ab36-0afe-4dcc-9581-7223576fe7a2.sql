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
  win_pts int := 22;
  loss_pts int := 22;
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
    FROM pool a
    JOIN pool b ON b.rn = a.rn + 1
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
$function$;