DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bot-battles-loop') THEN
    PERFORM cron.unschedule('bot-battles-loop');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'simulate-bot-battles') THEN
    PERFORM cron.unschedule('simulate-bot-battles');
  END IF;
END $$;

SELECT cron.schedule(
  'simulate-bot-battles',
  '*/20 * * * *',
  $$ SELECT public.simulate_bot_battles(); $$
);