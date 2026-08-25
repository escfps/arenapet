CREATE OR REPLACE FUNCTION public.market_buy(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  l record;
  buyer record;
  v_fee int;
  v_payout int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO l FROM public.market_listings WHERE id = p_id FOR UPDATE;
  IF l IS NULL OR l.status <> 'active' THEN RAISE EXCEPTION 'anuncio indisponivel'; END IF;
  IF l.seller_id = uid THEN RAISE EXCEPTION 'nao pode comprar seu proprio anuncio'; END IF;

  SELECT * INTO buyer FROM public.profiles WHERE id = uid FOR UPDATE;
  IF buyer IS NULL THEN RAISE EXCEPTION 'perfil nao encontrado'; END IF;

  IF l.currency = 'coins' THEN
    IF COALESCE(buyer.coins,0) < l.price THEN RAISE EXCEPTION 'moedas insuficientes'; END IF;
  ELSE
    IF COALESCE(buyer.gems,0) < l.price THEN RAISE EXCEPTION 'diamantes insuficientes'; END IF;
  END IF;

  IF l.kind = 'monster' THEN
    IF NOT EXISTS (SELECT 1 FROM public.monsters WHERE id = l.monster_id AND owner_id = l.seller_id) THEN
      UPDATE public.market_listings SET status = 'cancelled' WHERE id = p_id;
      RAISE EXCEPTION 'pokemon nao esta mais disponivel';
    END IF;
    UPDATE public.monsters
      SET owner_id = uid, in_team = false, team_position = 0
      WHERE id = l.monster_id;
  ELSIF l.kind = 'item' THEN
    INSERT INTO public.inventory(user_id, item_type, quantity) VALUES (uid, l.item_type, l.quantity)
    ON CONFLICT (user_id, item_type) DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity;
  ELSE
    INSERT INTO public.gym_badges(user_id, gym_type) VALUES (uid, l.gym_type)
    ON CONFLICT (user_id, gym_type) DO NOTHING;
  END IF;

  v_fee := GREATEST(1, ROUND(l.price * 0.03))::int;
  v_payout := l.price - v_fee;

  IF l.currency = 'coins' THEN
    UPDATE public.profiles SET coins = coins - l.price WHERE id = uid;
    UPDATE public.profiles SET coins = coins + v_payout WHERE id = l.seller_id;
  ELSE
    UPDATE public.profiles SET gems = gems - l.price WHERE id = uid;
    UPDATE public.profiles SET gems = gems + v_payout WHERE id = l.seller_id;
  END IF;

  UPDATE public.market_listings
    SET status = 'sold', buyer_id = uid, sold_at = now(), fee = v_fee
    WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'fee', v_fee, 'payout', v_payout, 'kind', l.kind);
END $function$;