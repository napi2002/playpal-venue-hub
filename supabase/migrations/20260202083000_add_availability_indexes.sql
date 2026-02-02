create index if not exists venues_owner_created_idx
  on public.venues (owner_id, created_at desc);

create index if not exists courts_venue_id_idx
  on public.courts (venue_id);

create index if not exists recurring_bookings_venue_id_idx
  on public.recurring_bookings (venue_id);

create index if not exists bookings_venue_slot_start_idx
  on public.bookings (venue_id, slot_start);

create index if not exists bookings_venue_slot_end_idx
  on public.bookings (venue_id, slot_end);

create index if not exists bookings_court_id_idx
  on public.bookings (court_id);

create index if not exists payments_venue_id_idx
  on public.payments (venue_id);
