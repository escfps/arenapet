-- Serialize bot routines to avoid deadlocks between concurrent jobs
CREATE OR REPLACE FUNCTION public.bot_jobs_lock() RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT pg_try_advisory_xact_lock(918273645) $$;

DO $mig$
DECLARE src text;
BEGIN
  FOR src IN SELECT unnest(ARRAY['simulate_bot_battles','train_bot_pets','simulate_bot_gyms'])
  LOOP
    EXECUTE replace(
      pg_get_functiondef(('public.' || src || '()')::regprocedure),
      E'BEGIN\n',
      E'BEGIN\n  IF NOT pg_try_advisory_xact_lock(918273645) THEN RETURN; END IF;\n'
    );
  END LOOP;
END $mig$;

SELECT cron.alter_job(15, schedule => '3,23,43 * * * *');
SELECT cron.alter_job(16, schedule => '13,33,53 * * * *');
SELECT cron.alter_job(6, schedule => '8,18,28,38,48,58 * * * *');
