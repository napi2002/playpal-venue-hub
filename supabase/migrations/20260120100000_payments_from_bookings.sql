-- Create/maintain payments when bookings are confirmed/paid.

ALTER TABLE public.payments
  ALTER COLUMN currency SET DEFAULT 'THB';

DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS payments_booking_id_key ON public.payments(booking_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.upsert_payment_for_booking()
RETURNS TRIGGER AS $$
DECLARE
  normalized_amount NUMERIC(10,2);
  payment_status TEXT;
BEGIN
  IF NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  payment_status := CASE
    WHEN NEW.status IN ('paid', 'confirmed') OR (NEW.payment_status ILIKE 'paid')
      THEN 'COMPLETED'
    ELSE 'PENDING'
  END;

  normalized_amount := COALESCE(
    NULLIF(regexp_replace(COALESCE(NEW.amount::text, ''), '[^0-9\\.]', '', 'g'), '')::numeric,
    0
  );

  INSERT INTO public.payments (
    venue_id,
    booking_id,
    amount,
    currency,
    status,
    payment_method,
    paid_at
  ) VALUES (
    NEW.venue_id,
    NEW.id,
    normalized_amount,
    'THB',
    payment_status,
    CASE WHEN NEW.payment_status ILIKE 'paid' THEN 'Manual' ELSE NULL END,
    CASE WHEN payment_status = 'COMPLETED' THEN now() ELSE NULL END
  )
  ON CONFLICT (booking_id) DO UPDATE
    SET amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        status = EXCLUDED.status,
        payment_method = EXCLUDED.payment_method,
        paid_at = EXCLUDED.paid_at,
        updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bookings_upsert_payment ON public.bookings;

CREATE TRIGGER bookings_upsert_payment
AFTER INSERT OR UPDATE OF status, payment_status, amount ON public.bookings
FOR EACH ROW
WHEN (NEW.status IN ('confirmed','paid') OR NEW.payment_status ILIKE 'paid')
EXECUTE FUNCTION public.upsert_payment_for_booking();

-- Backfill payments for existing confirmed/paid bookings without payments.
INSERT INTO public.payments (
  venue_id,
  booking_id,
  amount,
  currency,
  status,
  payment_method,
  paid_at
)
SELECT
  b.venue_id,
  b.id,
  COALESCE(
    NULLIF(regexp_replace(COALESCE(b.amount::text, ''), '[^0-9\\.]', '', 'g'), '')::numeric,
    0
  ) AS amount,
  'THB',
  'COMPLETED',
  CASE WHEN b.payment_status ILIKE 'paid' THEN 'Manual' ELSE NULL END,
  now()
FROM public.bookings b
LEFT JOIN public.payments p ON p.booking_id = b.id
WHERE p.id IS NULL
  AND (b.status IN ('confirmed','paid') OR b.payment_status ILIKE 'paid');
