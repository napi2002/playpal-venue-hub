-- Add UTC start/end timestamps for availability calendar.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Backfill using existing date/time/duration fields (assume Asia/Bangkok local time).
UPDATE public.bookings
SET
  start_at = COALESCE(
    start_at,
    (date + time) AT TIME ZONE 'Asia/Bangkok'
  ),
  end_at = COALESCE(
    end_at,
    COALESCE(start_at, (date + time) AT TIME ZONE 'Asia/Bangkok') + make_interval(mins => duration)
  )
WHERE start_at IS NULL OR end_at IS NULL;

CREATE INDEX IF NOT EXISTS bookings_venue_time_idx
  ON public.bookings (venue_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS bookings_court_time_idx
  ON public.bookings (court_id, start_at, end_at);
