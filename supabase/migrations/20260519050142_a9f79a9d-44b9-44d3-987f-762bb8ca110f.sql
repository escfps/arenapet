ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_status_check;

ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_status_check
  CHECK (status IN ('open', 'in_progress', 'finished'));

SELECT public.tournaments_tick();