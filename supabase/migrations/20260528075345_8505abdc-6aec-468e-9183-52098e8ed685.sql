DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'simulate-bot-battles') THEN
    PERFORM cron.unschedule('simulate-bot-battles');
  END IF;
END $$;

SELECT cron.schedule(
  'simulate-bot-battles',
  '*/30 * * * *',
  $$ SELECT public.simulate_bot_battles(); $$
);