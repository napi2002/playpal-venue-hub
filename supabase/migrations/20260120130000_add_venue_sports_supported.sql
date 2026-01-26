-- Add sports_supported list to venues for multi-sport selection.

alter table public.venues
  add column if not exists sports_supported text[] not null default '{}';
