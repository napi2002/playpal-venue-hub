-- Fix venue status type casting after migration failure.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'status'
      AND udt_name <> 'venue_status'
  ) THEN
    ALTER TABLE public.venues
      ALTER COLUMN status DROP DEFAULT;

    ALTER TABLE public.venues
      ALTER COLUMN status TYPE public.venue_status
      USING (
        CASE
          WHEN status IN ('DRAFT', 'SUBMITTED') THEN status
          WHEN status IN ('active', 'inactive') THEN 'DRAFT'
          ELSE 'DRAFT'
        END
      )::public.venue_status;

    ALTER TABLE public.venues
      ALTER COLUMN status SET DEFAULT 'DRAFT';
  END IF;
END $$;
