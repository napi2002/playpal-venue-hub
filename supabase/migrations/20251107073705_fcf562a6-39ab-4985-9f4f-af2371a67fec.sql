-- Create recurring bookings table
CREATE TABLE public.recurring_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID NOT NULL,
  court_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  time TIME WITHOUT TIME ZONE NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  sport TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_email TEXT NOT NULL,
  amount TEXT NOT NULL,
  status booking_status NOT NULL DEFAULT 'confirmed',
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on recurring bookings
ALTER TABLE public.recurring_bookings ENABLE ROW LEVEL SECURITY;

-- RLS policies for recurring bookings
CREATE POLICY "Users can view recurring bookings in their venue"
ON public.recurring_bookings
FOR SELECT
USING (venue_id = get_user_venue_id(auth.uid()));

CREATE POLICY "Staff can create recurring bookings"
ON public.recurring_bookings
FOR INSERT
WITH CHECK (venue_id = get_user_venue_id(auth.uid()));

CREATE POLICY "Staff can update recurring bookings"
ON public.recurring_bookings
FOR UPDATE
USING (venue_id = get_user_venue_id(auth.uid()));

CREATE POLICY "Managers can delete recurring bookings"
ON public.recurring_bookings
FOR DELETE
USING (
  venue_id = get_user_venue_id(auth.uid()) AND
  (has_role(auth.uid(), venue_id, 'owner') OR 
   has_role(auth.uid(), venue_id, 'admin') OR 
   has_role(auth.uid(), venue_id, 'manager'))
);

-- Add trigger for updated_at
CREATE TRIGGER update_recurring_bookings_updated_at
BEFORE UPDATE ON public.recurring_bookings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate bookings from recurring rules
CREATE OR REPLACE FUNCTION public.generate_bookings_from_recurring(
  _recurring_booking_id UUID,
  _weeks_ahead INTEGER DEFAULT 4
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec_booking RECORD;
  check_date DATE;
  end_generation_date DATE;
  bookings_created INTEGER := 0;
  new_booking_number TEXT;
BEGIN
  -- Get recurring booking details
  SELECT * INTO rec_booking
  FROM public.recurring_bookings
  WHERE id = _recurring_booking_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recurring booking not found';
  END IF;
  
  -- Calculate generation period
  check_date := GREATEST(rec_booking.start_date, CURRENT_DATE);
  end_generation_date := LEAST(
    CURRENT_DATE + (_weeks_ahead * 7),
    COALESCE(rec_booking.end_date, CURRENT_DATE + (_weeks_ahead * 7))
  );
  
  -- Loop through dates and create bookings
  WHILE check_date <= end_generation_date LOOP
    IF EXTRACT(DOW FROM check_date) = rec_booking.day_of_week THEN
      -- Check if booking already exists
      IF NOT EXISTS (
        SELECT 1 FROM public.bookings
        WHERE court_id = rec_booking.court_id
          AND date = check_date
          AND time = rec_booking.time
      ) THEN
        -- Generate new booking number
        new_booking_number := generate_booking_number();
        
        -- Insert new booking
        INSERT INTO public.bookings (
          venue_id,
          court_id,
          date,
          time,
          duration,
          sport,
          player_name,
          player_email,
          amount,
          status,
          payment_status,
          source,
          booking_number
        ) VALUES (
          rec_booking.venue_id,
          rec_booking.court_id,
          check_date,
          rec_booking.time,
          rec_booking.duration,
          rec_booking.sport,
          rec_booking.player_name,
          rec_booking.player_email,
          rec_booking.amount,
          rec_booking.status,
          'Pending',
          'Recurring',
          new_booking_number
        );
        
        bookings_created := bookings_created + 1;
      END IF;
    END IF;
    
    check_date := check_date + 1;
  END LOOP;
  
  RETURN bookings_created;
END;
$$;