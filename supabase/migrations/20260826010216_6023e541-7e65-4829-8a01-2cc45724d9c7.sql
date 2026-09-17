ALTER TABLE public.monsters ADD COLUMN IF NOT EXISTS soulbound boolean NOT NULL DEFAULT false;

-- Cliente nunca pode alterar a marcação soulbound
CREATE OR REPLACE FUNCTION public.guard_monsters_client_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_setting('app.market_authorized', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_client_role() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Criação de Pokémon não permitida pelo cliente';
  END IF;

  NEW.owner_id := OLD.owner_id;
  NEW.species := OLD.species;
  NEW.hp := OLD.hp;
  NEW.atk := OLD.atk;
  NEW.def := OLD.def;
  NEW.spd := OLD.spd;
  NEW.int := OLD.int;
  NEW.rank := OLD.rank;
  NEW.train_count := OLD.train_count;
  NEW.crit := OLD.crit;
  NEW.is_shiny := OLD.is_shiny;
  NEW.skin := OLD.skin;
  NEW.soulbound := OLD.soulbound;
  NEW.created_at := OLD.created_at;
  NEW.id := OLD.id;
  RETURN NEW;
END;
$function$;

-- Presente: bloqueia pokemon vinculado
CREATE OR REPLACE FUNCTION public.gift_send(p_to_username text, p_kind text, p_monster_id uuid DEFAULT NULL::uuid, p_item_type text DEFAULT NULL::text, p_quantity integer DEFAULT 1, p_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF m.soulbound THEN RAISE EXCEPTION 'esse pokemon e vinculado a sua conta e nao pode ser transferido'; END IF;
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
END $function$;

-- Mercado: bloqueia pokemon vinculado
CREATE OR REPLACE FUNCTION public.market_create_listing(p_kind text, p_currency text, p_price integer, p_monster_id uuid DEFAULT NULL::uuid, p_item_type text DEFAULT NULL::text, p_gym_type text DEFAULT NULL::text, p_quantity integer DEFAULT 1)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    IF m.soulbound THEN RAISE EXCEPTION 'esse pokemon e vinculado a sua conta e nao pode ser anunciado'; END IF;
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
END $function$;

-- Troca: trava no banco contra pokemon vinculado (defesa em profundidade)
CREATE OR REPLACE FUNCTION public.guard_trade_monster_soulbound()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.from_monster_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.monsters WHERE id = NEW.from_monster_id AND soulbound
  ) THEN
    RAISE EXCEPTION 'pokemon vinculado a conta nao pode ser trocado';
  END IF;
  IF NEW.to_monster_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.monsters WHERE id = NEW.to_monster_id AND soulbound
  ) THEN
    RAISE EXCEPTION 'pokemon vinculado a conta nao pode ser trocado';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_trade_soulbound ON public.trades;
CREATE TRIGGER trg_guard_trade_soulbound
BEFORE INSERT OR UPDATE OF from_monster_id, to_monster_id ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.guard_trade_monster_soulbound();