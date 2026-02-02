-- Drop existing public tables and rebuild schema for new model.
-- This migration is destructive.

drop table if exists public.player_notes cascade;
drop table if exists public.player_memberships cascade;
drop table if exists public.membership_types cascade;
drop table if exists public.players cascade;
drop table if exists public.photos cascade;
drop table if exists public.recurring_bookings cascade;
drop table if exists public.payments cascade;
drop table if exists public.bookings cascade;
drop table if exists public.availability cascade;
drop table if exists public.courts cascade;
drop table if exists public.venues cascade;
drop table if exists public.community cascade;
drop table if exists public.users cascade;
drop table if exists public.user_roles cascade;

drop type if exists public.membership_status cascade;
drop type if exists public.membership_type_status cascade;
drop type if exists public.payment_status cascade;
drop type if exists public.booking_status cascade;
drop type if exists public.user_role cascade;
drop type if exists public.venue_status cascade;

create type public.user_role as enum ('user', 'admin');
create type public.booking_status as enum ('pending', 'confirmed', 'paid', 'cancelled', 'held');
create type public.payment_status as enum ('pending', 'completed', 'failed', 'refunded');
create type public.membership_status as enum ('active', 'inactive', 'suspended');
create type public.membership_type_status as enum ('active', 'inactive');
create type public.venue_status as enum ('DRAFT', 'SUBMITTED');

create table public.users (
  id integer primary key generated always as identity,
  email text not null unique,
  role public.user_role not null default 'user',
  full_name text,
  phone_number text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  date_of_birth text,
  location text,
  interests jsonb,
  profile_completed boolean not null default false,
  username text unique,
  auth_id uuid unique references auth.users(id)
);

create table public.venues (
  id integer primary key generated always as identity,
  name text not null,
  address text,
  city text,
  state text,
  country text not null default 'Thailand',
  postal_code text,
  owner_id integer references public.users(id),
  email text,
  phone text,
  description text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  name_en text,
  name_th text,
  venue_type text,
  address_line1 text,
  subdistrict text,
  district text,
  province text,
  postcode text,
  google_maps_url text,
  opening_hours jsonb,
  default_slot_duration_mins integer,
  status public.venue_status not null default 'DRAFT',
  timezone text,
  tax_information text,
  sports_supported text[] not null default '{}'
);

create table public.courts (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id) on delete cascade,
  name text not null,
  sport_type text,
  capacity integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  amenities json,
  status text not null default 'active',
  environment text,
  surface_type text,
  has_lighting boolean not null default false,
  weekday_price_per_hour_thb numeric(10,2),
  weekend_price_per_hour_thb numeric(10,2),
  peak_price numeric(10,2),
  off_peak_price numeric(10,2),
  buffer_minutes integer not null default 15,
  sport text
);

create table public.availability (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id),
  court_id integer references public.courts(id),
  slot_date date not null,
  start_time time not null,
  end_time time not null,
  status text check (status in ('available', 'booked')),
  price numeric not null,
  currency text not null,
  is_peak boolean default false,
  source text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.players (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index players_venue_email_unique
  on public.players (venue_id, email);

create table public.membership_types (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id) on delete cascade,
  name text not null,
  description_public text,
  description_internal text,
  status public.membership_type_status not null default 'active',
  fixed_hourly_rate numeric(10,2),
  percent_discount numeric(5,2),
  early_booking_hours integer,
  auto_confirm boolean not null default false,
  allow_peak boolean not null default true,
  cancellation_window_hours integer,
  no_show_forgiveness boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_memberships (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id) on delete cascade,
  player_id integer references public.players(id) on delete cascade,
  membership_type_id integer references public.membership_types(id) on delete cascade,
  status public.membership_status not null default 'active',
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index player_memberships_active_idx
  on public.player_memberships (player_id)
  where status = 'active';

create table public.player_notes (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id) on delete cascade,
  player_id integer references public.players(id) on delete cascade,
  note text not null,
  created_by integer references public.users(id),
  created_at timestamptz not null default now()
);

create table public.bookings (
  id integer primary key generated always as identity,
  user_id integer references public.users(id),
  court_id integer references public.courts(id),
  venue_id integer references public.venues(id),
  slot_start timestamptz not null,
  slot_end timestamptz not null,
  duration_minutes integer,
  status public.booking_status,
  cancellation_reason text,
  cancellation_timestamp timestamptz,
  total_price numeric not null,
  currency text not null default 'THB',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  booking_number text unique,
  player_name text,
  player_email text,
  source text,
  payment_status text,
  player_id integer references public.players(id) on delete set null,
  membership_type_id integer references public.membership_types(id) on delete set null,
  membership_type text,
  pricing_override_reason text,
  final_price numeric,
  start_at timestamptz generated always as (slot_start) stored,
  end_at timestamptz generated always as (slot_end) stored,
  date date,
  time time
);

create table public.payments (
  id integer primary key generated always as identity,
  user_id integer references public.users(id),
  booking_id integer references public.bookings(id),
  venue_id integer references public.venues(id),
  amount numeric not null,
  currency text not null default 'THB',
  payment_method text,
  status public.payment_status,
  transaction_id text,
  transaction_date timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.photos (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id) on delete cascade,
  court_id integer references public.courts(id) on delete cascade,
  type text not null,
  url text not null,
  created_at timestamptz not null default now()
);

create table public.recurring_bookings (
  id integer primary key generated always as identity,
  venue_id integer references public.venues(id) on delete cascade,
  court_id integer references public.courts(id) on delete cascade,
  day_of_week integer not null,
  time time not null,
  duration integer not null default 60,
  player_name text not null,
  player_email text,
  status text not null default 'active',
  start_date date not null,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_users_updated_at before update on public.users
  for each row execute function public.update_updated_at_column();
create trigger update_venues_updated_at before update on public.venues
  for each row execute function public.update_updated_at_column();
create trigger update_courts_updated_at before update on public.courts
  for each row execute function public.update_updated_at_column();
create trigger update_bookings_updated_at before update on public.bookings
  for each row execute function public.update_updated_at_column();
create trigger update_payments_updated_at before update on public.payments
  for each row execute function public.update_updated_at_column();
create trigger update_players_updated_at before update on public.players
  for each row execute function public.update_updated_at_column();
create trigger update_membership_types_updated_at before update on public.membership_types
  for each row execute function public.update_updated_at_column();
create trigger update_player_memberships_updated_at before update on public.player_memberships
  for each row execute function public.update_updated_at_column();
create trigger update_recurring_bookings_updated_at before update on public.recurring_bookings
  for each row execute function public.update_updated_at_column();

create or replace function public.sync_booking_date_time()
returns trigger as $$
begin
  new.date := (new.slot_start at time zone 'Asia/Bangkok')::date;
  new.time := (new.slot_start at time zone 'Asia/Bangkok')::time;
  return new;
end;
$$ language plpgsql;

drop trigger if exists sync_booking_date_time on public.bookings;
create trigger sync_booking_date_time
  before insert or update of slot_start on public.bookings
  for each row
  execute function public.sync_booking_date_time();

create or replace function public.handle_booking_membership()
returns trigger as $$
declare
  v_player_id integer;
  v_membership record;
  v_base_amount numeric;
  v_booking_date date;
begin
  v_booking_date := (new.slot_start at time zone 'Asia/Bangkok')::date;

  if new.player_email is not null and new.player_email <> '' and new.player_email <> 'no-email@playpal.local' then
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
    v_base_amount := new.total_price::numeric;
  exception when others then
    v_base_amount := 0;
  end;

  if v_membership.membership_type_id is not null then
    new.membership_type_id := v_membership.membership_type_id;
    new.membership_type := v_membership.membership_name;

    if v_membership.fixed_hourly_rate is not null then
      new.final_price := round((v_membership.fixed_hourly_rate * new.duration_minutes / 60.0)::numeric, 2);
      new.pricing_override_reason := 'Fixed rate override';
    elsif v_membership.percent_discount is not null then
      new.final_price := round((v_base_amount * (1 - v_membership.percent_discount / 100.0))::numeric, 2);
      new.pricing_override_reason := 'Membership discount';
    else
      new.final_price := v_base_amount;
      new.pricing_override_reason := 'Membership applied';
    end if;

    new.total_price := new.final_price;

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
  before insert or update of player_name, player_email, total_price, duration_minutes, slot_start, slot_end, status
  on public.bookings
  for each row
  execute function public.handle_booking_membership();
