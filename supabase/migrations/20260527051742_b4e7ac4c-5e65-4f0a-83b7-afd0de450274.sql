CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  t record;
  pending record;
  pw1 numeric; pw2 numeric;
  p1_is_bot boolean; p2_is_bot boolean;
  winner uuid;
  winners_arr uuid[];
  i int;
  next_round int;
  champion uuid;
  champion_is_bot boolean;
  reward_coins int;
  reward_gems int;
  reward_rations int;
  bonus_species text;
  bonus_species_name text;
  rar_roll numeric;
  chosen_rarity text;
  updated_rations int;
  bonus_pet_obj jsonb := null;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF t IS NULL OR t.status <> 'in_progress' THEN RETURN; END IF;

  FOR pending IN
    SELECT * FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id AND round = t.current_round AND status <> 'done'
  LOOP
    SELECT power, is_bot INTO pw1, p1_is_bot FROM public.tournament_entries
      WHERE tournament_id = p_tournament_id AND user_id = pending.p1_id;
    SELECT power, is_bot INTO pw2, p2_is_bot FROM public.tournament_entries
      WHERE tournament_id = p_tournament_id AND user_id = pending.p2_id;

    IF NOT p1_is_bot AND p2_is_bot THEN
      winner := pending.p2_id;
    ELSIF p1_is_bot AND NOT p2_is_bot THEN
      winner := pending.p1_id;
    ELSE
      winner := public._tour_pick_winner(pending.p1_id, pending.p2_id, pw1, pw2);
    END IF;

    UPDATE public.tournament_matches
      SET winner_id = winner, status = 'done', played_at = now()
      WHERE id = pending.id;
    UPDATE public.tournament_entries
      SET eliminated_round = t.current_round
      WHERE tournament_id = p_tournament_id
        AND user_id = CASE WHEN winner = pending.p1_id THEN pending.p2_id ELSE pending.p1_id END;
  END LOOP;

  SELECT array_agg(winner_id ORDER BY slot) INTO winners_arr
  FROM public.tournament_matches
  WHERE tournament_id = p_tournament_id AND round = t.current_round;

  IF array_length(winners_arr, 1) = 1 THEN
    champion := winners_arr[1];
    SELECT is_bot INTO champion_is_bot FROM public.profiles WHERE id = champion;

    IF champion IS NOT NULL THEN
      reward_coins := 1500 + floor(random() * 2501)::int;
      reward_gems := 10 + floor(random() * 11)::int;
      reward_rations := 6 + floor(random() * 7)::int;

      UPDATE public.profiles
        SET coins = coins + reward_coins, gems = gems + reward_gems
        WHERE id = champion;

      IF NOT COALESCE(champion_is_bot, false) THEN
        UPDATE public.inventory SET quantity = quantity + reward_rations
          WHERE user_id = champion AND item_type = 'ration'
          RETURNING quantity INTO updated_rations;
        IF updated_rations IS NULL THEN
          INSERT INTO public.inventory(user_id, item_type, quantity)
          VALUES (champion, 'ration', reward_rations);
        END IF;
      END IF;

      IF random() < 0.50 THEN
        rar_roll := random() * 100;
        IF rar_roll < 30 THEN chosen_rarity := 'common';
        ELSIF rar_roll < 75 THEN chosen_rarity := 'rare';
        ELSE chosen_rarity := 'super_rare';
        END IF;
        bonus_species := public._bot_random_species(chosen_rarity);
        bonus_species_name := public._bot_species_name(bonus_species);
        INSERT INTO public.monsters(owner_id, species, name, hp, atk, def, spd, in_team)
        SELECT champion, bonus_species, bonus_species_name, s.hp, s.atk, s.def, s.spd, false
        FROM public._bot_species_stats(bonus_species) s
        LIMIT 1;
        bonus_pet_obj := jsonb_build_object(
          'species', bonus_species,
          'name', bonus_species_name,
          'rarity', chosen_rarity
        );
      END IF;

      UPDATE public.tournaments
        SET status='finished', finished_at=now(), champion_id=champion,
            champion_reward = jsonb_build_object(
              'coins', reward_coins,
              'gems', reward_gems,
              'rations', reward_rations,
              'bonus_pet', bonus_pet_obj
            )
        WHERE id = p_tournament_id;

      INSERT INTO public.tournament_champions(user_id, wins, last_win_at)
      VALUES (champion, 1, now())
      ON CONFLICT (user_id) DO UPDATE
        SET wins = public.tournament_champions.wins + 1, last_win_at = now();
    ELSE
      UPDATE public.tournaments
        SET status='finished', finished_at=now(), champion_id=champion
        WHERE id = p_tournament_id;
    END IF;
    RETURN;
  END IF;

  next_round := t.current_round + 1;
  FOR i IN 0..(array_length(winners_arr,1)/2 - 1) LOOP
    INSERT INTO public.tournament_matches(tournament_id, round, slot, p1_id, p2_id, status)
    VALUES (p_tournament_id, next_round, i, winners_arr[i*2 + 1], winners_arr[i*2 + 2], 'pending');
  END LOOP;
  UPDATE public.tournaments
    SET current_round = next_round, round_started_at = now()
    WHERE id = p_tournament_id;
END $function$;