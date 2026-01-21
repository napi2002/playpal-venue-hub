-- Auto-provision a venue + membership for each new auth user.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_venue_id UUID;
  venue_name TEXT;
  venue_slug TEXT;
BEGIN
  new_venue_id := gen_random_uuid();
  venue_name := COALESCE(NULLIF(initcap(split_part(NEW.email, '@', 1)), ''), 'New Venue');
  venue_slug := 'venue-' || substring(replace(new_venue_id::text, '-', '') from 1 for 12);

  INSERT INTO public.venues (id, name, slug, email)
  VALUES (new_venue_id, venue_name, venue_slug, NEW.email);

  INSERT INTO public.user_profiles (id, venue_id, email)
  VALUES (NEW.id, new_venue_id, COALESCE(NEW.email, ''));

  INSERT INTO public.user_roles (user_id, venue_id, role)
  VALUES (NEW.id, new_venue_id, 'owner');

  INSERT INTO public.venue_settings (venue_id)
  VALUES (new_venue_id)
  ON CONFLICT (venue_id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, venue_id)
  VALUES (NEW.id, new_venue_id)
  ON CONFLICT (user_id, venue_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
