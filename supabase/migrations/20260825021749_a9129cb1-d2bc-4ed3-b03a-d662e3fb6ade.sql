CREATE OR REPLACE FUNCTION public.gym_start_challenge(p_type text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF badge_count < 3 THEN
    RAISE EXCEPTION 'precisa de 3 insignias diferentes';
  END IF;

  WITH doomed AS (
    SELECT id FROM public.gym_badges
    WHERE user_id = uid
    ORDER BY (gym_type = p_type) DESC, earned_at ASC
    LIMIT 3
  )
  DELETE FROM public.gym_badges gb USING doomed d WHERE gb.id = d.id;
  GET DIAGNOSTICS spent = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'spent', spent);
END $function$;