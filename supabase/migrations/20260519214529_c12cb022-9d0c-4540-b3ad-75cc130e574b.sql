
CREATE OR REPLACE FUNCTION public._bot_try_upgrade_team(bot_id uuid, new_species text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  new_w int;
  weak_id uuid;
  weak_species text;
  team_count int;
  stats record;
  pet_name text;
  already_in_team boolean;
BEGIN
  new_w := public._bot_rarity_weight(public._bot_species_rarity(new_species));
  SELECT * INTO stats FROM public._bot_species_stats(new_species);
  IF stats.hp IS NULL THEN RETURN; END IF;
  pet_name := public._bot_species_name(new_species);

  SELECT EXISTS(
    SELECT 1 FROM public.monsters
    WHERE owner_id = bot_id AND in_team = true AND species = new_species
  ) INTO already_in_team;

  SELECT count(*) INTO team_count FROM public.monsters WHERE owner_id = bot_id AND in_team = true;

  -- Se já tem essa espécie no time, manda pra reserva (nunca duplica no time)
  IF already_in_team THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, false);
    RETURN;
  END IF;

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

  IF weak_id IS NULL THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, true);
    RETURN;
  END IF;

  IF new_w > public._bot_rarity_weight(public._bot_species_rarity(weak_species)) THEN
    UPDATE public.monsters SET in_team = false WHERE id = weak_id;
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, true);
  ELSE
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, false);
  END IF;
END $function$;
