-- 1) Add new columns
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS current_round int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS round_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS round_duration_seconds int NOT NULL DEFAULT 90;

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS log jsonb,
  ADD COLUMN IF NOT EXISTS played_at timestamptz;

-- 2) RLS update: allow participants to UPDATE their own match rows (winner+log)
DROP POLICY IF EXISTS "Participants can update own match result" ON public.tournament_matches;
CREATE POLICY "Participants can update own match result"
ON public.tournament_matches
FOR UPDATE
TO authenticated
USING (auth.uid() = p1_id OR auth.uid() = p2_id)
WITH CHECK (auth.uid() = p1_id OR auth.uid() = p2_id);

-- 3) Helper: power-weighted winner pick
CREATE OR REPLACE FUNCTION public._tour_pick_winner(p1 uuid, p2 uuid, pw1 numeric, pw2 numeric)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE total numeric;
BEGIN
  total := GREATEST(COALESCE(pw1,1), 1) + GREATEST(COALESCE(pw2,1), 1);
  IF random() < (GREATEST(COALESCE(pw1,1),1) / total) THEN
    RETURN p1;
  ELSE
    RETURN p2;
  END IF;
END $$;

-- 4) Close registration: fill bots, sort bracket, create round-1 matches
CREATE OR REPLACE FUNCTION public.close_tournament_registration(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt int;
  need int;
  bot record;
  entries_arr uuid[];
  i int;
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
    -- not enough players: finish without champion
    UPDATE public.tournaments SET status='finished', finished_at=now() WHERE id = p_tournament_id;
    RETURN;
  END IF;

  -- Shuffle seeds
  WITH shuffled AS (
    SELECT id, (row_number() OVER (ORDER BY random()) - 1)::int AS s
    FROM public.tournament_entries WHERE tournament_id = p_tournament_id
  )
  UPDATE public.tournament_entries te SET seed = s.s
  FROM shuffled s WHERE te.id = s.id;

  SELECT array_agg(user_id ORDER BY seed) INTO entries_arr
  FROM public.tournament_entries WHERE tournament_id = p_tournament_id;

  -- Create round 1 matches (16)
  FOR i IN 0..15 LOOP
    INSERT INTO public.tournament_matches(tournament_id, round, slot, p1_id, p2_id, status)
    VALUES (p_tournament_id, 1, i, entries_arr[i*2 + 1], entries_arr[i*2 + 2], 'pending');
  END LOOP;

  UPDATE public.tournaments
    SET status='in_progress',
        current_round=1,
        round_started_at=now()
    WHERE id = p_tournament_id;
END $$;

-- 5) Report match result (called by player after their battle)
CREATE OR REPLACE FUNCTION public.report_match_result(p_match_id uuid, p_winner_id uuid, p_log jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE m record; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO m FROM public.tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF m IS NULL THEN RAISE EXCEPTION 'partida nao encontrada'; END IF;
  IF m.status = 'done' THEN RETURN; END IF;
  IF uid <> m.p1_id AND uid <> m.p2_id THEN RAISE EXCEPTION 'nao e participante'; END IF;
  IF p_winner_id <> m.p1_id AND p_winner_id <> m.p2_id THEN RAISE EXCEPTION 'vencedor invalido'; END IF;

  UPDATE public.tournament_matches
    SET winner_id = p_winner_id,
        log = p_log,
        status = 'done',
        played_at = now()
    WHERE id = p_match_id;

  -- Mark loser eliminated
  UPDATE public.tournament_entries
    SET eliminated_round = m.round
    WHERE tournament_id = m.tournament_id
      AND user_id = CASE WHEN p_winner_id = m.p1_id THEN m.p2_id ELSE m.p1_id END;
END $$;

-- 6) Advance round: resolve missing matches and create next round, or finish
CREATE OR REPLACE FUNCTION public.advance_tournament_round(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  rar_roll numeric;
  chosen_rarity text;
  updated_rations int;
BEGIN
  SELECT * INTO t FROM public.tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF t IS NULL OR t.status <> 'in_progress' THEN RETURN; END IF;

  -- Resolve all pending matches of current round
  FOR pending IN
    SELECT * FROM public.tournament_matches
    WHERE tournament_id = p_tournament_id AND round = t.current_round AND status <> 'done'
  LOOP
    SELECT power, is_bot INTO pw1, p1_is_bot FROM public.tournament_entries
      WHERE tournament_id = p_tournament_id AND user_id = pending.p1_id;
    SELECT power, is_bot INTO pw2, p2_is_bot FROM public.tournament_entries
      WHERE tournament_id = p_tournament_id AND user_id = pending.p2_id;

    IF NOT p1_is_bot AND p2_is_bot THEN
      -- player didn't play, bot wins by W.O.
      winner := pending.p2_id;
    ELSIF p1_is_bot AND NOT p2_is_bot THEN
      winner := pending.p1_id;
    ELSE
      -- both bots or both players who didn't show: weighted random
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

  -- Collect winners
  SELECT array_agg(winner_id ORDER BY slot) INTO winners_arr
  FROM public.tournament_matches
  WHERE tournament_id = p_tournament_id AND round = t.current_round;

  IF array_length(winners_arr, 1) = 1 THEN
    -- Champion!
    champion := winners_arr[1];
    SELECT is_bot INTO champion_is_bot FROM public.profiles WHERE id = champion;

    UPDATE public.tournaments
      SET status='finished', finished_at=now(), champion_id=champion
      WHERE id = p_tournament_id;

    IF champion IS NOT NULL THEN
      reward_coins := 1500 + floor(random() * 2501)::int;
      reward_gems := 25 + floor(random() * 26)::int;
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

      IF random() < 0.70 THEN
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
    RETURN;
  END IF;

  -- Create next round matches
  next_round := t.current_round + 1;
  FOR i IN 0..(array_length(winners_arr,1)/2 - 1) LOOP
    INSERT INTO public.tournament_matches(tournament_id, round, slot, p1_id, p2_id, status)
    VALUES (p_tournament_id, next_round, i, winners_arr[i*2 + 1], winners_arr[i*2 + 2], 'pending');
  END LOOP;
  UPDATE public.tournaments
    SET current_round = next_round, round_started_at = now()
    WHERE id = p_tournament_id;
END $$;

-- 7) Replace tournaments_tick to drive the new lifecycle
CREATE OR REPLACE FUNCTION public.tournaments_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t record; next_slot timestamptz;
BEGIN
  -- Close registration windows
  FOR t IN
    SELECT id FROM public.tournaments
    WHERE status='open' AND now() >= slot_at + interval '1 minute'
  LOOP
    PERFORM public.close_tournament_registration(t.id);
  END LOOP;

  -- Advance rounds whose timer expired
  FOR t IN
    SELECT id FROM public.tournaments
    WHERE status='in_progress'
      AND round_started_at IS NOT NULL
      AND now() >= round_started_at + (round_duration_seconds || ' seconds')::interval
  LOOP
    PERFORM public.advance_tournament_round(t.id);
  END LOOP;

  next_slot := public._tour_next_slot();
  PERFORM public.ensure_tournament(next_slot);
END $$;

-- 8) Drop the old monolithic run_tournament (no longer used)
DROP FUNCTION IF EXISTS public.run_tournament(uuid);

-- 9) Permissions
REVOKE EXECUTE ON FUNCTION public.close_tournament_registration(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_tournament_round(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tournaments_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.report_match_result(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournaments_tick() TO authenticated;