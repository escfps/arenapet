ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_chest_claimed boolean NOT NULL DEFAULT false;

UPDATE public.profiles p
  SET welcome_chest_claimed = true
  WHERE EXISTS (SELECT 1 FROM public.monsters m WHERE m.owner_id = p.id);