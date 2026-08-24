-- Defesa em profundidade: cliente anônimo nunca escreve nada
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname='public' loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon', t.tablename);
  end loop;
end $$;

-- Tabelas exclusivamente do servidor: cliente logado só pode ler
do $$
declare t text;
begin
  foreach t in array array[
    'battle_sessions','battles','expeditions','friend_challenges','friend_gifts','friend_messages',
    'friendships','gem_purchases','gym_badges','gyms','iap_transactions','market_listings',
    'player_gifts','redeem_codes','redeem_code_uses','season_trophies','seasons','skins_owned',
    'species_ref','species_types','tournament_champions','tournament_entries','tournament_matches',
    'tournaments','trades','inventory'
  ] loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from authenticated', t);
  end loop;
end $$;