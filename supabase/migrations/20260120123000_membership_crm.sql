-- CRM membership schema for players and memberships.

create type membership_status as enum ('active', 'inactive', 'suspended');
create type membership_type_status as enum ('active', 'inactive');

create table public.players (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index players_unique_email
  on public.players (venue_id, lower(email))
  where email is not null;

create index players_venue_name_idx on public.players (venue_id, name);

create table public.membership_types (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  name text not null,
  description_public text,
  description_internal text,
  status membership_type_status not null default 'active',
  fixed_hourly_rate numeric(10, 2),
  percent_discount numeric(5, 2),
  early_booking_hours integer,
  auto_confirm boolean not null default false,
  allow_peak boolean not null default true,
  cancellation_window_hours integer,
  no_show_forgiveness boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_memberships (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  membership_type_id uuid not null references public.membership_types(id) on delete cascade,
  status membership_status not null default 'active',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index player_memberships_active_idx
  on public.player_memberships (player_id)
  where status = 'active';

create table public.player_notes (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  note text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists player_id uuid references public.players(id) on delete set null,
  add column if not exists membership_type_id uuid references public.membership_types(id) on delete set null,
  add column if not exists membership_type text,
  add column if not exists pricing_override_reason text,
  add column if not exists final_price numeric(10, 2);

create index if not exists bookings_player_id_idx on public.bookings (player_id);

-- Reuse existing update_updated_at_column trigger helper.
create trigger update_players_updated_at
  before update on public.players
  for each row
  execute function public.update_updated_at_column();

create trigger update_membership_types_updated_at
  before update on public.membership_types
  for each row
  execute function public.update_updated_at_column();

create trigger update_player_memberships_updated_at
  before update on public.player_memberships
  for each row
  execute function public.update_updated_at_column();

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
    on conflict (venue_id, lower(email)) do update
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

-- Enable RLS for CRM tables.
alter table public.players enable row level security;
alter table public.membership_types enable row level security;
alter table public.player_memberships enable row level security;
alter table public.player_notes enable row level security;

create policy "Allow authenticated users to view players"
  on public.players for select
  to authenticated
  using (true);

create policy "Allow authenticated users to insert players"
  on public.players for insert
  to authenticated
  with check (true);

create policy "Allow authenticated users to update players"
  on public.players for update
  to authenticated
  using (true);

create policy "Allow authenticated users to delete players"
  on public.players for delete
  to authenticated
  using (true);

create policy "Allow authenticated users to view membership types"
  on public.membership_types for select
  to authenticated
  using (true);

create policy "Allow authenticated users to insert membership types"
  on public.membership_types for insert
  to authenticated
  with check (true);

create policy "Allow authenticated users to update membership types"
  on public.membership_types for update
  to authenticated
  using (true);

create policy "Allow authenticated users to delete membership types"
  on public.membership_types for delete
  to authenticated
  using (true);

create policy "Allow authenticated users to view player memberships"
  on public.player_memberships for select
  to authenticated
  using (true);

create policy "Allow authenticated users to insert player memberships"
  on public.player_memberships for insert
  to authenticated
  with check (true);

create policy "Allow authenticated users to update player memberships"
  on public.player_memberships for update
  to authenticated
  using (true);

create policy "Allow authenticated users to delete player memberships"
  on public.player_memberships for delete
  to authenticated
  using (true);

create policy "Allow authenticated users to view player notes"
  on public.player_notes for select
  to authenticated
  using (true);

create policy "Allow authenticated users to insert player notes"
  on public.player_notes for insert
  to authenticated
  with check (true);

create policy "Allow authenticated users to delete player notes"
  on public.player_notes for delete
  to authenticated
  using (true);
