-- Remove client UPDATE on expeditions (server functions use admin client)
DROP POLICY IF EXISTS "Users update own expeditions" ON public.expeditions;

-- Remove profiles from realtime publication to prevent broadcast of sensitive fields
ALTER PUBLICATION supabase_realtime DROP TABLE public.profiles;