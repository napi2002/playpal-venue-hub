-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'manager', 'staff');

-- Create venues table (main tenant entity)
CREATE TABLE public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user profiles table
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(id, venue_id)
);

-- Create user_roles table for proper role management
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, venue_id, role)
);

-- Add venue_id to existing courts table
ALTER TABLE public.courts ADD COLUMN venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE;

-- Add venue_id to existing bookings table
ALTER TABLE public.bookings ADD COLUMN venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE;

-- Create availability_rules table
CREATE TABLE public.availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  court_id UUID REFERENCES public.courts(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  rule_type TEXT DEFAULT 'regular',
  specific_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create venue_settings table
CREATE TABLE public.venue_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL UNIQUE,
  booking_buffer_minutes INTEGER DEFAULT 15,
  min_booking_notice_hours INTEGER DEFAULT 1,
  max_booking_advance_days INTEGER DEFAULT 30,
  cancellation_policy TEXT,
  terms_and_conditions TEXT,
  auto_confirm_bookings BOOLEAN DEFAULT false,
  require_payment_upfront BOOLEAN DEFAULT false,
  logo_url TEXT,
  theme_color TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create integrations table
CREATE TABLE public.integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  integration_type TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT false,
  config JSONB,
  credentials_encrypted TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(venue_id, integration_type)
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  payment_method TEXT,
  payment_provider TEXT,
  transaction_id TEXT,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_amount DECIMAL(10,2),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_settings table
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE NOT NULL,
  notification_email BOOLEAN DEFAULT true,
  notification_sms BOOLEAN DEFAULT false,
  notification_push BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  time_format TEXT DEFAULT '12h',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, venue_id)
);

-- Enable RLS on all new tables
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venue_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _venue_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND venue_id = _venue_id
      AND role = _role
  )
$$;

-- Create security definer function to get user's venue
CREATE OR REPLACE FUNCTION public.get_user_venue_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT venue_id
  FROM public.user_profiles
  WHERE id = _user_id
  LIMIT 1
$$;

-- RLS Policies for venues
CREATE POLICY "Users can view their own venue"
  ON public.venues FOR SELECT
  USING (id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Venue owners can update their venue"
  ON public.venues FOR UPDATE
  USING (public.has_role(auth.uid(), id, 'owner'));

-- RLS Policies for user_profiles
CREATE POLICY "Users can view profiles in their venue"
  ON public.user_profiles FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- RLS Policies for user_roles
CREATE POLICY "Users can view roles in their venue"
  ON public.user_roles FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Owners and admins can manage roles"
  ON public.user_roles FOR ALL
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR 
    public.has_role(auth.uid(), venue_id, 'admin')
  );

-- Update RLS Policies for courts
DROP POLICY IF EXISTS "Allow authenticated users to view courts" ON public.courts;
DROP POLICY IF EXISTS "Allow authenticated users to insert courts" ON public.courts;
DROP POLICY IF EXISTS "Allow authenticated users to update courts" ON public.courts;

CREATE POLICY "Users can view courts in their venue"
  ON public.courts FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Managers can create courts"
  ON public.courts FOR INSERT
  WITH CHECK (
    venue_id = public.get_user_venue_id(auth.uid()) AND
    (public.has_role(auth.uid(), venue_id, 'owner') OR 
     public.has_role(auth.uid(), venue_id, 'admin') OR
     public.has_role(auth.uid(), venue_id, 'manager'))
  );

CREATE POLICY "Managers can update courts"
  ON public.courts FOR UPDATE
  USING (
    venue_id = public.get_user_venue_id(auth.uid()) AND
    (public.has_role(auth.uid(), venue_id, 'owner') OR 
     public.has_role(auth.uid(), venue_id, 'admin') OR
     public.has_role(auth.uid(), venue_id, 'manager'))
  );

-- Update RLS Policies for bookings
DROP POLICY IF EXISTS "Allow authenticated users to view bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow authenticated users to insert bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow authenticated users to update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Allow authenticated users to delete bookings" ON public.bookings;

CREATE POLICY "Users can view bookings in their venue"
  ON public.bookings FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Staff can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Staff can update bookings"
  ON public.bookings FOR UPDATE
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Managers can delete bookings"
  ON public.bookings FOR DELETE
  USING (
    venue_id = public.get_user_venue_id(auth.uid()) AND
    (public.has_role(auth.uid(), venue_id, 'owner') OR 
     public.has_role(auth.uid(), venue_id, 'admin') OR
     public.has_role(auth.uid(), venue_id, 'manager'))
  );

-- RLS Policies for availability_rules
CREATE POLICY "Users can view availability in their venue"
  ON public.availability_rules FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Managers can manage availability"
  ON public.availability_rules FOR ALL
  USING (
    venue_id = public.get_user_venue_id(auth.uid()) AND
    (public.has_role(auth.uid(), venue_id, 'owner') OR 
     public.has_role(auth.uid(), venue_id, 'admin') OR
     public.has_role(auth.uid(), venue_id, 'manager'))
  );

-- RLS Policies for venue_settings
CREATE POLICY "Users can view their venue settings"
  ON public.venue_settings FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Owners and admins can update settings"
  ON public.venue_settings FOR ALL
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR 
    public.has_role(auth.uid(), venue_id, 'admin')
  );

-- RLS Policies for integrations
CREATE POLICY "Users can view integrations in their venue"
  ON public.integrations FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Owners and admins can manage integrations"
  ON public.integrations FOR ALL
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR 
    public.has_role(auth.uid(), venue_id, 'admin')
  );

-- RLS Policies for payments
CREATE POLICY "Users can view payments in their venue"
  ON public.payments FOR SELECT
  USING (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Staff can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (venue_id = public.get_user_venue_id(auth.uid()));

CREATE POLICY "Managers can update payments"
  ON public.payments FOR UPDATE
  USING (
    venue_id = public.get_user_venue_id(auth.uid()) AND
    (public.has_role(auth.uid(), venue_id, 'owner') OR 
     public.has_role(auth.uid(), venue_id, 'admin') OR
     public.has_role(auth.uid(), venue_id, 'manager'))
  );

-- RLS Policies for user_settings
CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own settings"
  ON public.user_settings FOR ALL
  USING (user_id = auth.uid());

-- Add updated_at triggers for new tables
CREATE TRIGGER update_venues_updated_at
  BEFORE UPDATE ON public.venues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_availability_rules_updated_at
  BEFORE UPDATE ON public.availability_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_venue_settings_updated_at
  BEFORE UPDATE ON public.venue_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_integrations_updated_at
  BEFORE UPDATE ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();