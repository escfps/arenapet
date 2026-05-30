
-- 1) Friendships: impedir que o requester auto-aceite o pedido
DROP POLICY IF EXISTS "friendships_update" ON public.friendships;
CREATE POLICY "friendships_update"
ON public.friendships
FOR UPDATE
TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b)
WITH CHECK (
  (auth.uid() = user_a OR auth.uid() = user_b)
  AND (
    -- só o não-requester pode marcar como accepted
    status <> 'accepted' OR auth.uid() <> requester_id
  )
);

-- 2) Revogar EXECUTE público das funções SECURITY DEFINER expostas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon;', r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated, service_role;', r.proname, r.args);
  END LOOP;
END $$;

-- admin_launch_reset não deve ser chamável por usuários comuns
REVOKE EXECUTE ON FUNCTION public.admin_launch_reset() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_launch_reset() TO service_role;
