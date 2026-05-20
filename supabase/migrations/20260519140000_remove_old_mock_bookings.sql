-- Remove the 30 old mock bookings (BK846201–BK846230) added by the previous seed.
-- The 20260519130000 demo data migration already provides clean, richer data.

delete from public.payments
where booking_id in (
  select id from public.bookings
  where booking_number like 'BK8462%'
);

delete from public.bookings
where booking_number like 'BK8462%';
