
CREATE OR REPLACE FUNCTION public._bot_xp_for_next(lvl integer)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT LEAST(2000000000, floor(50 * power(1.4, LEAST(GREATEST(lvl,1), 100) - 1))::bigint)::int
$function$;

CREATE OR REPLACE FUNCTION public._bot_award_xp(bot_id uuid, xp_amount integer)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  cur_xp int;
  cur_lvl int;
  new_xp int;
  new_lvl int;
  need int;
BEGIN
  SELECT xp, level INTO cur_xp, cur_lvl FROM public.profiles WHERE id = bot_id;
  IF cur_xp IS NULL THEN RETURN; END IF;
  IF cur_lvl >= 200 THEN RETURN; END IF;
  new_xp := cur_xp + xp_amount;
  new_lvl := cur_lvl;
  LOOP
    EXIT WHEN new_lvl >= 200;
    need := public._bot_xp_for_next(new_lvl);
    EXIT WHEN new_xp < need;
    new_xp := new_xp - need;
    new_lvl := new_lvl + 1;
  END LOOP;

  UPDATE public.profiles SET xp = new_xp, level = new_lvl WHERE id = bot_id;

  IF new_lvl > cur_lvl THEN
    PERFORM public._bot_apply_levelup(bot_id, cur_lvl, new_lvl);
  END IF;
END $function$;
