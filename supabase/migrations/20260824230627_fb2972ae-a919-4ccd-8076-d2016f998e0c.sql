alter view public.public_profiles set (security_invoker = on);
grant select on public.public_profiles to anon, authenticated;