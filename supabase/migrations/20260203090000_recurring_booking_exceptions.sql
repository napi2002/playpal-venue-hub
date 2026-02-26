create table if not exists public.recurring_booking_exceptions (
  id integer primary key generated always as identity,
  venue_id integer not null references public.venues(id) on delete cascade,
  recurring_booking_id integer not null references public.recurring_bookings(id) on delete cascade,
  occurrence_date date not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (recurring_booking_id, occurrence_date)
);

create index if not exists recurring_booking_exceptions_venue_date_idx
  on public.recurring_booking_exceptions (venue_id, occurrence_date);
