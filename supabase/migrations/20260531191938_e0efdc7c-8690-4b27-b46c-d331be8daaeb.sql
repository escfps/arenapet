
-- 1. New per-rarity rank cap
CREATE OR REPLACE FUNCTION public._bot_max_rank_for_rarity(r text)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE r
    WHEN 'mythic' THEN 1
    WHEN 'legendary' THEN 2
    WHEN 'epic' THEN 4
    WHEN 'super_rare' THEN 5
    WHEN 'rare' THEN 6
    WHEN 'common' THEN 7
    ELSE 1
  END
$$;

-- 2. Age helper
CREATE OR REPLACE FUNCTION public._bot_age_days(p_bot uuid)
 RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT GREATEST(0, floor(extract(epoch from (now() - created_at)) / 86400)::int)
  FROM public.profiles WHERE id = p_bot
$$;

-- 3. Minimum age to allow upgrading TO target_star for a given rarity
-- Returns 999999 if not allowed at any age.
CREATE OR REPLACE FUNCTION public._bot_star_unlock_day(r text, target_star integer)
 RETURNS integer LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE r
    WHEN 'common' THEN CASE target_star
      WHEN 2 THEN 8 WHEN 3 THEN 16 WHEN 4 THEN 26 WHEN 5 THEN 36
      WHEN 6 THEN 51 WHEN 7 THEN 66 ELSE 999999 END
    WHEN 'rare' THEN CASE target_star
      WHEN 2 THEN 16 WHEN 3 THEN 36 WHEN 4 THEN 66 WHEN 5 THEN 81 WHEN 6 THEN 101
      ELSE 999999 END
    WHEN 'super_rare' THEN CASE target_star
      WHEN 2 THEN 81 WHEN 3 THEN 101 WHEN 4 THEN 121 WHEN 5 THEN 151
      ELSE 999999 END
    WHEN 'epic' THEN CASE target_star
      WHEN 2 THEN 151 WHEN 3 THEN 181 WHEN 4 THEN 210
      ELSE 999999 END
    WHEN 'legendary' THEN CASE target_star
      WHEN 2 THEN 181
      ELSE 999999 END
    ELSE 999999
  END
$$;

-- 4. Maximum rarity (as ordering weight) allowed for an age
CREATE OR REPLACE FUNCTION public._bot_rarity_allowed_for_age(r text, age_days integer)
 RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE r
    WHEN 'common' THEN true
    WHEN 'rare' THEN true
    WHEN 'super_rare' THEN age_days >= 66
    WHEN 'epic' THEN age_days >= 121
    WHEN 'legendary' THEN age_days >= 151
    WHEN 'mythic' THEN age_days >= 365
    ELSE false
  END
$$;

-- 5. Role classifier
CREATE OR REPLACE FUNCTION public._bot_species_role(sp text)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$
  SELECT CASE
    -- Mages (intelecto): wisps, blooms, sprites, fênix, espectros
    WHEN sp IN ('cinderwisp','nightbloom','voidspark','crystalsprite','borboleta_sonifera',
                'raposa_espectral','fenix_vermelha','fenix_negra','fenix_azul','fantasminha',
                'corvo_sombras','polvo_venenoso') THEN 'mage'
    -- Tanks (HP+DEF): bichos pesados, golems, tartarugas, panda, triceratops, urso
    WHEN sp IN ('steamcub','leafox','rockpup','magmaboulder','mudpaw','gorila_titan',
                'jacare_ancestral','tartaruga_ancestral','triceratops_colossal','golem_pedra',
                'panda','dragao_branco') THEN 'tank'
    -- Healers/Support (HP puro)
    WHEN sp IN ('mossfin','foca_glacial','urso_polar') THEN 'healer'
    -- Speed (SPD): bunny, pups voadores, pássaros rápidos, lobos
    WHEN sp IN ('voltbun','sparkpup','rato_bomba','aguia_cega','lince_dourado','pterossauro',
                'lobo_artico','lobo_lua_sangrenta','voltsprout','stormtad','tidewraith',
                'macaco_prego') THEN 'speed'
    -- Resto = DPS
    ELSE 'dps'
  END
$$;

-- 6. Apply +10 stat points distributed by role
CREATE OR REPLACE FUNCTION public._bot_apply_star_stats(p_monster uuid)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE role text; sp text;
BEGIN
  SELECT species INTO sp FROM public.monsters WHERE id = p_monster;
  IF sp IS NULL THEN RETURN; END IF;
  role := public._bot_species_role(sp);

  IF role = 'dps' THEN
    UPDATE public.monsters SET atk = COALESCE(atk,0) + 10 WHERE id = p_monster;
  ELSIF role = 'tank' THEN
    UPDATE public.monsters SET hp = COALESCE(hp,0) + 6, def = COALESCE(def,0) + 4 WHERE id = p_monster;
  ELSIF role = 'mage' THEN
    UPDATE public.monsters SET "int" = COALESCE("int",0) + 10 WHERE id = p_monster;
  ELSIF role = 'healer' THEN
    UPDATE public.monsters SET hp = COALESCE(hp,0) + 8, def = COALESCE(def,0) + 2 WHERE id = p_monster;
  ELSIF role = 'speed' THEN
    UPDATE public.monsters SET spd = COALESCE(spd,0) + 8, atk = COALESCE(atk,0) + 2 WHERE id = p_monster;
  ELSE
    UPDATE public.monsters SET atk = COALESCE(atk,0) + 10 WHERE id = p_monster;
  END IF;
END $$;

-- 7. Helper: count of legendary+mythic in team
CREATE OR REPLACE FUNCTION public._bot_team_top_rarity_count(p_bot uuid)
 RETURNS integer LANGUAGE sql STABLE SET search_path TO 'public'
AS $$
  SELECT count(*)::int FROM public.monsters
  WHERE owner_id = p_bot AND in_team = true
    AND public._bot_species_rarity(species) IN ('legendary','mythic')
$$;

-- 8. Rewrite _bot_pull_card with age + unlock rules + +10 stats on rank-up
CREATE OR REPLACE FUNCTION public._bot_pull_card(p_bot uuid, p_rarity text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  chosen_species text;
  sp_name text;
  st record;
  dup record;
  victim_id uuid;
  winner_id uuid;
  age_days int;
  next_star int;
  unlock_day int;
  fallback text;
BEGIN
  age_days := public._bot_age_days(p_bot);

  -- Downgrade rarity to what's allowed for this age
  IF NOT public._bot_rarity_allowed_for_age(p_rarity, age_days) THEN
    fallback := CASE
      WHEN age_days >= 151 THEN 'epic'
      WHEN age_days >= 121 THEN 'epic'
      WHEN age_days >= 66 THEN 'super_rare'
      WHEN age_days >= 16 THEN 'rare'
      ELSE 'common'
    END;
    p_rarity := fallback;
  END IF;

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

  -- Fusion loop: only if age unlocks the next star for that rarity
  LOOP
    SELECT m.species, m.rank
    INTO dup
    FROM public.monsters m
    WHERE m.owner_id = p_bot
      AND m.rank < public._bot_max_rank_for_rarity(public._bot_species_rarity(m.species))
    GROUP BY m.species, m.rank
    HAVING count(*) >= 2
    ORDER BY m.rank DESC, random()
    LIMIT 1;

    EXIT WHEN dup.species IS NULL;

    next_star := dup.rank + 1;
    unlock_day := public._bot_star_unlock_day(public._bot_species_rarity(dup.species), next_star);
    EXIT WHEN age_days < unlock_day;

    SELECT id INTO winner_id FROM public.monsters
    WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
    ORDER BY in_team DESC, created_at ASC
    LIMIT 1;

    SELECT id INTO victim_id FROM public.monsters
    WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
      AND id <> winner_id
    ORDER BY in_team ASC, created_at DESC
    LIMIT 1;

    EXIT WHEN victim_id IS NULL;

    DELETE FROM public.monsters WHERE id = victim_id;
    UPDATE public.monsters SET rank = rank + 1 WHERE id = winner_id;
    PERFORM public._bot_apply_star_stats(winner_id);
  END LOOP;

  PERFORM public._bot_try_upgrade_team(p_bot, chosen_species);
END;
$$;

-- 9. Rewrite _bot_try_upgrade_team: keep no-dup-species, cap 1 lendário+mítico
CREATE OR REPLACE FUNCTION public._bot_try_upgrade_team(bot_id uuid, new_species text)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $$
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

  SELECT EXISTS(
    SELECT 1 FROM public.monsters
    WHERE owner_id = bot_id AND in_team = true AND species = new_species
  ) INTO already_in_team;

  IF already_in_team THEN
    INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team)
    VALUES (bot_id, new_species, pet_name, stats.hp, stats.atk, stats.def, stats.spd, false);
    RETURN;
  END IF;

  -- Max 1 legendary/mythic per team
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
END $$;

-- 10. Adjust _bot_pick_chest_rarity to never roll a rarity unavailable for the age tier
-- (kept as-is — clamp now happens inside _bot_pull_card)

-- 11. Adjust _bot_apply_levelup: clamp rarity by age
CREATE OR REPLACE FUNCTION public._bot_apply_levelup(bot_id uuid, from_lvl integer, to_lvl integer)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  lv int;
  tier_rarity text;
  coins_gain int;
  gems_gain int;
  age_days int;
BEGIN
  age_days := public._bot_age_days(bot_id);

  FOR lv IN (from_lvl + 1)..to_lvl LOOP
    IF lv = 100 THEN
      tier_rarity := CASE WHEN random() < 0.10 THEN 'mythic' ELSE 'legendary' END;
      coins_gain := 4000 + floor(random()*6000)::int;
      gems_gain := 80 + floor(random()*70)::int;
    ELSIF lv = 50 THEN
      tier_rarity := CASE WHEN random() < 0.10 THEN 'epic' ELSE 'super_rare' END;
      coins_gain := 1500 + floor(random()*2500)::int;
      gems_gain := 25 + floor(random()*25)::int;
    ELSIF lv % 10 = 0 THEN
      tier_rarity := CASE WHEN random() < 0.30 THEN 'rare' ELSE 'common' END;
      coins_gain := 500 + floor(random()*1000)::int;
      gems_gain := 5 + floor(random()*10)::int;
    ELSE
      tier_rarity := CASE WHEN random() < 0.05 THEN 'rare' ELSE 'common' END;
      coins_gain := 200 + floor(random()*300)::int;
      gems_gain := CASE WHEN random() < 0.10 THEN 1 + floor(random()*3)::int ELSE 0 END;
    END IF;

    -- Clamp: if rarity not allowed by age, downgrade gracefully
    IF NOT public._bot_rarity_allowed_for_age(tier_rarity, age_days) THEN
      tier_rarity := CASE
        WHEN age_days >= 121 THEN 'epic'
        WHEN age_days >= 66 THEN 'super_rare'
        WHEN age_days >= 16 THEN 'rare'
        ELSE 'common'
      END;
    END IF;

    UPDATE public.profiles
      SET coins = coins + coins_gain,
          gems = gems + gems_gain
      WHERE id = bot_id;

    IF (lv = 100) OR (lv = 50) OR (lv % 10 = 0 AND random() < 0.70) OR (random() < 0.15) THEN
      PERFORM public._bot_pull_card(bot_id, tier_rarity);
    END IF;
  END LOOP;
END $$;

-- 12. Disable gem-based random stat training — stats now only from star fusions
CREATE OR REPLACE FUNCTION public.train_bot_pets()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  bot RECORD;
  pull_chance numeric;
  chest_rarity text;
BEGIN
  FOR bot IN
    SELECT id, arena_points FROM public.profiles
    WHERE is_bot = true ORDER BY random() LIMIT 500
  LOOP
    pull_chance := LEAST(0.5, 0.10 + (COALESCE(bot.arena_points, 0)::numeric / 6000.0));
    IF random() < pull_chance THEN
      chest_rarity := public._bot_pick_chest_rarity(COALESCE(bot.arena_points, 0));
      PERFORM public._bot_pull_card(bot.id, chest_rarity);
    END IF;
  END LOOP;
END $$;
