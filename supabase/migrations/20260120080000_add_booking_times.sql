-- Add UTC start/end timestamps for availability calendar.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ;

-- Backfill using existing date/time/duration fields (assume Asia/Bangkok local time).
UPDATE public.bookings
SET
  slot_start = COALESCE(
    slot_start,
    (date + time) AT TIME ZONE 'Asia/Bangkok'
  ),
  slot_end = COALESCE(
    slot_end,
    COALESCE(slot_start, (date + time) AT TIME ZONE 'Asia/Bangkok')
      + make_interval(mins => COALESCE(duration_minutes, 60))
  )
WHERE slot_start IS NULL OR slot_end IS NULL;

CREATE INDEX IF NOT EXISTS bookings_venue_time_idx
  ON public.bookings (venue_id, start_at, end_at);

CREATE INDEX IF NOT EXISTS bookings_court_time_idx
  ON public.bookings (court_id, start_at, end_at);
