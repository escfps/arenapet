
-- Battle Pass: subscription tracking + daily claim counters
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bp_subscription_id text,
  ADD COLUMN IF NOT EXISTS bp_customer_id text,
  ADD COLUMN IF NOT EXISTS bp_status text,
  ADD COLUMN IF NOT EXISTS bp_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS bp_last_claim_date date,
  ADD COLUMN IF NOT EXISTS bp_days_claimed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bp_silvers_given integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bp_monthly_claimed boolean NOT NULL DEFAULT false;
