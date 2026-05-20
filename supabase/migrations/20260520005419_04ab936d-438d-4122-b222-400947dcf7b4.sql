
-- 1) Top-up imediato em todos os pets de bots
UPDATE public.monsters m
SET battle_energy = 24,
    battle_energy_at = now(),
    hunger = 100,
    happiness = GREATEST(happiness, 80),
    energy = 100
FROM public.profiles p
WHERE p.id = m.owner_id AND p.is_bot = true;

-- 2) Garantir que simulate_bot_battles topa a energia/fome dos bots a cada tick
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
  -- Energia/fome infinita pros bots: sempre topa antes de simular
  UPDATE public.monsters m
  SET battle_energy = 24, battle_energy_at = now(), hunger = 100
  FROM public.profiles p
  WHERE p.id = m.owner_id AND p.is_bot = true
    AND (m.battle_energy < 24 OR m.hunger < 100);

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

    SELECT arena_points INTO winner_pts FROM public.profiles WHERE id = winner_id;
    IF random() < 0.04 THEN
      chest_rarity := public._bot_pick_chest_rarity(COALESCE(winner_pts, 0));
      PERFORM public._bot_pull_card(winner_id, chest_rarity);
    END IF;
  END LOOP;

  DELETE FROM public.battles b
  WHERE b.created_at < now() - interval '24 hours'
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = b.attacker_id AND p.is_bot = true)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = b.defender_id AND p.is_bot = true);
END;
$function$;
