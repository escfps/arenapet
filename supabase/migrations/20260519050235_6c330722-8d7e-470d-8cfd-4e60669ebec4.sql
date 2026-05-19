REVOKE EXECUTE ON FUNCTION public.join_tournament(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.report_match_result(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.tournaments_tick() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.join_tournament(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_match_result(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tournaments_tick() TO authenticated;