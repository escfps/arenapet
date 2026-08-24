do $$
declare d record; novo text; nome text;
begin
  for d in
    with team as (
      select m.id, m.owner_id, m.species, m.is_shiny,
             row_number() over (partition by m.owner_id, m.species, m.is_shiny order by m.team_position) rn
      from public.monsters m join public.profiles p on p.id=m.owner_id
      where m.in_team = true and p.is_bot = true
    )
    select * from team where rn > 1
  loop
    select s.id into novo
    from public.species_ref s
    join public.species_types t on t.id = s.id
    where t.retired = false
      and s.rarity = (select rarity from public.species_ref where id = d.species)
      and not exists (
        select 1 from public.monsters m2
        where m2.owner_id = d.owner_id and m2.in_team = true
          and m2.species = s.id and m2.is_shiny = d.is_shiny
      )
    order by random() limit 1;

    if novo is not null then
      select name into nome from public.species_ref where id = novo;
      update public.monsters
        set species = novo,
            name = nome,
            hp = (select hp from public.species_ref where id = novo),
            atk = (select atk from public.species_ref where id = novo),
            def = (select def from public.species_ref where id = novo),
            spd = (select spd from public.species_ref where id = novo)
      where id = d.id;
      perform public._bot_apply_star_stats(d.id);
    end if;
  end loop;
end $$;