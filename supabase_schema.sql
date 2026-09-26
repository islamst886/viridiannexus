-- ==========================================
-- VIRIDIANNEXUS SUPABASE SETUP SCRIPT
-- ==========================================
-- Run this entire script in the Supabase SQL Editor to set up 
-- all tables, policies, and triggers required by the application.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. SCHEMA DEFINITIONS
-- ==========================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  referral_code TEXT UNIQUE,
  avatar TEXT,
  nid_type TEXT,
  nid TEXT,
  address TEXT,
  emergency_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  location TEXT,
  price TEXT,
  status TEXT DEFAULT 'Ready',
  property_type TEXT[] DEFAULT '{}',
  beds INTEGER DEFAULT 0,
  baths INTEGER DEFAULT 0,
  sqft TEXT,
  building_type TEXT,
  units_per_floor TEXT,
  total_units TEXT,
  land_area TEXT,
  architect TEXT,
  parking_available TEXT,
  parking_price TEXT,
  passenger_lifts TEXT,
  front_road_size TEXT,
  total_share TEXT,
  landmarks TEXT,
  google_map_link TEXT,
  completion_date TEXT,
  overview TEXT,
  brochure_url TEXT,
  amenities TEXT[] DEFAULT '{}',
  custom_amenities TEXT[] DEFAULT '{}',
  available_units JSONB DEFAULT '[]',
  inventory JSONB DEFAULT '[]',
  parking_inventory JSONB DEFAULT '[]',
  milestones JSONB DEFAULT '[]',
  images JSONB DEFAULT '{"hero":"","map":"","floorPlan":"","video":"","gallery":[]}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id TEXT REFERENCES public.properties(id),
  property_name TEXT,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  client_address TEXT,
  linked_user_id UUID REFERENCES public.profiles(id),
  unit_number TEXT,
  unit_type TEXT,
  floor_number TEXT,
  parking_slot TEXT,
  parking_price NUMERIC DEFAULT 0,
  total_price NUMERIC DEFAULT 0,
  total_paid NUMERIC DEFAULT 0,
  balance_due NUMERIC DEFAULT 0,
  token_amount NUMERIC DEFAULT 0,
  down_payment_amount NUMERIC DEFAULT 0,
  stage TEXT DEFAULT 'EOI',
  status TEXT DEFAULT 'Active',
  agreement_date DATE,
  handover_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

CREATE TABLE public.booking_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  scheduled_amount NUMERIC DEFAULT 0,
  received_amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  due_date DATE,
  paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.booking_activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  type TEXT,
  message TEXT,
  actor_id UUID REFERENCES public.profiles(id),
  actor_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.booking_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id TEXT REFERENCES public.properties(id),
  property_name TEXT,
  linked_user_id UUID REFERENCES public.profiles(id),
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  unit_type TEXT,
  message TEXT,
  status TEXT DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT,
  email TEXT,
  phone TEXT,
  inquiry_type TEXT,
  message TEXT,
  property_name TEXT,
  source TEXT DEFAULT 'Contact Form',
  status TEXT DEFAULT 'Unread',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'Active',
  subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id TEXT NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  property_name TEXT,
  location TEXT,
  price TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT,
  message TEXT,
  read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO public.settings (key, value) VALUES
  ('site', '{"facebookUrl":"","youtubeUrl":"","linkedinUrl":"","whatsappNumber":""}'),
  ('property_types', '{"types":["Apartment","Penthouse","Luxury Apartment","Duplex","Smart Home","Villa","Townhouse","Commercial"]}')
ON CONFLICT (key) DO NOTHING;


-- ==========================================
-- 2. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() IN ('admin', 'super_admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT get_user_role() = 'super_admin';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- profiles
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_super_admin());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (is_super_admin());

-- properties (public read, admin write)
CREATE POLICY "properties_select" ON public.properties FOR SELECT USING (true);
CREATE POLICY "properties_insert" ON public.properties FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "properties_update" ON public.properties FOR UPDATE USING (is_admin());
CREATE POLICY "properties_delete" ON public.properties FOR DELETE USING (is_admin());

-- bookings (admin full, linked user read)
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (is_admin() OR (auth.uid() IS NOT NULL AND linked_user_id = auth.uid()));
CREATE POLICY "bookings_write" ON public.bookings FOR ALL USING (is_admin());

-- booking_payments
CREATE POLICY "booking_payments_select" ON public.booking_payments
  FOR SELECT USING (is_admin() OR (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.linked_user_id = auth.uid()
  )));
CREATE POLICY "booking_payments_write" ON public.booking_payments FOR ALL USING (is_admin());

-- booking_activity_log (admin only)
CREATE POLICY "activity_log_all" ON public.booking_activity_log FOR ALL USING (is_admin());

-- booking_requests
CREATE POLICY "booking_requests_insert" ON public.booking_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "booking_requests_select" ON public.booking_requests
  FOR SELECT USING (is_admin() OR (auth.uid() IS NOT NULL AND linked_user_id = auth.uid()));
CREATE POLICY "booking_requests_admin" ON public.booking_requests FOR ALL USING (is_admin());

-- inquiries
CREATE POLICY "inquiries_insert" ON public.inquiries FOR INSERT WITH CHECK (true);
CREATE POLICY "inquiries_admin" ON public.inquiries FOR ALL USING (is_admin());

-- newsletter_subscribers
CREATE POLICY "newsletter_insert" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "newsletter_admin" ON public.newsletter_subscribers FOR ALL USING (is_admin());

-- wishlist (self only)
CREATE POLICY "wishlist_select" ON public.wishlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "wishlist_insert" ON public.wishlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wishlist_delete" ON public.wishlist FOR DELETE USING (auth.uid() = user_id);

-- notifications
CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notifications_delete" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (is_admin());

-- settings (public read, admin write)
CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_write" ON public.settings FOR ALL USING (is_admin());


-- ==========================================
-- 3. TRIGGERS & RPC FUNCTIONS
-- ==========================================

-- Trigger to create profile when auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  random_referral TEXT;
BEGIN
  random_referral := 'VN-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
  INSERT INTO public.profiles (id, email, display_name, phone, role, is_banned, referral_code, created_at, last_login_at)
  VALUES (
    NEW.id, NEW.email, NEW.raw_user_meta_data->>'display_name',
    COALESCE(NEW.raw_user_meta_data->>'phone', ''), 'user', false,
    random_referral, NOW(), NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Atomic operations for admin panel
CREATE OR REPLACE FUNCTION public.release_parking_slot(
  p_booking_id UUID, p_parking_slot TEXT, p_property_id TEXT, p_actor_id UUID, p_actor_name TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.bookings SET parking_slot = NULL, parking_price = 0, updated_at = NOW() WHERE id = p_booking_id;
  UPDATE public.properties
  SET parking_inventory = (
    SELECT jsonb_agg(
      CASE WHEN item->>'slotName' = p_parking_slot THEN jsonb_set(item, '{status}', '"Available"') ELSE item END
    ) FROM jsonb_array_elements(parking_inventory) AS item
  )
  WHERE id = p_property_id;
  INSERT INTO public.booking_activity_log (booking_id, type, message, actor_id, actor_name)
  VALUES (p_booking_id, 'parking_released', 'Parking slot released: ' || p_parking_slot, p_actor_id, p_actor_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.add_parking_slot(
  p_booking_id UUID, p_parking_slot TEXT, p_parking_price NUMERIC, p_property_id TEXT, p_actor_id UUID, p_actor_name TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.bookings SET parking_slot = p_parking_slot, parking_price = p_parking_price, updated_at = NOW() WHERE id = p_booking_id;
  UPDATE public.properties
  SET parking_inventory = (
    SELECT jsonb_agg(
      CASE WHEN item->>'slotName' = p_parking_slot THEN jsonb_set(item, '{status}', '"Reserved"') ELSE item END
    ) FROM jsonb_array_elements(parking_inventory) AS item
  )
  WHERE id = p_property_id;
  INSERT INTO public.booking_activity_log (booking_id, type, message, actor_id, actor_name)
  VALUES (p_booking_id, 'parking_added', 'Added parking slot: ' || p_parking_slot, p_actor_id, p_actor_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.change_parking_slot(
  p_booking_id UUID, p_old_slot TEXT, p_new_slot TEXT, p_new_price NUMERIC, p_property_id TEXT, p_actor_id UUID, p_actor_name TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE public.bookings SET parking_slot = p_new_slot, parking_price = p_new_price, updated_at = NOW() WHERE id = p_booking_id;
  UPDATE public.properties
  SET parking_inventory = (
    SELECT jsonb_agg(
      CASE 
        WHEN item->>'slotName' = p_old_slot THEN jsonb_set(item, '{status}', '"Available"')
        WHEN item->>'slotName' = p_new_slot THEN jsonb_set(item, '{status}', '"Reserved"')
        ELSE item 
      END
    ) FROM jsonb_array_elements(parking_inventory) AS item
  )
  WHERE id = p_property_id;
  INSERT INTO public.booking_activity_log (booking_id, type, message, actor_id, actor_name)
  VALUES (p_booking_id, 'parking_changed', 'Changed parking from ' || p_old_slot || ' to ' || p_new_slot, p_actor_id, p_actor_name);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
