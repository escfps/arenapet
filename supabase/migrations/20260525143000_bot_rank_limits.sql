-- Limita o rank máximo dos pets dos bots por raridade
CREATE OR REPLACE FUNCTION public._bot_max_rank_for_rarity(p_rarity text)
RETURNS int
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
BEGIN
  RETURN CASE p_rarity
    WHEN 'mythic'     THEN 1
    WHEN 'legendary'  THEN 2
    WHEN 'epic'       THEN 4
    WHEN 'super_rare' THEN 6
    WHEN 'rare'       THEN 8
    WHEN 'common'     THEN 10
    ELSE 10
  END;
END;
$function$;

-- Reaplica _bot_pull_card com limite de rank por raridade
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
  max_rank int;
BEGIN
  max_rank := public._bot_max_rank_for_rarity(p_rarity);

  -- 60%: escolhe uma espécie da raridade que o bot já tem (favorece acumular duplicata)
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

  -- Só insere se o bot ainda não atingiu o limite de rank para essa raridade
  -- (verifica se há espaço para fusão ou se já tem o pet no rank máximo sozinho)
  IF NOT EXISTS (
    SELECT 1 FROM public.monsters
    WHERE owner_id = p_bot
      AND species = chosen_species
      AND rank = max_rank
  ) THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team, rank)
    VALUES (p_bot, chosen_species, sp_name, st.hp, st.atk, st.def, st.spd, false, 1);
  ELSE
    RETURN; -- bot já tem esse pet no rank máximo, não ganha mais cópias
  END IF;

  -- Cascata de fusão respeitando o rank máximo da raridade
  LOOP
    SELECT species, rank INTO dup
    FROM public.monsters
    WHERE owner_id = p_bot
      AND rank < max_rank
    GROUP BY species, rank
    HAVING count(*) >= 2
    ORDER BY rank DESC, random()
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
