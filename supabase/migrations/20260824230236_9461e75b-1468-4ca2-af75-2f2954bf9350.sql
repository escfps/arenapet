-- Fase 4: revogar execucao direta de funcoes internas (somente servidor/cron)
REVOKE EXECUTE ON FUNCTION public.apply_arena_defender_result(uuid, boolean, integer, integer) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.report_match_result(uuid, uuid, jsonb) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gym_report_result(text, boolean, boolean) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gym_start_challenge(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seasons_tick() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.end_season(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_tournament_round(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.close_tournament_registration(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_tournament(timestamp with time zone) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_battles() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.train_bot_pets() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.simulate_bot_battles() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.battles_cap_trigger() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gift_send(text, text, uuid, text, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gift_claim(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.gift_cancel(uuid) FROM anon;