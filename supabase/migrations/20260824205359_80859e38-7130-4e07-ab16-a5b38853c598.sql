-- 1) Guard: a bot team can only hold one copy of a species per shiny variant
CREATE OR REPLACE FUNCTION public._bot_try_upgrade_team(bot_id uuid, new_species text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_w int;
  new_r text;
  weak_id uuid;
  weak_species text;
  team_count int;
  stats record;
  pet_name text;
  already_in_team boolean;
  top_count int;
BEGIN
  new_r := public._bot_species_rarity(new_species);
  new_w := public._bot_rarity_weight(new_r);
  SELECT * INTO stats FROM public._bot_species_stats(new_species);
  IF stats.hp IS NULL THEN RETURN; END IF;
  pet_name := public._bot_species_name(new_species);

  -- duplicate check considers shiny variant: normal + shiny of same species is allowed
  SELECT EXISTS(
    SELECT 1 FROM public.monsters
    WHERE owner_id = bot_id AND in_team = true AND species = new_species AND is_shiny = false
  ) INTO already_in_team;

  IF already_in_team THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, false);
    RETURN;
  END IF;

  IF new_r IN ('legendary','mythic') THEN
    top_count := public._bot_team_top_rarity_count(bot_id);
    IF top_count >= 1 THEN
      INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
      VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, false);
      RETURN;
    END IF;
  END IF;

  SELECT count(*) INTO team_count FROM public.monsters WHERE owner_id = bot_id AND in_team = true;

  IF team_count < 3 THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, true);
    RETURN;
  END IF;

  SELECT m.id, m.species INTO weak_id, weak_species
  FROM public.monsters m
  WHERE m.owner_id = bot_id AND m.in_team = true
  ORDER BY public._bot_rarity_weight(public._bot_species_rarity(m.species)) ASC, m.rank ASC
  LIMIT 1;

  IF weak_id IS NOT NULL AND new_w > public._bot_rarity_weight(public._bot_species_rarity(weak_species)) THEN
    UPDATE public.monsters SET in_team = false WHERE id = weak_id;
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, true);
  ELSE
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, false);
  END IF;
END;
$function$;

-- 2) One-off cleanup of existing duplicate species inside bot teams
DO $$
DECLARE
  d record;
  extra record;
  cand uuid;
  newsp text;
  st record;
  i int;
BEGIN
  FOR d IN
    SELECT m.owner_id, m.species, m.is_shiny
    FROM public.monsters m
    JOIN public.profiles p ON p.id = m.owner_id
    WHERE m.in_team AND p.is_bot
    GROUP BY 1,2,3
    HAVING count(*) > 1
  LOOP
    FOR extra IN
      SELECT id, rank, species FROM public.monsters
      WHERE owner_id = d.owner_id AND in_team AND species = d.species AND is_shiny = d.is_shiny
      ORDER BY rank DESC, created_at ASC
      OFFSET 1
    LOOP
      -- try to promote a benched pet whose species is not already in the team
      SELECT b.id INTO cand
      FROM public.monsters b
      WHERE b.owner_id = d.owner_id AND b.in_team = false
        AND public._bot_species_rarity(b.species) = public._bot_species_rarity(extra.species)
        AND NOT EXISTS (
          SELECT 1 FROM public.monsters t
          WHERE t.owner_id = d.owner_id AND t.in_team AND t.species = b.species AND t.is_shiny = b.is_shiny
        )
      ORDER BY b.rank DESC, random()
      LIMIT 1;

      IF cand IS NOT NULL THEN
        UPDATE public.monsters SET in_team = false WHERE id = extra.id;
        UPDATE public.monsters SET in_team = true WHERE id = cand;
        cand := NULL;
        CONTINUE;
      END IF;

      -- otherwise re-roll the duplicate into another species of the same rarity
      newsp := NULL;
      FOR i IN 1..25 LOOP
        newsp := public._bot_random_species(public._bot_species_rarity(extra.species));
        EXIT WHEN newsp IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM public.monsters t
          WHERE t.owner_id = d.owner_id AND t.in_team AND t.species = newsp AND t.is_shiny = d.is_shiny
        );
        newsp := NULL;
      END LOOP;

      IF newsp IS NULL THEN CONTINUE; END IF;

      SELECT * INTO st FROM public._bot_species_stats(newsp);
      IF st.hp IS NULL THEN CONTINUE; END IF;

      UPDATE public.monsters
      SET species = newsp,
          name = public._bot_species_name(newsp),
          hp = st.hp, atk = st.atk, def = st.def, spd = st.spd
      WHERE id = extra.id;

      PERFORM public._bot_apply_star_stats(extra.id);
    END LOOP;
  END LOOP;
END $$;