CREATE TABLE public.market_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  buyer_id uuid,
  kind text NOT NULL CHECK (kind IN ('monster','item','badge')),
  monster_id uuid REFERENCES public.monsters(id) ON DELETE SET NULL,
  item_type text,
  gym_type text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  currency text NOT NULL CHECK (currency IN ('coins','gems')),
  price integer NOT NULL CHECK (price > 0),
  fee integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sold_at timestamptz
);

GRANT SELECT ON public.market_listings TO authenticated;
GRANT ALL ON public.market_listings TO service_role;

ALTER TABLE public.market_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market listings visible to signed-in users"
  ON public.market_listings FOR SELECT TO authenticated
  USING (status = 'active' OR seller_id = auth.uid() OR buyer_id = auth.uid());

CREATE INDEX market_listings_active_idx ON public.market_listings (status, created_at DESC);
CREATE INDEX market_listings_seller_idx ON public.market_listings (seller_id);

CREATE TRIGGER market_listings_updated_at
  BEFORE UPDATE ON public.market_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ criar anúncio ============
CREATE OR REPLACE FUNCTION public.market_create_listing(
  p_kind text,
  p_currency text,
  p_price integer,
  p_monster_id uuid DEFAULT NULL,
  p_item_type text DEFAULT NULL,
  p_gym_type text DEFAULT NULL,
  p_quantity integer DEFAULT 1
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  m record;
  have int;
  snap jsonb := '{}'::jsonb;
  new_id uuid;
  qty int := GREATEST(1, COALESCE(p_quantity, 1));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  IF p_currency NOT IN ('coins','gems') THEN RAISE EXCEPTION 'moeda invalida'; END IF;
  IF p_price IS NULL OR p_price < 1 OR p_price > 100000 THEN RAISE EXCEPTION 'preco invalido (1 a 100000)'; END IF;
  IF (SELECT count(*) FROM public.market_listings WHERE seller_id = uid AND status = 'active') >= 10 THEN
    RAISE EXCEPTION 'limite de 10 anuncios ativos';
  END IF;

  IF p_kind = 'monster' THEN
    SELECT * INTO m FROM public.monsters WHERE id = p_monster_id AND owner_id = uid FOR UPDATE;
    IF m IS NULL THEN RAISE EXCEPTION 'pokemon nao encontrado'; END IF;
    IF m.in_team THEN RAISE EXCEPTION 'retire o pokemon do time antes de anunciar'; END IF;
    IF EXISTS (SELECT 1 FROM public.market_listings WHERE monster_id = m.id AND status = 'active') THEN
      RAISE EXCEPTION 'esse pokemon ja esta anunciado';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.trades t
      WHERE t.status = 'pending' AND (t.from_monster_id = m.id OR t.to_monster_id = m.id)
    ) THEN RAISE EXCEPTION 'esse pokemon esta em uma troca pendente'; END IF;
    IF (SELECT count(*) FROM public.monsters WHERE owner_id = uid) <= 3 THEN
      RAISE EXCEPTION 'voce precisa manter pelo menos 3 pokemons';
    END IF;
    snap := jsonb_build_object(
      'species', m.species, 'name', m.name, 'rank', m.rank, 'is_shiny', m.is_shiny,
      'hp', m.hp, 'atk', m.atk, 'def', m.def, 'spd', m.spd, 'int', m.int, 'skin', m.skin
    );
    qty := 1;

  ELSIF p_kind = 'item' THEN
    IF p_item_type IS NULL THEN RAISE EXCEPTION 'item invalido'; END IF;
    SELECT quantity INTO have FROM public.inventory WHERE user_id = uid AND item_type = p_item_type FOR UPDATE;
    IF COALESCE(have, 0) < qty THEN RAISE EXCEPTION 'voce nao tem essa quantidade'; END IF;
    UPDATE public.inventory SET quantity = quantity - qty WHERE user_id = uid AND item_type = p_item_type;
    snap := jsonb_build_object('item_type', p_item_type);

  ELSIF p_kind = 'badge' THEN
    IF p_gym_type IS NULL THEN RAISE EXCEPTION 'insignia invalida'; END IF;
    qty := 1;
    DELETE FROM public.gym_badges
    WHERE id = (SELECT id FROM public.gym_badges WHERE user_id = uid AND gym_type = p_gym_type LIMIT 1);
    IF NOT FOUND THEN RAISE EXCEPTION 'voce nao tem essa insignia'; END IF;
    snap := jsonb_build_object('gym_type', p_gym_type);

  ELSE
    RAISE EXCEPTION 'tipo de anuncio invalido';
  END IF;

  INSERT INTO public.market_listings(seller_id, kind, monster_id, item_type, gym_type, quantity, currency, price, snapshot)
  VALUES (uid, p_kind, CASE WHEN p_kind = 'monster' THEN p_monster_id END, CASE WHEN p_kind = 'item' THEN p_item_type END,
          CASE WHEN p_kind = 'badge' THEN p_gym_type END, qty, p_currency, p_price, snap)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id);
END $$;

REVOKE EXECUTE ON FUNCTION public.market_create_listing(text,text,integer,uuid,text,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_create_listing(text,text,integer,uuid,text,text,integer) TO authenticated;

-- ============ cancelar anúncio ============
CREATE OR REPLACE FUNCTION public.market_cancel_listing(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  l record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO l FROM public.market_listings WHERE id = p_id FOR UPDATE;
  IF l IS NULL OR l.seller_id <> uid THEN RAISE EXCEPTION 'anuncio nao encontrado'; END IF;
  IF l.status <> 'active' THEN RAISE EXCEPTION 'anuncio nao esta ativo'; END IF;

  IF l.kind = 'item' THEN
    INSERT INTO public.inventory(user_id, item_type, quantity) VALUES (uid, l.item_type, l.quantity)
    ON CONFLICT (user_id, item_type) DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity;
  ELSIF l.kind = 'badge' THEN
    INSERT INTO public.gym_badges(user_id, gym_type) VALUES (uid, l.gym_type)
    ON CONFLICT (user_id, gym_type) DO NOTHING;
  END IF;

  UPDATE public.market_listings SET status = 'cancelled' WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END $$;

REVOKE EXECUTE ON FUNCTION public.market_cancel_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_cancel_listing(uuid) TO authenticated;

-- ============ comprar ============
CREATE OR REPLACE FUNCTION public.market_buy(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  l record;
  buyer record;
  fee int;
  payout int;
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

  -- entrega
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

  fee := GREATEST(1, ROUND(l.price * 0.03))::int;
  payout := l.price - fee;

  IF l.currency = 'coins' THEN
    UPDATE public.profiles SET coins = coins - l.price WHERE id = uid;
    UPDATE public.profiles SET coins = coins + payout WHERE id = l.seller_id;
  ELSE
    UPDATE public.profiles SET gems = gems - l.price WHERE id = uid;
    UPDATE public.profiles SET gems = gems + payout WHERE id = l.seller_id;
  END IF;

  UPDATE public.market_listings
    SET status = 'sold', buyer_id = uid, sold_at = now(), fee = fee
    WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'fee', fee, 'payout', payout, 'kind', l.kind);
END $$;

REVOKE EXECUTE ON FUNCTION public.market_buy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid) TO authenticated;