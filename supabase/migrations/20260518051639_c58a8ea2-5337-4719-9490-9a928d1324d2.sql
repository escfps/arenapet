ALTER TABLE public.monsters
  ADD COLUMN IF NOT EXISTS battle_energy integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS battle_energy_at timestamptz NOT NULL DEFAULT now();