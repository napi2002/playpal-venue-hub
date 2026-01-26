-- Prevent overlapping bookings per court (ignore cancelled).
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_start_end_check
  CHECK (start_at IS NULL OR end_at IS NULL OR start_at < end_at);

DROP INDEX IF EXISTS bookings_court_time_gist_idx;

CREATE INDEX bookings_court_time_gist_idx
  ON public.bookings
  USING gist (court_id, tstzrange(start_at, end_at, '[)'));

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    court_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  )
  WHERE (status <> 'cancelled');
