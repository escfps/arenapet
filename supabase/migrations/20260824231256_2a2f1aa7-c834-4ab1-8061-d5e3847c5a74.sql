ALTER VIEW public.public_profiles SET (security_invoker = false);
ALTER VIEW public.public_profiles OWNER TO postgres;
GRANT SELECT ON public.public_profiles TO authenticated, anon;