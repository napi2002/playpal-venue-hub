-- Fix ON CONFLICT inference for player email by using a direct unique constraint.

drop index if exists public.players_unique_email;

alter table public.players
  drop constraint if exists players_unique_email;

alter table public.players
  add constraint players_unique_email unique (venue_id, email);

create or replace function public.handle_booking_membership()
returns trigger as $$
declare
  v_player_id uuid;
  v_membership record;
  v_base_amount numeric;
  v_booking_date date;
begin
  v_booking_date := coalesce(
    new.date,
    (new.start_at at time zone 'Asia/Bangkok')::date
  );

  if new.player_email is not null
    and new.player_email <> ''
    and new.player_email <> 'no-email@playpal.local' then
    insert into public.players (venue_id, name, email)
    values (new.venue_id, new.player_name, lower(new.player_email))
    on conflict (venue_id, email) do update
      set name = excluded.name,
          updated_at = now()
    returning id into v_player_id;
  else
    select id into v_player_id
    from public.players
    where venue_id = new.venue_id
      and name = new.player_name
    order by created_at asc
    limit 1;

    if v_player_id is null then
      insert into public.players (venue_id, name)
      values (new.venue_id, new.player_name)
      returning id into v_player_id;
    end if;
  end if;

  new.player_id := v_player_id;

  select
    pm.id as membership_id,
    mt.id as membership_type_id,
    mt.name as membership_name,
    mt.fixed_hourly_rate,
    mt.percent_discount,
    mt.auto_confirm
  into v_membership
  from public.player_memberships pm
  join public.membership_types mt on mt.id = pm.membership_type_id
  where pm.player_id = v_player_id
    and pm.status = 'active'
    and (pm.start_date is null or pm.start_date <= v_booking_date)
    and (pm.end_date is null or pm.end_date >= v_booking_date)
    and mt.status = 'active'
  order by pm.created_at desc
  limit 1;

  begin
    v_base_amount := nullif(new.amount, '')::numeric;
  exception when others then
    v_base_amount := 0;
  end;

  if v_membership.membership_type_id is not null then
    new.membership_type_id := v_membership.membership_type_id;
    new.membership_type := v_membership.membership_name;

    if v_membership.fixed_hourly_rate is not null then
      new.final_price := round((v_membership.fixed_hourly_rate * new.duration / 60.0)::numeric, 2);
      new.pricing_override_reason := 'Fixed rate override';
    elsif v_membership.percent_discount is not null then
      new.final_price := round((v_base_amount * (1 - v_membership.percent_discount / 100.0))::numeric, 2);
      new.pricing_override_reason := 'Membership discount';
    else
      new.final_price := v_base_amount;
      new.pricing_override_reason := 'Membership applied';
    end if;

    new.amount := new.final_price::text;

    if v_membership.auto_confirm is true and new.status = 'pending' then
      new.status := 'confirmed';
    end if;
  else
    new.final_price := v_base_amount;
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists handle_booking_membership on public.bookings;
create trigger handle_booking_membership
  before insert or update of player_name, player_email, amount, duration, date, start_at, end_at, status
  on public.bookings
  for each row
  execute function public.handle_booking_membership();
