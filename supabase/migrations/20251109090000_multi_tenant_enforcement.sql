-- Enforce multi-tenant data isolation and venue ownership for all records.

-- Clean up rows that were created before venue scoping was enforced.
DELETE FROM public.bookings WHERE venue_id IS NULL;
DELETE FROM public.courts WHERE venue_id IS NULL;
DELETE FROM public.recurring_bookings WHERE venue_id IS NULL;
DELETE FROM public.availability_rules WHERE venue_id IS NULL;
DELETE FROM public.integrations WHERE venue_id IS NULL;
DELETE FROM public.payments WHERE venue_id IS NULL;
DELETE FROM public.user_settings WHERE venue_id IS NULL;

-- Ensure venue_id exists and is required for tenant-scoped tables.
ALTER TABLE public.courts
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.venues(id) ON DELETE CASCADE;

ALTER TABLE public.courts ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE public.bookings ALTER COLUMN venue_id SET NOT NULL;
ALTER TABLE public.recurring_bookings ALTER COLUMN venue_id SET NOT NULL;

-- Strengthen recurring bookings relationships.
DO $$
BEGIN
  ALTER TABLE public.recurring_bookings
    ADD CONSTRAINT recurring_bookings_venue_id_fkey
    FOREIGN KEY (venue_id) REFERENCES public.venues(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.recurring_bookings
    ADD CONSTRAINT recurring_bookings_court_id_fkey
    FOREIGN KEY (court_id) REFERENCES public.courts(id) ON DELETE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Allow multiple venue memberships per user profile.
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_pkey;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_venue_id_key;
ALTER TABLE public.user_profiles ADD PRIMARY KEY (id, venue_id);

-- Helper: check whether the authenticated user belongs to a venue.
CREATE OR REPLACE FUNCTION public.is_user_in_venue(_venue_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND venue_id = _venue_id
  )
$$;

-- Replace RLS policies with multi-tenant equivalents.
DROP POLICY IF EXISTS "Users can view their own venue" ON public.venues;
DROP POLICY IF EXISTS "Venue owners can update their venue" ON public.venues;

CREATE POLICY "Users can view venues they belong to"
  ON public.venues FOR SELECT
  USING (public.is_user_in_venue(id));

CREATE POLICY "Owners and admins can update their venue"
  ON public.venues FOR UPDATE
  USING (
    public.has_role(auth.uid(), id, 'owner') OR
    public.has_role(auth.uid(), id, 'admin')
  );

DROP POLICY IF EXISTS "Users can view profiles in their venue" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.user_profiles;

CREATE POLICY "Users can view profiles in their venues"
  ON public.user_profiles FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Users can insert their own profiles"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid() AND public.is_user_in_venue(venue_id));

CREATE POLICY "Users can update their own profiles"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid() AND public.is_user_in_venue(venue_id));

DROP POLICY IF EXISTS "Users can view roles in their venue" ON public.user_roles;
DROP POLICY IF EXISTS "Owners and admins can manage roles" ON public.user_roles;

CREATE POLICY "Users can view roles in their venues"
  ON public.user_roles FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Owners and admins can manage roles"
  ON public.user_roles FOR ALL
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin')
  );

DROP POLICY IF EXISTS "Users can view courts in their venue" ON public.courts;
DROP POLICY IF EXISTS "Managers can create courts" ON public.courts;
DROP POLICY IF EXISTS "Managers can update courts" ON public.courts;

CREATE POLICY "Users can view courts in their venues"
  ON public.courts FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Managers can create courts"
  ON public.courts FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin') OR
    public.has_role(auth.uid(), venue_id, 'manager')
  );

CREATE POLICY "Managers can update courts"
  ON public.courts FOR UPDATE
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

DROP POLICY IF EXISTS "Users can view bookings in their venue" ON public.bookings;
DROP POLICY IF EXISTS "Staff can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Managers can delete bookings" ON public.bookings;

CREATE POLICY "Users can view bookings in their venues"
  ON public.bookings FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Staff can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (public.is_user_in_venue(venue_id));

CREATE POLICY "Staff can update bookings"
  ON public.bookings FOR UPDATE
  USING (public.is_user_in_venue(venue_id))
  WITH CHECK (public.is_user_in_venue(venue_id));

CREATE POLICY "Managers can delete bookings"
  ON public.bookings FOR DELETE
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin') OR
    public.has_role(auth.uid(), venue_id, 'manager')
  );

DROP POLICY IF EXISTS "Users can view availability in their venue" ON public.availability_rules;
DROP POLICY IF EXISTS "Managers can manage availability" ON public.availability_rules;

CREATE POLICY "Users can view availability in their venues"
  ON public.availability_rules FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Managers can manage availability"
  ON public.availability_rules FOR ALL
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

DROP POLICY IF EXISTS "Users can view their venue settings" ON public.venue_settings;
DROP POLICY IF EXISTS "Owners and admins can update settings" ON public.venue_settings;

CREATE POLICY "Users can view their venue settings"
  ON public.venue_settings FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Owners and admins can update settings"
  ON public.venue_settings FOR ALL
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin')
  );

DROP POLICY IF EXISTS "Users can view integrations in their venue" ON public.integrations;
DROP POLICY IF EXISTS "Owners and admins can manage integrations" ON public.integrations;

CREATE POLICY "Users can view integrations in their venues"
  ON public.integrations FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Owners and admins can manage integrations"
  ON public.integrations FOR ALL
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin')
  );

DROP POLICY IF EXISTS "Users can view payments in their venue" ON public.payments;
DROP POLICY IF EXISTS "Staff can create payments" ON public.payments;
DROP POLICY IF EXISTS "Managers can update payments" ON public.payments;

CREATE POLICY "Users can view payments in their venues"
  ON public.payments FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Staff can create payments"
  ON public.payments FOR INSERT
  WITH CHECK (public.is_user_in_venue(venue_id));

CREATE POLICY "Managers can update payments"
  ON public.payments FOR UPDATE
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

DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can manage their own settings" ON public.user_settings;

CREATE POLICY "Users can view their own settings"
  ON public.user_settings FOR SELECT
  USING (user_id = auth.uid() AND public.is_user_in_venue(venue_id));

CREATE POLICY "Users can manage their own settings"
  ON public.user_settings FOR ALL
  USING (user_id = auth.uid() AND public.is_user_in_venue(venue_id))
  WITH CHECK (user_id = auth.uid() AND public.is_user_in_venue(venue_id));

DROP POLICY IF EXISTS "Users can view recurring bookings in their venue" ON public.recurring_bookings;
DROP POLICY IF EXISTS "Staff can create recurring bookings" ON public.recurring_bookings;
DROP POLICY IF EXISTS "Staff can update recurring bookings" ON public.recurring_bookings;
DROP POLICY IF EXISTS "Managers can delete recurring bookings" ON public.recurring_bookings;

CREATE POLICY "Users can view recurring bookings in their venues"
  ON public.recurring_bookings FOR SELECT
  USING (public.is_user_in_venue(venue_id));

CREATE POLICY "Staff can create recurring bookings"
  ON public.recurring_bookings FOR INSERT
  WITH CHECK (public.is_user_in_venue(venue_id));

CREATE POLICY "Staff can update recurring bookings"
  ON public.recurring_bookings FOR UPDATE
  USING (public.is_user_in_venue(venue_id))
  WITH CHECK (public.is_user_in_venue(venue_id));

CREATE POLICY "Managers can delete recurring bookings"
  ON public.recurring_bookings FOR DELETE
  USING (
    public.has_role(auth.uid(), venue_id, 'owner') OR
    public.has_role(auth.uid(), venue_id, 'admin') OR
    public.has_role(auth.uid(), venue_id, 'manager')
  );
