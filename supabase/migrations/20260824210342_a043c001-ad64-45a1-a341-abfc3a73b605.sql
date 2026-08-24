REVOKE EXECUTE ON FUNCTION public.gym_report_result(text, boolean, boolean) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.gym_claim_reward(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.gym_report_result(text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gym_claim_reward(text) TO authenticated;