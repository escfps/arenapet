-- Fix search_path on helper
CREATE OR REPLACE FUNCTION public._tour_next_slot()
RETURNS timestamptz LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT date_trunc('hour', now())
       + ((floor(extract(minute from now())::int / 10) + 1) * interval '10 minutes')
$$;

-- Lock down server-only functions
REVOKE EXECUTE ON FUNCTION public.run_tournament(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tournaments_tick() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_tournament(timestamptz) FROM PUBLIC, anon, authenticated;

-- Keep join_tournament callable by signed-in users
GRANT EXECUTE ON FUNCTION public.join_tournament(uuid) TO authenticated;