
ALTER TABLE public.battles
  ADD COLUMN IF NOT EXISTS attacker_points_delta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS defender_points_delta integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.apply_arena_defender_result(
  p_defender_id uuid,
  p_attacker_won boolean,
  p_win_pts int,
  p_loss_pts int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  delta int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  IF uid = p_defender_id THEN RAISE EXCEPTION 'atacante nao pode ser o defensor'; END IF;
  IF p_win_pts < 0 OR p_win_pts > 100 OR p_loss_pts < 0 OR p_loss_pts > 100 THEN
    RAISE EXCEPTION 'pontuacao invalida';
  END IF;

  -- Se o atacante venceu, o defensor PERDE pontos; senão GANHA.
  delta := CASE WHEN p_attacker_won THEN -p_loss_pts ELSE p_win_pts END;

  UPDATE public.profiles
    SET arena_points = GREATEST(0, COALESCE(arena_points, 0) + delta),
        wins = COALESCE(wins, 0) + CASE WHEN p_attacker_won THEN 0 ELSE 1 END,
        losses = COALESCE(losses, 0) + CASE WHEN p_attacker_won THEN 1 ELSE 0 END
    WHERE id = p_defender_id;
END $$;
