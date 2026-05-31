-- Normalize bot teams: exactly 3 in_team monsters, all distinct species.
-- For bots missing pets in reserve, generate filler pets so they can field 3.
DO $$
DECLARE
  b RECORD;
  picked_ids uuid[];
  pick_count int;
  fill_species text;
  st record;
  pools text[] := ARRAY['common','common','common','rare','rare','super_rare'];
  rar text;
  guard int;
BEGIN
  FOR b IN SELECT p.id FROM profiles p WHERE p.is_bot LOOP
    -- Pick best monster per distinct species (prefer existing in_team, then highest rank, then strongest)
    SELECT array_agg(id) INTO picked_ids FROM (
      SELECT DISTINCT ON (species) id
      FROM monsters
      WHERE owner_id = b.id
      ORDER BY species,
               in_team DESC,
               rank DESC,
               (hp + atk + def + spd) DESC,
               created_at ASC
    ) per_species
    LIMIT 3;

    -- Take only top 3 by strength
    SELECT array_agg(id) INTO picked_ids FROM (
      SELECT m.id
      FROM monsters m
      WHERE m.id = ANY(COALESCE(picked_ids, ARRAY[]::uuid[]))
      ORDER BY m.rank DESC, (m.hp + m.atk + m.def + m.spd) DESC
      LIMIT 3
    ) top3;

    pick_count := COALESCE(array_length(picked_ids, 1), 0);

    -- If bot has fewer than 3 distinct species, create filler pets to fill the team
    guard := 0;
    WHILE pick_count < 3 AND guard < 12 LOOP
      guard := guard + 1;
      rar := pools[1 + floor(random() * array_length(pools, 1))::int];
      fill_species := public._bot_random_species(rar);

      -- Skip if this species is already among picks
      IF picked_ids IS NOT NULL AND EXISTS (
        SELECT 1 FROM monsters
        WHERE id = ANY(picked_ids) AND species = fill_species
      ) THEN
        CONTINUE;
      END IF;

      SELECT * INTO st FROM public._bot_species_stats(fill_species);
      IF st.hp IS NULL THEN CONTINUE; END IF;

      WITH ins AS (
        INSERT INTO monsters (owner_id, species, name, hp, atk, def, spd, in_team, rank)
        VALUES (b.id, fill_species, public._bot_species_name(fill_species),
                st.hp, st.atk, st.def, st.spd, false, 1)
        RETURNING id
      )
      SELECT array_append(COALESCE(picked_ids, ARRAY[]::uuid[]), id)
      INTO picked_ids FROM ins;

      pick_count := COALESCE(array_length(picked_ids, 1), 0);
    END LOOP;

    -- Reset team flags
    UPDATE monsters SET in_team = false, team_position = 0
    WHERE owner_id = b.id AND in_team = true;

    -- Set the chosen 3 as the team
    IF picked_ids IS NOT NULL AND array_length(picked_ids, 1) > 0 THEN
      UPDATE monsters SET in_team = true,
        team_position = CASE id
          WHEN picked_ids[1] THEN 0
          WHEN picked_ids[2] THEN 1
          WHEN picked_ids[3] THEN 2
          ELSE 0
        END
      WHERE id = ANY(picked_ids);
    END IF;
  END LOOP;
END $$;

-- Patch _bot_pull_card so the rank-up loop never collapses two in-team duplicates
-- into one (which would leave the team with 2 pets). If both copies are in_team,
-- demote the loser to reserve before deleting it cannot happen — we keep the
-- in_team one, and ensure we never delete an in_team monster that is the only
-- copy of its species in the team.
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
  victim_id uuid;
  winner_id uuid;
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

  -- New copy always lands in reserve; _bot_try_upgrade_team decides if it joins team
  INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team, rank)
  VALUES (p_bot, chosen_species, sp_name, st.hp, st.atk, st.def, st.spd, false, 1);

  LOOP
    SELECT m.species, m.rank
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

    -- Winner: prefer in_team copy, then oldest
    SELECT id INTO winner_id FROM public.monsters
    WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
    ORDER BY in_team DESC, created_at ASC
    LIMIT 1;

    -- Victim: prefer reserve copy, then newest
    SELECT id INTO victim_id FROM public.monsters
    WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
      AND id <> winner_id
    ORDER BY in_team ASC, created_at DESC
    LIMIT 1;

    EXIT WHEN victim_id IS NULL;

    DELETE FROM public.monsters WHERE id = victim_id;
    UPDATE public.monsters SET rank = rank + 1 WHERE id = winner_id;
  END LOOP;

  PERFORM public._bot_try_upgrade_team(p_bot, chosen_species);
END;
$function$;
