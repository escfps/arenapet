-- Fase 4: bloquear escrita direta do cliente em trocas, amizades, presentes, mensagens e desafios
DROP POLICY IF EXISTS "Users create trades they send" ON public.trades;
DROP POLICY IF EXISTS "Users update their trades" ON public.trades;

DROP POLICY IF EXISTS challenges_insert ON public.friend_challenges;
DROP POLICY IF EXISTS challenges_update ON public.friend_challenges;

DROP POLICY IF EXISTS gifts_insert ON public.friend_gifts;
DROP POLICY IF EXISTS gifts_update ON public.friend_gifts;

DROP POLICY IF EXISTS messages_insert ON public.friend_messages;
DROP POLICY IF EXISTS messages_update ON public.friend_messages;

DROP POLICY IF EXISTS friendships_insert ON public.friendships;
DROP POLICY IF EXISTS friendships_update ON public.friendships;
DROP POLICY IF EXISTS friendships_delete ON public.friendships;

DROP TRIGGER IF EXISTS guard_trades_server_only ON public.trades;
CREATE TRIGGER guard_trades_server_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_write();

DROP TRIGGER IF EXISTS guard_friendships_server_only ON public.friendships;
CREATE TRIGGER guard_friendships_server_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_write();

DROP TRIGGER IF EXISTS guard_friend_gifts_server_only ON public.friend_gifts;
CREATE TRIGGER guard_friend_gifts_server_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.friend_gifts
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_write();

DROP TRIGGER IF EXISTS guard_friend_messages_server_only ON public.friend_messages;
CREATE TRIGGER guard_friend_messages_server_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.friend_messages
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_write();

DROP TRIGGER IF EXISTS guard_friend_challenges_server_only ON public.friend_challenges;
CREATE TRIGGER guard_friend_challenges_server_only
  BEFORE INSERT OR UPDATE OR DELETE ON public.friend_challenges
  FOR EACH ROW EXECUTE FUNCTION public.guard_server_only_write();

-- Trocas: garantir que um pokemon anunciado no mercado nao entre em troca pendente
CREATE OR REPLACE FUNCTION public.guard_trade_monster_not_listed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending','accepted') THEN
    IF EXISTS (
      SELECT 1 FROM public.market_listings ml
      WHERE ml.status = 'active'
        AND ml.monster_id IN (NEW.from_monster_id, NEW.to_monster_id)
    ) THEN
      RAISE EXCEPTION 'pokemon esta anunciado no mercado';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trades_not_listed ON public.trades;
CREATE TRIGGER trades_not_listed
  BEFORE INSERT OR UPDATE ON public.trades
  FOR EACH ROW EXECUTE FUNCTION public.guard_trade_monster_not_listed();