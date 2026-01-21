-- Create a secure helper to provision a venue when a user is missing one.

CREATE OR REPLACE FUNCTION public.create_venue_for_user(
  _name TEXT DEFAULT NULL,
  _timezone TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _tax_information TEXT DEFAULT NULL
)
RETURNS public.venues
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_venue public.venues%rowtype;
  new_venue public.venues%rowtype;
  new_venue_id UUID;
BEGIN
  SELECT v.*
  INTO existing_venue
  FROM public.venues v
  JOIN public.user_roles ur ON ur.venue_id = v.id
  WHERE ur.user_id = auth.uid()
  ORDER BY v.created_at ASC
  LIMIT 1;

  IF FOUND THEN
    RETURN existing_venue;
  END IF;

  new_venue_id := gen_random_uuid();

  INSERT INTO public.venues (
    id,
    name,
    slug,
    email,
    phone,
    address,
    timezone,
    tax_information
  )
  VALUES (
    new_venue_id,
    COALESCE(NULLIF(_name, ''), 'New Venue'),
    'venue-' || substring(replace(new_venue_id::text, '-', '') from 1 for 12),
    NULLIF(_email, ''),
    NULLIF(_phone, ''),
    NULLIF(_address, ''),
    NULLIF(_timezone, ''),
    NULLIF(_tax_information, '')
  )
  RETURNING * INTO new_venue;

  INSERT INTO public.user_profiles (id, venue_id, email)
  VALUES (auth.uid(), new_venue_id, COALESCE(NULLIF(_email, ''), ''))
  ON CONFLICT (id, venue_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, venue_id, role)
  VALUES (auth.uid(), new_venue_id, 'owner')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.venue_settings (venue_id)
  VALUES (new_venue_id)
  ON CONFLICT (venue_id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, venue_id)
  VALUES (auth.uid(), new_venue_id)
  ON CONFLICT (user_id, venue_id) DO NOTHING;

  RETURN new_venue;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_venue_for_user(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT
) TO authenticated;
