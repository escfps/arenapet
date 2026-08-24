CREATE TABLE public.player_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('monster','item','gems')),
  monster_id uuid REFERENCES public.monsters(id) ON DELETE SET NULL,
  item_type text,
  quantity integer NOT NULL DEFAULT 1,
  message text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','claimed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  claimed_at timestamptz
);

GRANT SELECT ON public.player_gifts TO authenticated;
GRANT ALL ON public.player_gifts TO service_role;

ALTER TABLE public.player_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own gifts" ON public.player_gifts
FOR SELECT TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE INDEX player_gifts_receiver_idx ON public.player_gifts(receiver_id, status);
CREATE INDEX player_gifts_sender_idx ON public.player_gifts(sender_id, status);

CREATE TRIGGER player_gifts_updated_at BEFORE UPDATE ON public.player_gifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.gift_send(
  p_to_username text,
  p_kind text,
  p_monster_id uuid DEFAULT NULL,
  p_item_type text DEFAULT NULL,
  p_quantity integer DEFAULT 1,
  p_message text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  target record;
  m record;
  have int;
  qty int := GREATEST(1, COALESCE(p_quantity, 1));
  snap jsonb := '{}'::jsonb;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT id, username INTO target FROM public.profiles WHERE username ILIKE p_to_username LIMIT 1;
  IF target IS NULL THEN RAISE EXCEPTION 'jogador nao encontrado'; END IF;
  IF target.id = uid THEN RAISE EXCEPTION 'voce nao pode enviar presente para si mesmo'; END IF;
  IF (SELECT count(*) FROM public.player_gifts WHERE sender_id = uid AND status = 'pending') >= 20 THEN
    RAISE EXCEPTION 'limite de 20 presentes pendentes';
  END IF;

  IF p_kind = 'monster' THEN
    SELECT * INTO m FROM public.monsters WHERE id = p_monster_id AND owner_id = uid FOR UPDATE;
    IF m IS NULL THEN RAISE EXCEPTION 'pokemon nao encontrado'; END IF;
    IF m.in_team THEN RAISE EXCEPTION 'retire o pokemon do time antes de presentear'; END IF;
    IF EXISTS (SELECT 1 FROM public.market_listings WHERE monster_id = m.id AND status = 'active') THEN
      RAISE EXCEPTION 'esse pokemon esta anunciado no mercado';
    END IF;
    IF EXISTS (SELECT 1 FROM public.player_gifts WHERE monster_id = m.id AND status = 'pending') THEN
      RAISE EXCEPTION 'esse pokemon ja esta em um presente pendente';
    END IF;
    IF EXISTS (SELECT 1 FROM public.trades t WHERE t.status = 'pending' AND (t.from_monster_id = m.id OR t.to_monster_id = m.id)) THEN
      RAISE EXCEPTION 'esse pokemon esta em uma troca pendente';
    END IF;
    IF (SELECT count(*) FROM public.monsters WHERE owner_id = uid) <= 3 THEN
      RAISE EXCEPTION 'voce precisa manter pelo menos 3 pokemons';
    END IF;
    qty := 1;
    snap := jsonb_build_object('species', m.species, 'name', m.name, 'rank', m.rank, 'is_shiny', m.is_shiny);

  ELSIF p_kind = 'item' THEN
    IF p_item_type IS NULL THEN RAISE EXCEPTION 'item invalido'; END IF;
    SELECT quantity INTO have FROM public.inventory WHERE user_id = uid AND item_type = p_item_type FOR UPDATE;
    IF COALESCE(have, 0) < qty THEN RAISE EXCEPTION 'voce nao tem essa quantidade'; END IF;
    UPDATE public.inventory SET quantity = quantity - qty WHERE user_id = uid AND item_type = p_item_type;
    snap := jsonb_build_object('item_type', p_item_type);

  ELSIF p_kind = 'gems' THEN
    IF qty < 1 OR qty > 100000 THEN RAISE EXCEPTION 'quantidade invalida'; END IF;
    SELECT gems INTO have FROM public.profiles WHERE id = uid FOR UPDATE;
    IF COALESCE(have, 0) < qty THEN RAISE EXCEPTION 'diamantes insuficientes'; END IF;
    UPDATE public.profiles SET gems = gems - qty WHERE id = uid;
    snap := jsonb_build_object('gems', qty);

  ELSE
    RAISE EXCEPTION 'tipo de presente invalido';
  END IF;

  INSERT INTO public.player_gifts(sender_id, receiver_id, kind, monster_id, item_type, quantity, message, snapshot)
  VALUES (uid, target.id, p_kind,
          CASE WHEN p_kind = 'monster' THEN p_monster_id END,
          CASE WHEN p_kind = 'item' THEN p_item_type END,
          qty, NULLIF(btrim(COALESCE(p_message,'')), ''), snap)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('ok', true, 'id', new_id, 'to_username', target.username);
END $$;

CREATE OR REPLACE FUNCTION public.gift_claim(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  g record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO g FROM public.player_gifts WHERE id = p_id FOR UPDATE;
  IF g IS NULL THEN RAISE EXCEPTION 'presente nao encontrado'; END IF;
  IF g.receiver_id <> uid THEN RAISE EXCEPTION 'esse presente nao e seu'; END IF;
  IF g.status <> 'pending' THEN RAISE EXCEPTION 'presente indisponivel'; END IF;

  IF g.kind = 'monster' THEN
    UPDATE public.monsters SET owner_id = uid, in_team = false, team_position = 0 WHERE id = g.monster_id;
  ELSIF g.kind = 'item' THEN
    INSERT INTO public.inventory(user_id, item_type, quantity)
    VALUES (uid, g.item_type, g.quantity)
    ON CONFLICT (user_id, item_type) DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity;
  ELSIF g.kind = 'gems' THEN
    UPDATE public.profiles SET gems = gems + g.quantity WHERE id = uid;
  END IF;

  UPDATE public.player_gifts SET status = 'claimed', claimed_at = now() WHERE id = g.id;
  RETURN jsonb_build_object('ok', true, 'kind', g.kind, 'quantity', g.quantity);
END $$;

CREATE OR REPLACE FUNCTION public.gift_cancel(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  g record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;
  SELECT * INTO g FROM public.player_gifts WHERE id = p_id FOR UPDATE;
  IF g IS NULL THEN RAISE EXCEPTION 'presente nao encontrado'; END IF;
  IF g.sender_id <> uid THEN RAISE EXCEPTION 'esse presente nao e seu'; END IF;
  IF g.status <> 'pending' THEN RAISE EXCEPTION 'presente indisponivel'; END IF;

  IF g.kind = 'item' THEN
    INSERT INTO public.inventory(user_id, item_type, quantity)
    VALUES (uid, g.item_type, g.quantity)
    ON CONFLICT (user_id, item_type) DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity;
  ELSIF g.kind = 'gems' THEN
    UPDATE public.profiles SET gems = gems + g.quantity WHERE id = uid;
  END IF;

  UPDATE public.player_gifts SET status = 'cancelled' WHERE id = g.id;
  RETURN jsonb_build_object('ok', true);
END $$;