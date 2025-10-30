-- Create enum for booking status
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'paid', 'cancelled', 'held');

-- Create courts table
CREATE TABLE public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sport TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  peak_price NUMERIC(10, 2) NOT NULL,
  off_peak_price NUMERIC(10, 2) NOT NULL,
  buffer_minutes INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create bookings table
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_number TEXT UNIQUE NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE NOT NULL,
  sport TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_email TEXT NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  source TEXT NOT NULL,
  amount TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for courts (allow all authenticated users to read/write for now)
CREATE POLICY "Allow authenticated users to view courts"
  ON public.courts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert courts"
  ON public.courts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update courts"
  ON public.courts FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for bookings (allow all authenticated users to read/write for now)
CREATE POLICY "Allow authenticated users to view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert bookings"
  ON public.bookings FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to delete bookings"
  ON public.bookings FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample courts
INSERT INTO public.courts (name, sport, status, peak_price, off_peak_price, buffer_minutes)
VALUES 
  ('Court 1', 'Tennis', 'active', 800, 600, 15),
  ('Court 2', 'Badminton', 'active', 600, 450, 15),
  ('Court 3', 'Tennis', 'active', 800, 600, 15),
  ('Court 4', 'Pickleball', 'active', 500, 400, 10);

-- Create function to generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
  new_number TEXT;
  max_number INTEGER;
BEGIN
  SELECT COALESCE(MAX(SUBSTRING(booking_number FROM 3)::INTEGER), 0) INTO max_number
  FROM public.bookings;
  
  new_number := 'BK' || LPAD((max_number + 1)::TEXT, 3, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;