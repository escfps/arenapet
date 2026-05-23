-- 1. Restringir SELECT amplo em profiles (campos sensíveis: gems, coins, bp_*, pity_*, etc.)
DROP POLICY IF EXISTS "Anyone authenticated can read profiles for trades" ON public.profiles;

-- 2. View pública com apenas colunas seguras para reads cross-user
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = off) AS
SELECT
  id,
  username,
  level,
  vip_until,
  arena_points,
  is_bot,
  wins,
  losses,
  last_seen_at,
  highest_tier_rank,
  created_at
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated, anon;

-- 3. Remover UPDATE permissivo em tournament_matches
-- (cliente nunca atualiza — escalation: participante podia se declarar vencedor)
DROP POLICY IF EXISTS "Participants can update own match result" ON public.tournament_matches;

-- 4. Revogar EXECUTE de funções SECURITY DEFINER administrativas
-- end_season e seasons_tick são chamados apenas via supabaseAdmin/cron
REVOKE EXECUTE ON FUNCTION public.end_season(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.seasons_tick() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.simulate_bot_battles() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.train_bot_pets() FROM anon, authenticated, public;

-- 5. Restringir apply_arena_defender_result a usuários autenticados (não anon)
REVOKE EXECUTE ON FUNCTION public.apply_arena_defender_result FROM anon, public;