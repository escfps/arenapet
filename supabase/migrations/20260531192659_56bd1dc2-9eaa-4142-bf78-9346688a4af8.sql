
ALTER TABLE public.redeem_codes
  ADD COLUMN IF NOT EXISTS max_uses integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS uses_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.redeem_code_uses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id uuid NOT NULL REFERENCES public.redeem_codes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (code_id, user_id)
);

GRANT SELECT ON public.redeem_code_uses TO authenticated;
GRANT ALL ON public.redeem_code_uses TO service_role;

ALTER TABLE public.redeem_code_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users see own redeem uses"
ON public.redeem_code_uses
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

INSERT INTO public.redeem_codes (code, reward_type, reward_data, created_by, max_uses, uses_count)
VALUES (
  'TEXASGRAMADO',
  'chest',
  '{"chestTier":"gold"}'::jsonb,
  '9efcc279-b110-4feb-862e-deea6acf858e',
  999,
  0
)
ON CONFLICT DO NOTHING;
