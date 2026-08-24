create or replace function public.debug_who()
returns json language sql stable security invoker set search_path to public as $$
  select json_build_object(
    'current_user', current_user,
    'session_user', session_user,
    'jwt_role', current_setting('request.jwt.claims', true)
  )
$$;
grant execute on function public.debug_who() to authenticated, anon;