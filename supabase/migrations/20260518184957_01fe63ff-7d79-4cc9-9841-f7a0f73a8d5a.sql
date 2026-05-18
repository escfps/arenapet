CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove agendamento anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('bot-battles-loop');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Roda batalhas entre bots a cada 1 minuto
SELECT cron.schedule(
  'bot-battles-loop',
  '* * * * *',
  $$SELECT public.simulate_bot_battles();$$
);

-- Também recarrega energia/fome dos pets de bots a cada 5 min
DO $$
BEGIN
  PERFORM cron.unschedule('bot-energy-refill');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'bot-energy-refill',
  '*/5 * * * *',
  $$UPDATE public.monsters SET battle_energy = 24, battle_energy_at = now(), hunger = 100, happiness = 100, energy = 100 WHERE owner_id IN (SELECT id FROM public.profiles WHERE is_bot = true);$$
);