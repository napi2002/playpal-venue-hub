-- Onboarding schema additions for venues, courts, and photos.

-- Enums
DO $$
BEGIN
  CREATE TYPE public.venue_status AS ENUM ('DRAFT', 'SUBMITTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.venue_type AS ENUM ('TENNIS', 'PADEL', 'BADMINTON', 'MULTI_SPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.sport_type AS ENUM ('TENNIS', 'PADEL', 'BADMINTON');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.environment_type AS ENUM ('INDOOR', 'OUTDOOR', 'COVERED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.photo_type AS ENUM ('COVER', 'ENTRANCE', 'FACILITY', 'COURT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Venues additions
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS name_th TEXT,
  ADD COLUMN IF NOT EXISTS venue_type public.venue_type,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS subdistrict TEXT,
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS postcode TEXT,
  ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
  ADD COLUMN IF NOT EXISTS opening_hours JSONB,
  ADD COLUMN IF NOT EXISTS default_slot_duration_mins INTEGER;

ALTER TABLE public.venues
  ALTER COLUMN status DROP DEFAULT;

UPDATE public.venues
SET status = 'DRAFT'
WHERE status IS NULL OR status NOT IN ('DRAFT', 'SUBMITTED');

ALTER TABLE public.venues
  ALTER COLUMN status TYPE public.venue_status USING status::public.venue_status;

ALTER TABLE public.venues
  ALTER COLUMN status SET DEFAULT 'DRAFT';

-- Courts additions
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS sport_type public.sport_type,
  ADD COLUMN IF NOT EXISTS environment public.environment_type,
  ADD COLUMN IF NOT EXISTS surface_type TEXT,
  ADD COLUMN IF NOT EXISTS has_lighting BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS weekday_price_per_hour_thb NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS weekend_price_per_hour_thb NUMERIC(10,2);

-- Photos table
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE,
  type public.photo_type NOT NULL,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view photos in their venues" ON public.photos;
DROP POLICY IF EXISTS "Users can manage photos in their venues" ON public.photos;

CREATE POLICY "Users can view photos in their venues"
  ON public.photos FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Users can manage photos in their venues"
  ON public.photos FOR ALL
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin') OR
    public.has_role(auth.uid(), venue_id, 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin') OR
    public.has_role(auth.uid(), venue_id, 'manager')
  );

CREATE INDEX IF NOT EXISTS photos_venue_id_idx ON public.photos(venue_id);
CREATE INDEX IF NOT EXISTS photos_court_id_idx ON public.photos(court_id);
