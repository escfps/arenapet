ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tutorial_reward_claimed boolean NOT NULL DEFAULT false;