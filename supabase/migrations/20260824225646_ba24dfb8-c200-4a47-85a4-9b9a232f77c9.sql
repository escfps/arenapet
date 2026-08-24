-- FIX: guard triggers were SECURITY DEFINER, so current_user inside them was the
-- function owner (postgres) and is_client_role() always returned false, letting the
-- browser edit gems/coins/stats/inventory directly.

create or replace function public.is_client_role()
returns boolean
language sql
stable
set search_path to public
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    current_user
  ) in ('authenticated', 'anon')
$$;

create or replace function public.guard_profiles_client_write()
returns trigger
language plpgsql
security invoker
set search_path to public
as $function$
begin
  if not public.is_client_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Criação de perfil não permitida pelo cliente';
  end if;

  new.username := old.username;
  new.coins := old.coins;
  new.gems := old.gems;
  new.xp := old.xp;
  new.level := old.level;
  new.arena_points := old.arena_points;
  new.wins := old.wins;
  new.losses := old.losses;
  new.vip_until := old.vip_until;
  new.expedition_slots := old.expedition_slots;
  new.is_bot := old.is_bot;
  new.nick_changes := old.nick_changes;
  new.welcome_chest_claimed := old.welcome_chest_claimed;
  new.tutorial_reward_claimed := old.tutorial_reward_claimed;
  new.highest_tier_rank := old.highest_tier_rank;
  new.pity_silver := old.pity_silver;
  new.pity_gold := old.pity_gold;
  new.pity_legendary := old.pity_legendary;
  new.pity_mythic := old.pity_mythic;
  new.bp_subscription_id := old.bp_subscription_id;
  new.bp_customer_id := old.bp_customer_id;
  new.bp_status := old.bp_status;
  new.bp_started_at := old.bp_started_at;
  new.bp_last_claim_date := old.bp_last_claim_date;
  new.bp_days_claimed := old.bp_days_claimed;
  new.bp_silvers_given := old.bp_silvers_given;
  new.bp_monthly_claimed := old.bp_monthly_claimed;
  new.created_at := old.created_at;
  new.id := old.id;
  return new;
end;
$function$;

create or replace function public.guard_monsters_client_write()
returns trigger
language plpgsql
security invoker
set search_path to public
as $function$
begin
  if not public.is_client_role() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Criação de pokémon só pelo servidor';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Exclusão de pokémon só pelo servidor';
  end if;

  new.id := old.id;
  new.owner_id := old.owner_id;
  new.species := old.species;
  new.rank := old.rank;
  new.hp := old.hp;
  new.atk := old.atk;
  new.def := old.def;
  new.spd := old.spd;
  new.int := old.int;
  new.crit := old.crit;
  new.is_shiny := old.is_shiny;
  new.train_count := old.train_count;
  new.battle_energy := old.battle_energy;
  new.battle_energy_at := old.battle_energy_at;
  new.hunger := old.hunger;
  new.energy := old.energy;
  new.happiness := old.happiness;
  new.skin := old.skin;
  new.created_at := old.created_at;
  return new;
end;
$function$;

create or replace function public.guard_server_only_write()
returns trigger
language plpgsql
security invoker
set search_path to public
as $function$
begin
  if public.is_client_role() then
    raise exception 'Operação permitida somente pelo servidor';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop function if exists public.debug_who();