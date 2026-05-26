
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE INDEX IF NOT EXISTS idx_battles_created_at ON public.battles(created_at DESC);

CREATE OR REPLACE FUNCTION public.cleanup_battles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  max_rows int := 25000;
  batch_size int := 5000;
  deleted int;
  loops int := 0;
BEGIN
  -- Apaga batalhas bot vs bot com +24h em lotes
  LOOP
    WITH d AS (
      SELECT b.id
      FROM public.battles b
      WHERE b.created_at < now() - interval '24 hours'
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = b.attacker_id AND p.is_bot = true)
        AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = b.defender_id AND p.is_bot = true)
      LIMIT batch_size
    )
    DELETE FROM public.battles b USING d WHERE b.id = d.id;
    GET DIAGNOSTICS deleted = ROW_COUNT;
    loops := loops + 1;
    EXIT WHEN deleted = 0 OR loops > 20;
  END LOOP;

  -- Mantém no máximo 25k linhas no total (em lotes)
  loops := 0;
  LOOP
    WITH d AS (
      SELECT id FROM public.battles
      ORDER BY created_at DESC
      OFFSET max_rows
      LIMIT batch_size
    )
    DELETE FROM public.battles b USING d WHERE b.id = d.id;
    GET DIAGNOSTICS deleted = ROW_COUNT;
    loops := loops + 1;
    EXIT WHEN deleted = 0 OR loops > 200;
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-battles-every-5min');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-battles-every-5min',
  '*/5 * * * *',
  $$ SELECT public.cleanup_battles(); $$
);
