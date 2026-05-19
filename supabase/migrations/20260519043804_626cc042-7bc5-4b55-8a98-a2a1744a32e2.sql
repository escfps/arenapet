CREATE OR REPLACE FUNCTION public.run_tournament(p_tournament_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cnt int;
  need int;
  bot record;
  entries_arr uuid[];
  next_arr uuid[];
  match_winner uuid;
  p1 uuid; p2 uuid;
  pw1 numeric; pw2 numeric;
  w1 int; w2 int;
  i int;
  round_num int;
  match_slot int;
  champion uuid;
  reward_coins int;
  reward_gems int;
  reward_rations int;
  bonus_species text;
  rar_roll numeric;
  chosen_rarity text;
  updated_rations int;
BEGIN
  PERFORM 1 FROM public.tournaments WHERE id = p_tournament_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO cnt FROM public.tournament_entries WHERE tournament_id = p_tournament_id;
  need := 32 - cnt;

  IF need > 0 THEN
    FOR bot IN
      SELECT p.id
      FROM public.profiles p
      WHERE p.is_bot = true
        AND p.id NOT IN (SELECT user_id FROM public.tournament_entries WHERE tournament_id = p_tournament_id)
        AND (SELECT count(*) FROM public.monsters m WHERE m.owner_id = p.id AND m.in_team = true) >= 3
      ORDER BY random()
      LIMIT need
    LOOP
      INSERT INTO public.tournament_entries(tournament_id, user_id, is_bot, power)
      VALUES (p_tournament_id, bot.id, true, public._tour_team_power(bot.id));
    END LOOP;
  END IF;

  SELECT count(*) INTO cnt FROM public.tournament_entries WHERE tournament_id = p_tournament_id;
  IF cnt < 32 THEN
    UPDATE public.tournaments SET status='finished', finished_at=now() WHERE id = p_tournament_id;
    RETURN;
  END IF;

  WITH shuffled AS (
    SELECT id, (row_number() OVER (ORDER BY random()) - 1)::int AS s
    FROM public.tournament_entries WHERE tournament_id = p_tournament_id
  )
  UPDATE public.tournament_entries te SET seed = s.s
  FROM shuffled s WHERE te.id = s.id;

  SELECT array_agg(user_id ORDER BY seed) INTO entries_arr
  FROM public.tournament_entries WHERE tournament_id = p_tournament_id;

  round_num := 1;
  WHILE array_length(entries_arr, 1) > 1 LOOP
    next_arr := ARRAY[]::uuid[];
    match_slot := 0;
    FOR i IN 0..(array_length(entries_arr,1)/2 - 1) LOOP
      p1 := entries_arr[i*2 + 1];
      p2 := entries_arr[i*2 + 2];
      SELECT power INTO pw1 FROM public.tournament_entries WHERE tournament_id = p_tournament_id AND user_id = p1;
      SELECT power INTO pw2 FROM public.tournament_entries WHERE tournament_id = p_tournament_id AND user_id = p2;
      pw1 := GREATEST(COALESCE(pw1, 1), 1);
      pw2 := GREATEST(COALESCE(pw2, 1), 1);
      w1 := 0; w2 := 0;
      WHILE w1 < 2 AND w2 < 2 LOOP
        IF random() < (pw1 / (pw1 + pw2)) THEN w1 := w1 + 1; ELSE w2 := w2 + 1; END IF;
      END LOOP;
      IF w1 = 2 THEN match_winner := p1; ELSE match_winner := p2; END IF;
      INSERT INTO public.tournament_matches(tournament_id, round, slot, p1_id, p2_id, winner_id, score)
      VALUES (p_tournament_id, round_num, match_slot, p1, p2, match_winner, w1 || '-' || w2);
      UPDATE public.tournament_entries
        SET eliminated_round = round_num
        WHERE tournament_id = p_tournament_id
          AND user_id = CASE WHEN match_winner = p1 THEN p2 ELSE p1 END;
      next_arr := array_append(next_arr, match_winner);
      match_slot := match_slot + 1;
    END LOOP;
    entries_arr := next_arr;
    round_num := round_num + 1;
  END LOOP;
  champion := entries_arr[1];

  UPDATE public.tournaments
    SET status='finished', finished_at=now(), champion_id=champion
    WHERE id = p_tournament_id;

  IF champion IS NOT NULL THEN
    -- Gold Chest roll: coins 1500-4000, gems 25-50 (sempre), rações 6-12, 70% pet
    reward_coins := 1500 + floor(random() * 2501)::int;
    reward_gems := 25 + floor(random() * 26)::int;
    reward_rations := 6 + floor(random() * 7)::int;

    UPDATE public.profiles
      SET coins = coins + reward_coins, gems = gems + reward_gems
      WHERE id = champion;

    UPDATE public.inventory SET quantity = quantity + reward_rations
      WHERE user_id = champion AND item_type = 'ration'
      RETURNING quantity INTO updated_rations;
    IF updated_rations IS NULL THEN
      INSERT INTO public.inventory(user_id, item_type, quantity)
      VALUES (champion, 'ration', reward_rations);
    END IF;

    IF random() < 0.70 THEN
      -- pesos baú de ouro: common 30, rare 45, super_rare 22, epic 3
      rar_roll := random() * 100;
      IF rar_roll < 30 THEN chosen_rarity := 'common';
      ELSIF rar_roll < 75 THEN chosen_rarity := 'rare';
      ELSIF rar_roll < 97 THEN chosen_rarity := 'super_rare';
      ELSE chosen_rarity := 'epic';
      END IF;
      bonus_species := public._bot_random_species(chosen_rarity);
      INSERT INTO public.monsters(owner_id, species, name, hp, atk, def, spd, in_team)
      SELECT champion, bonus_species, public._bot_species_name(bonus_species), s.hp, s.atk, s.def, s.spd, false
      FROM public._bot_species_stats(bonus_species) s
      LIMIT 1;
    END IF;

    INSERT INTO public.tournament_champions(user_id, wins, last_win_at)
    VALUES (champion, 1, now())
    ON CONFLICT (user_id) DO UPDATE
      SET wins = public.tournament_champions.wins + 1, last_win_at = now();
  END IF;
END $function$;