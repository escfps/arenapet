CREATE OR REPLACE FUNCTION public.train_bot_pets()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  bot RECORD;
  pull_chance numeric;
  chest_rarity text;
  pet RECORD;
  stat_choice int;
  gain int;
  cost_coins int;
  trains_left int;
  cur_gems int;
  cur_coins int;
BEGIN
  FOR bot IN
    SELECT id, arena_points, coins, gems FROM public.profiles
    WHERE is_bot = true ORDER BY random() LIMIT 500
  LOOP
    -- 1) Chance de "abrir baú" e puxar carta
    pull_chance := LEAST(0.5, 0.10 + (COALESCE(bot.arena_points, 0)::numeric / 6000.0));
    IF random() < pull_chance THEN
      chest_rarity := public._bot_pick_chest_rarity(COALESCE(bot.arena_points, 0));
      PERFORM public._bot_pull_card(bot.id, chest_rarity);
    END IF;

    -- 2) Treina stats dos pets do time gastando moedas + 2 diamantes (igual ao jogador)
    cur_gems := COALESCE(bot.gems, 0);
    cur_coins := COALESCE(bot.coins, 0);
    -- 1 a 3 treinos por tick, dependendo de quanto recurso o bot tem
    trains_left := LEAST(3, GREATEST(0, cur_gems / 6));
    IF trains_left > 0 AND random() < 0.5 THEN
      FOR i IN 1..trains_left LOOP
        SELECT id, rank, atk, def, spd, hp, "int" INTO pet
        FROM public.monsters
        WHERE owner_id = bot.id AND in_team = true
        ORDER BY random() LIMIT 1;

        EXIT WHEN pet.id IS NULL;
        cost_coins := 20 + COALESCE(pet.rank, 1) * 10;
        EXIT WHEN cur_gems < 2 OR cur_coins < cost_coins;

        stat_choice := 1 + floor(random() * 5)::int; -- 1=atk 2=def 3=spd 4=hp 5=int
        IF stat_choice = 4 THEN
          gain := 3 + floor(random() * 3)::int;
          UPDATE public.monsters SET hp = COALESCE(hp,0) + gain WHERE id = pet.id;
        ELSIF stat_choice = 1 THEN
          gain := 1 + floor(random() * 2)::int;
          UPDATE public.monsters SET atk = COALESCE(atk,0) + gain WHERE id = pet.id;
        ELSIF stat_choice = 2 THEN
          gain := 1 + floor(random() * 2)::int;
          UPDATE public.monsters SET def = COALESCE(def,0) + gain WHERE id = pet.id;
        ELSIF stat_choice = 3 THEN
          gain := 1 + floor(random() * 2)::int;
          UPDATE public.monsters SET spd = COALESCE(spd,0) + gain WHERE id = pet.id;
        ELSE
          gain := 1 + floor(random() * 2)::int;
          UPDATE public.monsters SET "int" = COALESCE("int",0) + gain WHERE id = pet.id;
        END IF;

        cur_gems := cur_gems - 2;
        cur_coins := cur_coins - cost_coins;
      END LOOP;

      UPDATE public.profiles
        SET gems = cur_gems, coins = cur_coins
        WHERE id = bot.id;
    END IF;
  END LOOP;
END;
$function$;