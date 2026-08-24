-- Helper: is the current request coming straight from a player's browser?
create or replace function public.is_client_role()
returns boolean
language sql
stable
set search_path = public
as $$
  select current_user in ('authenticated', 'anon')
$$;

-- ============ PROFILES ============
create or replace function public.guard_profiles_client_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_client_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    raise exception 'Criação de perfil não permitida pelo cliente';
  end if;

  -- Client may only touch presence fields; everything else must come from the server.
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
$$;

drop trigger if exists guard_profiles_client_write_upd on public.profiles;
create trigger guard_profiles_client_write_upd
  before update on public.profiles
  for each row execute function public.guard_profiles_client_write();

drop trigger if exists guard_profiles_client_write_ins on public.profiles;
create trigger guard_profiles_client_write_ins
  before insert on public.profiles
  for each row execute function public.guard_profiles_client_write();

-- ============ MONSTERS ============
create or replace function public.guard_monsters_client_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  -- Client may only reorder/rename its team; all stats come from the server.
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
$$;

drop trigger if exists guard_monsters_client_write_ins on public.monsters;
create trigger guard_monsters_client_write_ins
  before insert on public.monsters
  for each row execute function public.guard_monsters_client_write();

drop trigger if exists guard_monsters_client_write_upd on public.monsters;
create trigger guard_monsters_client_write_upd
  before update on public.monsters
  for each row execute function public.guard_monsters_client_write();

drop trigger if exists guard_monsters_client_write_del on public.monsters;
create trigger guard_monsters_client_write_del
  before delete on public.monsters
  for each row execute function public.guard_monsters_client_write();

-- ============ Generic "server only writes" guard ============
create or replace function public.guard_server_only_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_client_role() then
    raise exception 'Operação permitida somente pelo servidor';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists guard_inventory_server_only on public.inventory;
create trigger guard_inventory_server_only
  before insert or update or delete on public.inventory
  for each row execute function public.guard_server_only_write();

drop trigger if exists guard_skins_owned_server_only on public.skins_owned;
create trigger guard_skins_owned_server_only
  before insert or update or delete on public.skins_owned
  for each row execute function public.guard_server_only_write();

drop trigger if exists guard_expeditions_server_only on public.expeditions;
create trigger guard_expeditions_server_only
  before insert or update or delete on public.expeditions
  for each row execute function public.guard_server_only_write();

drop trigger if exists guard_battles_server_only on public.battles;
create trigger guard_battles_server_only
  before insert or update or delete on public.battles
  for each row execute function public.guard_server_only_write();

-- ============ Battle sessions (server-authoritative match results) ============
create table if not exists public.battle_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null,
  opponent_id uuid,
  gym_type text,
  winner text not null,
  payload jsonb not null default '{}'::jsonb,
  applied boolean not null default false,
  created_at timestamp with time zone not null default now()
);

grant all on public.battle_sessions to service_role;
alter table public.battle_sessions enable row level security;

create index if not exists battle_sessions_user_idx
  on public.battle_sessions (user_id, created_at desc);
