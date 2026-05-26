CREATE TABLE public.iap_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  product_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  gems_credited INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (platform, transaction_id)
);
GRANT SELECT ON public.iap_transactions TO authenticated;
GRANT ALL ON public.iap_transactions TO service_role;
ALTER TABLE public.iap_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own iap" ON public.iap_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);