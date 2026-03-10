alter table public.court_portal_accounts
  drop constraint if exists court_portal_accounts_court_id_key;

alter table public.court_portal_accounts
  drop constraint if exists court_portal_accounts_venue_court_unique;

alter table public.court_portal_accounts
  alter column court_id drop not null;

alter table public.court_portal_accounts
  add column if not exists months_paid integer not null default 0;

create index if not exists court_portal_accounts_active_venue_idx
  on public.court_portal_accounts (venue_id, is_active, created_at desc);
