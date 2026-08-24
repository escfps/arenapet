do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like '\_bot\_%'
        or p.proname like '\_season\_%'
        or p.proname like '\_tour\_%'
        or p.proname in ('tournaments_tick','seasons_tick','simulate_bot_battles','simulate_bot_gyms',
                         'train_bot_pets','ensure_tournament','advance_tournament_round',
                         'close_tournament_registration','report_match_result','end_season',
                         'apply_arena_defender_result','cleanup_battles','admin_launch_reset',
                         'guard_profiles_client_write','guard_monsters_client_write',
                         'guard_server_only_write','guard_trade_monster_not_listed',
                         'battles_cap_trigger','handle_new_user','update_updated_at'))
  loop
    execute format('revoke all on function %s from anon, authenticated, public', r.sig);
  end loop;
end $$;