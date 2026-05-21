CREATE TABLE public.gem_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  paddle_transaction_id TEXT NOT NULL UNIQUE,
  price_id TEXT NOT NULL,
  gems_credited INTEGER NOT NULL,
  amount_brl INTEGER NOT NULL,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_gem_purchases_user ON public.gem_purchases(user_id);

ALTER TABLE public.gem_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own gem purchases"
  ON public.gem_purchases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages gem purchases"
  ON public.gem_purchases FOR ALL
  USING (auth.role() = 'service_role');