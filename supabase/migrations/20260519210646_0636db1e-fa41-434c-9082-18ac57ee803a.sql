-- Remove o teto por raridade (volta a permitir rank 10 pra qualquer pet)
DROP FUNCTION IF EXISTS public._bot_max_rank_for_rarity(text);

-- "Puxar" uma carta (★1) e auto-fundir duplicatas, igual ao jogador fundindo no forge.
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
  fuse_again boolean;
BEGIN
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

  -- Insere a carta nova (★1, fora do time)
  INSERT INTO public.monsters (owner_id, species, name, hp, atk, def, spd, in_team, rank)
  VALUES (p_bot, chosen_species, sp_name, st.hp, st.atk, st.def, st.spd, false, 1);

  -- Cascata de fusão: enquanto houver 2+ do mesmo (espécie, rank) e rank < 10, funde
  LOOP
    SELECT species, rank INTO dup
    FROM public.monsters
    WHERE owner_id = p_bot
      AND rank < 10
    GROUP BY species, rank
    HAVING count(*) >= 2
    ORDER BY rank DESC, random()
    LIMIT 1;

    EXIT WHEN dup.species IS NULL;

    -- consome uma cópia (preferindo as que NÃO estão no time)
    DELETE FROM public.monsters
    WHERE id = (
      SELECT id FROM public.monsters
      WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
      ORDER BY in_team ASC, created_at ASC
      LIMIT 1
    );

    -- e sobe o rank de outra cópia restante
    UPDATE public.monsters
    SET rank = rank + 1
    WHERE id = (
      SELECT id FROM public.monsters
      WHERE owner_id = p_bot AND species = dup.species AND rank = dup.rank
      ORDER BY in_team DESC, created_at ASC
      LIMIT 1
    );
  END LOOP;

  -- Tenta promover ao time se o novo pet for melhor que o mais fraco
  PERFORM public._bot_try_upgrade_team(p_bot, chosen_species);
END;
$function$;

-- Escolhe raridade do "baú" do bot baseada nos arena_points (bots melhores abrem baús melhores)
CREATE OR REPLACE FUNCTION public._bot_pick_chest_rarity(p_arena_points int)
RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public'
AS $function$
DECLARE r numeric := random() * 100;
BEGIN
  IF p_arena_points >= 3000 THEN
    -- baú lendário-ish
    IF r < 25 THEN RETURN 'common';
    ELSIF r < 50 THEN RETURN 'rare';
    ELSIF r < 75 THEN RETURN 'super_rare';
    ELSIF r < 92 THEN RETURN 'epic';
    ELSIF r < 99 THEN RETURN 'legendary';
    ELSE RETURN 'mythic'; END IF;
  ELSIF p_arena_points >= 1500 THEN
    -- baú ouro
    IF r < 45 THEN RETURN 'common';
    ELSIF r < 75 THEN RETURN 'rare';
    ELSIF r < 92 THEN RETURN 'super_rare';
    ELSIF r < 99 THEN RETURN 'epic';
    ELSE RETURN 'legendary'; END IF;
  ELSIF p_arena_points >= 500 THEN
    -- baú prata
    IF r < 65 THEN RETURN 'common';
    ELSIF r < 90 THEN RETURN 'rare';
    ELSIF r < 99 THEN RETURN 'super_rare';
    ELSE RETURN 'epic'; END IF;
  ELSE
    -- baú madeira
    IF r < 85 THEN RETURN 'common';
    ELSIF r < 98 THEN RETURN 'rare';
    ELSE RETURN 'super_rare'; END IF;
  END IF;
END;
$function$;

-- simulate_bot_battles: vencedor "abre um baú" (puxa carta), sem rank-up direto
CREATE OR REPLACE FUNCTION public.simulate_bot_battles()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pair RECORD;
  winner_id uuid;
  loser_id uuid;
  win_pts int := 15;
  loss_pts int := 15;
  win_xp int := 30;
  loss_xp int := 10;
  win_coins int := 100;
  winner_pts int;
  chest_rarity text;
BEGIN
  FOR pair IN
    WITH pool AS (
      SELECT id, arena_points,
             row_number() OVER (ORDER BY arena_points, random()) AS rn
      FROM public.profiles
      WHERE is_bot = true
      ORDER BY random()
      LIMIT 1800
    )
    SELECT a.id AS a_id, a.arena_points AS a_pts,
           b.id AS b_id, b.arena_points AS b_pts
    FROM pool a JOIN pool b ON b.rn = a.rn + 1
    WHERE a.rn % 2 = 1
  LOOP
    IF pair.a_pts >= pair.b_pts THEN
      IF random() < 0.55 THEN winner_id := pair.a_id; loser_id := pair.b_id;
      ELSE winner_id := pair.b_id; loser_id := pair.a_id; END IF;
    ELSE
      IF random() < 0.55 THEN winner_id := pair.b_id; loser_id := pair.a_id;
      ELSE winner_id := pair.a_id; loser_id := pair.b_id; END IF;
    END IF;

    UPDATE public.profiles
      SET arena_points = arena_points + win_pts, wins = wins + 1, coins = coins + win_coins
      WHERE id = winner_id;
    UPDATE public.profiles
      SET arena_points = GREATEST(0, arena_points - loss_pts), losses = losses + 1
      WHERE id = loser_id;

    PERFORM public._bot_award_xp(winner_id, win_xp);
    PERFORM public._bot_award_xp(loser_id, loss_xp);

    -- Em vez de upar rank, o vencedor ocasionalmente "abre um baú"
    SELECT arena_points INTO winner_pts FROM public.profiles WHERE id = winner_id;
    IF random() < 0.04 THEN
      chest_rarity := public._bot_pick_chest_rarity(COALESCE(winner_pts, 0));
      PERFORM public._bot_pull_card(winner_id, chest_rarity);
    END IF;
  END LOOP;
END;
$function$;

-- train_bot_pets vira "abrir baús": chance de puxar uma carta (em vez de upar rank direto)
CREATE OR REPLACE FUNCTION public.train_bot_pets()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END;
$function$;