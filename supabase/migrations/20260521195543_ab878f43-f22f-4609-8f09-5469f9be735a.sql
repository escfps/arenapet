
CREATE TABLE public.redeem_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  reward_type text NOT NULL,
  reward_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  used_by uuid,
  used_at timestamptz
);

ALTER TABLE public.redeem_codes ENABLE ROW LEVEL SECURITY;

-- Access happens through server functions using supabaseAdmin (no direct client access needed)
CREATE INDEX idx_redeem_codes_code ON public.redeem_codes(code);
CREATE INDEX idx_redeem_codes_used ON public.redeem_codes(used_at);
