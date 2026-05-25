-- Cap function for bot pet ranks by rarity
CREATE OR REPLACE FUNCTION public._bot_max_rank_for_rarity(r text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE r
    WHEN 'mythic' THEN 1
    WHEN 'legendary' THEN 2
    WHEN 'epic' THEN 4
    WHEN 'super_rare' THEN 6
    WHEN 'rare' THEN 10
    WHEN 'common' THEN 10
    ELSE 10
  END
$$;

-- Update bot pull/fuse cascade to respect rarity cap
CREATE OR REPLACE FUNCTION public._bot_pull_card(p_bot uuid, p_rarity text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  chosen_species text;
  sp_name text;
  st record;
  dup record;
  cap int;
BEGIN
  IF random() < 0.60 THEN
    SELECT species INTO chosen_species
    FROM public.monsters
    WHERE owner_id = p_bot
      AND public._bot_species_rarity(species) = p_rarity
    ORDER BY random() LIMIT 1;
  END IF;

  IF chosen_species IS NULL THEN
    chosen_species := public._bot_random_species(p_rarity);
  END IF;

  SELECT * INTO st FROM public._bot_species_stats(chosen_species);
  IF st.hp IS NULL THEN RETURN; END IF;
  sp_name := public._bot_species_name(chosen_species);

  INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team, rank)
  VALUES (p_bot, chosen_species, sp_name, st.hp, st.atk, st.def, st.spd, false, 1);

  LOOP
    SELECT m.species, m.rank,
           public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species)) AS cap_rank
    INTO dup
    FROM public.monsters m
    WHERE m.owner_id = p_bot
      AND m.rank < 10
      AND m.rank < public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species))
    GROUP BY m.species, m.rank
    HAVING count(*) >= 2
    ORDER BY m.rank DESC, random()
    LIMIT 1;

    EXIT WHEN dup.species IS NULL;

    DELETE FROM public.monsters
    WHERE id = (
      SELECT id FROM public.monsters
      WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
      ORDER BY in_team ASC, created_at ASC
      LIMIT 1
    );

    UPDATE public.monsters
    SET rank = rank + 1
    WHERE id = (
      SELECT id FROM public.monsters
      WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
      ORDER BY in_team DESC, created_at ASC
      LIMIT 1
    );
  END LOOP;

  PERFORM public._bot_try_upgrade_team(p_bot, chosen_species);
END;
$function$;

-- Clamp existing bot pets above their cap
UPDATE public.monsters m
SET rank = public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species))
FROM public.profiles p
WHERE p.id = m.owner_id
  AND p.is_bot = true
  AND m.rank > public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species));
