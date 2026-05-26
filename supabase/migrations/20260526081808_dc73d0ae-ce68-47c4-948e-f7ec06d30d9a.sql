CREATE OR REPLACE FUNCTION public.cleanup_battles()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $f$
DECLARE max_rows int := 10000; cutoff_ts timestamptz;
BEGIN
  SELECT created_at INTO cutoff_ts FROM public.battles
    ORDER BY created_at DESC OFFSET max_rows LIMIT 1;
  IF cutoff_ts IS NULL THEN RETURN; END IF;
  DELETE FROM public.battles WHERE created_at <= cutoff_ts;
END; $f$;