create type public.court_plan as enum ('free', 'pro', 'custom');

alter type public.user_role rename to user_role_old;
create type public.user_role as enum ('user', 'admin', 'internal');

alter table public.users
  alter column role drop default,
  alter column role type public.user_role
  using role::text::public.user_role;

alter table public.users
  alter column role set default 'user';

drop type public.user_role_old;

create table public.court_portal_accounts (
  id integer primary key generated always as identity,
  user_id integer not null unique references public.users(id) on delete cascade,
  venue_id integer not null references public.venues(id) on delete cascade,
  court_id integer not null unique references public.courts(id) on delete cascade,
  username text not null unique,
  login_email text not null unique,
  plan public.court_plan not null default 'free',
  plan_notes text,
  invited_by integer references public.users(id),
  invite_sent_at timestamptz,
  password_reset_sent_at timestamptz,
  last_activated_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint court_portal_accounts_venue_court_unique unique (venue_id, court_id)
);

create index court_portal_accounts_venue_id_idx
  on public.court_portal_accounts (venue_id);

create index court_portal_accounts_plan_idx
  on public.court_portal_accounts (plan);

create trigger update_court_portal_accounts_updated_at before update on public.court_portal_accounts
  for each row execute function public.update_updated_at_column();
