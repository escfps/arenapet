REVOKE EXECUTE ON FUNCTION public.gift_send(text, text, uuid, text, integer, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gift_claim(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.gift_cancel(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gift_send(text, text, uuid, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gift_claim(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gift_cancel(uuid) TO authenticated;