
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS highest_tier_rank smallint NOT NULL DEFAULT 0;
