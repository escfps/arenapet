
CREATE OR REPLACE FUNCTION public.train_bot_pets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  bot RECORD;
  promote_chance numeric;
  target_id uuid;
BEGIN
  FOR bot IN
    SELECT id, arena_points
    FROM public.profiles
    WHERE is_bot = true
    ORDER BY random()
    LIMIT 500
  LOOP
    -- chance de treinar baseada em arena_points (bots melhores treinam mais)
    promote_chance := LEAST(0.6, 0.15 + (COALESCE(bot.arena_points, 0)::numeric / 5000.0));

    IF random() < promote_chance THEN
      -- escolhe um pet do time com rank abaixo do máximo, dando preferência aos de menor rank
      SELECT id INTO target_id
      FROM public.monsters
      WHERE owner_id = bot.id
        AND in_team = true
        AND rank < 10
      ORDER BY rank ASC, random()
      LIMIT 1;

      IF target_id IS NOT NULL THEN
        UPDATE public.monsters
          SET rank = rank + 1
        WHERE id = target_id;
      END IF;
    END IF;
  END LOOP;
END;
$$;
