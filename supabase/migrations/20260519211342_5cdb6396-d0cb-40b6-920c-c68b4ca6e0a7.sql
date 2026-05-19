
CREATE OR REPLACE FUNCTION public._bot_build_battle_log(p_a uuid, p_b uuid, p_winner uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  team_a jsonb;
  team_b jsonb;
  a_names text[];
  b_names text[];
  log jsonb := '[]'::jsonb;
  turn int := 1;
  i int;
  attacker text;
  target text;
  side text;
  dmg int;
  crit boolean;
  winner_side text;
  loser_side text;
  loser_names text[];
  killed int := 0;
BEGIN
  SELECT array_agg(name ORDER BY team_position, created_at) INTO a_names
  FROM public.monsters WHERE owner_id = p_a AND in_team = true LIMIT 3;
  SELECT array_agg(name ORDER BY team_position, created_at) INTO b_names
  FROM public.monsters WHERE owner_id = p_b AND in_team = true LIMIT 3;

  IF a_names IS NULL OR array_length(a_names,1) IS NULL THEN a_names := ARRAY['Pet A']; END IF;
  IF b_names IS NULL OR array_length(b_names,1) IS NULL THEN b_names := ARRAY['Pet B']; END IF;

  winner_side := CASE WHEN p_winner = p_a THEN 'team_a' ELSE 'team_b' END;
  loser_side := CASE WHEN winner_side = 'team_a' THEN 'team_b' ELSE 'team_a' END;
  loser_names := CASE WHEN loser_side = 'team_a' THEN a_names ELSE b_names END;

  -- Simula 3-5 turnos de troca de golpes
  FOR i IN 1..(3 + floor(random()*3)::int) LOOP
    -- vencedor ataca
    attacker := (CASE WHEN winner_side='team_a' THEN a_names ELSE b_names END)[1 + floor(random()*array_length(CASE WHEN winner_side='team_a' THEN a_names ELSE b_names END,1))::int];
    target := (CASE WHEN winner_side='team_a' THEN b_names ELSE a_names END)[1 + floor(random()*array_length(CASE WHEN winner_side='team_a' THEN b_names ELSE a_names END,1))::int];
    dmg := 8 + floor(random()*20)::int;
    crit := random() < 0.15;
    IF crit THEN dmg := dmg * 2; END IF;
    log := log || jsonb_build_object(
      'turn', turn, 'actor', winner_side, 'actorName', attacker,
      'targetName', target, 'damage', dmg, 'crit', crit,
      'message', attacker || ' atacou ' || target || ' (' || dmg || ')'
    );

    -- perdedor revida (menos dano)
    attacker := (CASE WHEN loser_side='team_a' THEN a_names ELSE b_names END)[1 + floor(random()*array_length(CASE WHEN loser_side='team_a' THEN a_names ELSE b_names END,1))::int];
    target := (CASE WHEN loser_side='team_a' THEN b_names ELSE a_names END)[1 + floor(random()*array_length(CASE WHEN loser_side='team_a' THEN b_names ELSE a_names END,1))::int];
    dmg := 4 + floor(random()*12)::int;
    log := log || jsonb_build_object(
      'turn', turn, 'actor', loser_side, 'actorName', attacker,
      'targetName', target, 'damage', dmg, 'crit', false,
      'message', attacker || ' contra-atacou ' || target || ' (' || dmg || ')'
    );

    turn := turn + 1;
  END LOOP;

  -- Marca eliminação dos pets do perdedor
  FOREACH target IN ARRAY loser_names LOOP
    log := log || jsonb_build_object(
      'turn', turn, 'actor', winner_side,
      'actorName', (CASE WHEN winner_side='team_a' THEN a_names ELSE b_names END)[1],
      'targetName', target, 'damage', 0,
      'message', '💀 ' || target || ' foi derrotado'
    );
    killed := killed + 1;
  END LOOP;

  RETURN log;
END;
$$;

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
  attacker_id uuid;
  defender_id uuid;
  atk_won boolean;
  win_pts int := 15;
  loss_pts int := 15;
  win_xp int := 30;
  loss_xp int := 10;
  win_coins int := 100;
  winner_pts int;
  chest_rarity text;
  battle_log jsonb;
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

    -- Aleatoriza quem é o atacante para a entrada na tabela
    IF random() < 0.5 THEN
      attacker_id := winner_id; defender_id := loser_id; atk_won := true;
    ELSE
      attacker_id := loser_id; defender_id := winner_id; atk_won := false;
    END IF;

    battle_log := public._bot_build_battle_log(attacker_id, defender_id, winner_id);

    INSERT INTO public.battles (
      attacker_id, defender_id, winner_id, log,
      coins_reward, xp_reward,
      attacker_points_delta, defender_points_delta
    ) VALUES (
      attacker_id, defender_id, winner_id, battle_log,
      win_coins, win_xp,
      CASE WHEN atk_won THEN win_pts ELSE -loss_pts END,
      CASE WHEN atk_won THEN -loss_pts ELSE win_pts END
    );

    -- Em vez de upar rank, o vencedor ocasionalmente "abre um baú"
    SELECT arena_points INTO winner_pts FROM public.profiles WHERE id = winner_id;
    IF random() < 0.04 THEN
      chest_rarity := public._bot_pick_chest_rarity(COALESCE(winner_pts, 0));
      PERFORM public._bot_pull_card(winner_id, chest_rarity);
    END IF;
  END LOOP;

  -- Limpeza: apaga batalhas bot-vs-bot com mais de 24h para não inchar a tabela
  DELETE FROM public.battles b
  WHERE b.created_at < now() - interval '24 hours'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = b.attacker_id AND p.is_bot = true)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = b.defender_id AND p.is_bot = true);
END;
$function$;
