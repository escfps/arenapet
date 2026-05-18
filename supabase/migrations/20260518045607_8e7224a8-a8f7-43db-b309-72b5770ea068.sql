
DO $$
DECLARE
  bot RECORD;
  new_id uuid;
BEGIN
  FOR bot IN SELECT * FROM (VALUES
    ('BotRex',1),('BotLuna',2),('BotKira',2),('BotZeus',3),('BotNova',1),
    ('BotMago',3),('BotTanky',2),('BotSpeedy',1),('BotShadow',4),('BotPyro',2)
  ) AS t(username,lvl)
  LOOP
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username = bot.username) THEN
      CONTINUE;
    END IF;

    new_id := gen_random_uuid();

    INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous)
    VALUES (new_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', lower(bot.username)||'@bot.local', '', now(), now(), now(), '{"provider":"bot"}'::jsonb, jsonb_build_object('username',bot.username), false, false);

    -- handle_new_user trigger may create profile/monster; ensure clean state then override
    DELETE FROM public.monsters WHERE owner_id = new_id;
    DELETE FROM public.profiles WHERE id = new_id;

    INSERT INTO public.profiles (id, username, level, coins, gems, xp, wins, losses)
    VALUES (new_id, bot.username, bot.lvl, 500, 10, 0, floor(random()*20)::int, floor(random()*10)::int);

    INSERT INTO public.monsters (owner_id, species, name, in_team, rank, hp, atk, def, spd, "int") VALUES
      (new_id,'flarepup','Flarezito',true,2,60,18,10,14,9),
      (new_id,'aquakitty','Aquinha',true,2,65,11,13,15,24),
      (new_id,'leafox','Folhinha',true,2,90,10,22,10,10),
      (new_id,'voltbun','Voltico',true,2,52,15,10,21,8);
  END LOOP;
END $$;
