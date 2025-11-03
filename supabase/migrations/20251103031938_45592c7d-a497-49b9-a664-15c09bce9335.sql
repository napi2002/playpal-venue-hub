-- Update the update_updated_at_column function with proper security settings
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Update the generate_booking_number function with proper security settings
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_number TEXT;
  max_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(booking_number FROM 3)::INTEGER), 0) INTO max_number
  FROM public.bookings;
  
  new_number := 'BK' || LPAD((max_number + 1)::TEXT, 3, '0');
  RETURN new_number;
END;
$$;