CREATE OR REPLACE FUNCTION public.admin_launch_reset()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bot RECORD;
  commons text[] := ARRAY['steamcub','emberleaf','sparkpup','cinderwisp','mossfin','stormtad','tidewraith','voltsprout','nightbloom','voidspark','magmaboulder','mudpaw','crystalsprite','fenix_azul','dragao_fogo','foca_glacial'];
  rares text[] := ARRAY['flarepup','aquakitty','leafox','voltbun','shadepup','rockpup','rato_bomba','lobo_artico','tartaruga_ancestral','corvo_sombras','lince_dourado','pterossauro'];
  sp1 text; sp2 text; sp3 text;
  st RECORD;
  bot_count int := 0;
  profile_count int;
  next_num int;
BEGIN
  -- 1) Zera ranking de todo mundo
  UPDATE public.profiles
    SET arena_points = 0, wins = 0, losses = 0;
  GET DIAGNOSTICS profile_count = ROW_COUNT;

  -- 2) Reset bots: apaga todos pets, dá 2 comuns + 1 raro novos
  FOR bot IN SELECT id FROM public.profiles WHERE is_bot = true LOOP
    DELETE FROM public.monsters WHERE owner_id = bot.id;

    sp1 := commons[1 + floor(random() * array_length(commons,1))::int];
    sp2 := commons[1 + floor(random() * array_length(commons,1))::int];
    sp3 := rares[1 + floor(random() * array_length(rares,1))::int];

    SELECT * INTO st FROM public._bot_species_stats(sp1);
    INSERT INTO public.monsters(owner_id, species, name, hp, atk, def, spd, in_team, team_position, rank)
    VALUES (bot.id, sp1, public._bot_species_name(sp1), st.hp, st.atk, st.def, st.spd, true, 0, 1);

    SELECT * INTO st FROM public._bot_species_stats(sp2);
    INSERT INTO public.monsters(owner_id, species, name, hp, atk, def, spd, in_team, team_position, rank)
    VALUES (bot.id, sp2, public._bot_species_name(sp2), st.hp, st.atk, st.def, st.spd, true, 1, 1);

    SELECT * INTO st FROM public._bot_species_stats(sp3);
    INSERT INTO public.monsters(owner_id, species, name, hp, atk, def, spd, in_team, team_position, rank)
    VALUES (bot.id, sp3, public._bot_species_name(sp3), st.hp, st.atk, st.def, st.spd, true, 2, 1);

    UPDATE public.profiles
      SET level = 1, xp = 0, coins = 3000, gems = 20
      WHERE id = bot.id;

    bot_count := bot_count + 1;
  END LOOP;

  -- 3) Encerra season ativa e cria a próxima (2 meses)
  UPDATE public.seasons SET status = 'finished', ended_at = now() WHERE status = 'active';
  SELECT COALESCE(MAX(number),0) + 1 INTO next_num FROM public.seasons;
  INSERT INTO public.seasons(number, started_at, ends_at, status)
  VALUES (next_num, now(), now() + interval '2 months', 'active');

  RETURN jsonb_build_object(
    'ok', true,
    'profiles_reset', profile_count,
    'bots_reset', bot_count,
    'new_season', next_num
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_launch_reset() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_launch_reset() TO service_role;