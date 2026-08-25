CREATE OR REPLACE FUNCTION public.guard_profiles_client_write()
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
    RAISE EXCEPTION 'Criação de perfil não permitida pelo cliente';
  END IF;

  NEW.username := OLD.username;
  NEW.coins := OLD.coins;
  NEW.gems := OLD.gems;
  NEW.xp := OLD.xp;
  NEW.level := OLD.level;
  NEW.arena_points := OLD.arena_points;
  NEW.wins := OLD.wins;
  NEW.losses := OLD.losses;
  NEW.vip_until := OLD.vip_until;
  NEW.expedition_slots := OLD.expedition_slots;
  NEW.is_bot := OLD.is_bot;
  NEW.nick_changes := OLD.nick_changes;
  NEW.welcome_chest_claimed := OLD.welcome_chest_claimed;
  NEW.tutorial_reward_claimed := OLD.tutorial_reward_claimed;
  NEW.highest_tier_rank := OLD.highest_tier_rank;
  NEW.pity_silver := OLD.pity_silver;
  NEW.pity_gold := OLD.pity_gold;
  NEW.pity_legendary := OLD.pity_legendary;
  NEW.pity_mythic := OLD.pity_mythic;
  NEW.bp_subscription_id := OLD.bp_subscription_id;
  NEW.bp_customer_id := OLD.bp_customer_id;
  NEW.bp_status := OLD.bp_status;
  NEW.bp_started_at := OLD.bp_started_at;
  NEW.bp_last_claim_date := OLD.bp_last_claim_date;
  NEW.bp_days_claimed := OLD.bp_days_claimed;
  NEW.bp_silvers_given := OLD.bp_silvers_given;
  NEW.bp_monthly_claimed := OLD.bp_monthly_claimed;
  NEW.created_at := OLD.created_at;
  NEW.id := OLD.id;
  RETURN NEW;
END;
$function$;

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
  NEW.created_at := OLD.created_at;
  NEW.id := OLD.id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.market_buy(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  l public.market_listings%ROWTYPE;
  buyer public.profiles%ROWTYPE;
  v_fee integer;
  v_payout integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'nao autenticado'; END IF;

  SELECT * INTO l FROM public.market_listings WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR l.status <> 'active' THEN RAISE EXCEPTION 'anuncio indisponivel'; END IF;
  IF l.seller_id = uid THEN RAISE EXCEPTION 'nao pode comprar seu proprio anuncio'; END IF;

  SELECT * INTO buyer FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'perfil nao encontrado'; END IF;

  IF l.currency = 'coins' THEN
    IF buyer.coins < l.price THEN RAISE EXCEPTION 'moedas insuficientes'; END IF;
  ELSIF l.currency = 'gems' THEN
    IF buyer.gems < l.price THEN RAISE EXCEPTION 'diamantes insuficientes'; END IF;
  ELSE
    RAISE EXCEPTION 'moeda invalida';
  END IF;

  PERFORM set_config('app.market_authorized', 'on', true);

  IF l.kind = 'monster' THEN
    IF NOT EXISTS (SELECT 1 FROM public.monsters WHERE id = l.monster_id AND owner_id = l.seller_id) THEN
      RAISE EXCEPTION 'pokemon nao esta mais disponivel';
    END IF;
    UPDATE public.monsters SET owner_id = uid, in_team = false, team_position = 0 WHERE id = l.monster_id;
  ELSIF l.kind = 'item' THEN
    INSERT INTO public.inventory(user_id, item_type, quantity)
    VALUES (uid, l.item_type, l.quantity)
    ON CONFLICT (user_id, item_type) DO UPDATE
      SET quantity = public.inventory.quantity + EXCLUDED.quantity;
  ELSIF l.kind = 'badge' THEN
    INSERT INTO public.gym_badges(user_id, gym_type)
    VALUES (uid, l.gym_type)
    ON CONFLICT (user_id, gym_type) DO NOTHING;
  ELSE
    RAISE EXCEPTION 'tipo de anuncio invalido';
  END IF;

  v_fee := GREATEST(1, ROUND(l.price * 0.03))::integer;
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

  RETURN jsonb_build_object(
    'ok', true,
    'fee', v_fee,
    'payout', v_payout,
    'kind', l.kind,
    'currency', l.currency,
    'price', l.price
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.market_buy(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.market_buy(uuid) TO authenticated;