CREATE OR REPLACE FUNCTION public._bot_species_name(sp text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE sp
    WHEN 'flarepup' THEN 'Flarepup'
    WHEN 'aquakitty' THEN 'Aquakitty'
    WHEN 'leafox' THEN 'Leafox'
    WHEN 'voltbun' THEN 'Voltbun'
    WHEN 'shadepup' THEN 'Shadepup'
    WHEN 'steamcub' THEN 'Steamcub'
    WHEN 'emberleaf' THEN 'Emberleaf'
    WHEN 'sparkpup' THEN 'Sparkpup'
    WHEN 'cinderwisp' THEN 'Cinderwisp'
    WHEN 'mossfin' THEN 'Mossfin'
    WHEN 'stormtad' THEN 'Stormtad'
    WHEN 'tidewraith' THEN 'Tidewraith'
    WHEN 'voltsprout' THEN 'Voltsprout'
    WHEN 'nightbloom' THEN 'Nightbloom'
    WHEN 'voidspark' THEN 'Voidspark'
    WHEN 'rockpup' THEN 'Rockpup'
    WHEN 'magmaboulder' THEN 'Magmaboulder'
    WHEN 'mudpaw' THEN 'Mudpaw'
    WHEN 'crystalsprite' THEN 'Crystalsprite'
    WHEN 'onca_sombria' THEN 'Onça Sombria'
    WHEN 'leao_dourado' THEN 'Leão Dourado'
    WHEN 'tigre_infernal' THEN 'Tigre Infernal'
    WHEN 'pantera_negra' THEN 'Pantera Negra'
    WHEN 'pantera_aurea' THEN 'Pantera Áurea'
    WHEN 'macaco_prego' THEN 'Macaco Prego'
    WHEN 'tubarao_abissal' THEN 'Tubarão Abissal'
    WHEN 'polvo_venenoso' THEN 'Polvo Venenoso'
    WHEN 'jacare_ancestral' THEN 'Jacaré Ancestral'
    WHEN 'gorila_titan' THEN 'Gorila Titan'
    WHEN 'dragao_branco' THEN 'Dragão Branco'
    WHEN 'dragao_negro' THEN 'Dragão Negro'
    ELSE initcap(sp)
  END
$$;

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
BEGIN
  new_w := public._bot_rarity_weight(public._bot_species_rarity(new_species));
  SELECT * INTO stats FROM public._bot_species_stats(new_species);
  IF stats.hp IS NULL THEN RETURN; END IF;
  pet_name := public._bot_species_name(new_species);

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