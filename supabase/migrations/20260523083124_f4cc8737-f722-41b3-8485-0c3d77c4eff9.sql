REVOKE SELECT ON public.public_profiles FROM anon, public;
GRANT SELECT ON public.public_profiles TO authenticated;