# Migration Plan Part 1: Backend, Schema and Core Files
## Viridiannexus: Firebase + Cloudflare to Vercel + Supabase

This is Part 1 of 2. See migration_plan_part2.md for admin pages, API routes, deployment and testing.

---

## Architecture Overview

| Concern | Current | Replace With |
|---|---|---|
| Authentication | Firebase Auth | Supabase Auth |
| Database | Firestore (NoSQL) | Supabase Postgres (SQL) |
| File Storage | Firebase Storage + Cloudinary | Supabase Storage (all files) |
| Backend Functions | Cloudflare Pages Functions | Vercel API Routes |
| Hosting | Cloudflare Pages | Vercel |
| Domain | Cloudflare DNS | Cloudflare DNS records pointed at Vercel |

---

## Firestore Collections to Supabase Postgres Tables

| Firestore Collection | Supabase Table |
|---|---|
| users/{uid} | profiles |
| properties/{id} | properties |
| bookings/{id} | bookings |
| bookings/{id}/payments/{id} | booking_payments |
| bookings/{id}/activityLog/{id} | booking_activity_log |
| bookingRequests/{id} | booking_requests |
| inquiries/{id} | inquiries |
| newsletter_subscribers/{id} | newsletter_subscribers |
| settings/site | settings (key=site) |
| settings/propertyTypes | settings (key=property_types) |
| users/{uid}/wishlist/{id} | wishlist |
| users/{uid}/notifications/{id} | notifications |

---

## Phase 1: Supabase Project Setup

1. Go to supabase.com, create New Project, name it viridiannexus
2. Region: Southeast Asia (Singapore) - closest to Bangladesh
3. Save the Database password securely

Credentials to collect from Supabase Dashboard, Settings, API:
- VITE_SUPABASE_URL = Project URL
- VITE_SUPABASE_ANON_KEY = anon public key
- SUPABASE_SERVICE_ROLE_KEY = service_role key (server-only, NEVER expose to client)

---

## Phase 2: Database Schema

Run this entire block in Supabase SQL Editor, New Query:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  phone TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'super_admin')),
  is_banned BOOLEAN NOT NULL DEFAULT false,
  referral_code TEXT UNIQUE,
  avatar TEXT,
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
```

---

## Phase 3: Row Level Security (RLS)

CRITICAL: Run immediately after schema. Without RLS all data is publicly exposed.

```sql
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
```

---

## Phase 4: Supabase Storage Buckets

Create in Supabase Dashboard, Storage, New Bucket:

| Bucket Name | Public | Purpose |
|---|---|---|
| property-media | Yes | Hero, gallery, floor plan, map, video |
| brochures | Yes | PDF brochures (was Firebase Storage) |
| avatars | Yes | User profile pictures |
| milestones | Yes | Progress manager images |

Storage Policies per bucket (Supabase, Storage, Policies):
- SELECT: true (public read for all buckets)
- INSERT: is_admin() for property-media, brochures, milestones; auth.uid() IS NOT NULL for avatars
- DELETE: is_admin() for property buckets; auth.uid() IS NOT NULL for avatars

---

## Phase 5: Auth Configuration and DB Trigger

In Supabase Dashboard, Authentication, Settings:
1. Site URL: https://viridiannexus.com
2. Redirect URLs: https://viridiannexus.com/** and http://localhost:5173/**
3. Enable Email Confirmations: Yes

Auto-create profile on signup - run in SQL Editor:

```sql
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

Create Super Admin (after creating user in Supabase Auth, Users):
```sql
UPDATE public.profiles SET role = 'super_admin' WHERE id = 'YOUR-UUID-HERE';
```

---

## Phase 6: Core Code Files

### 6.1 Install Dependencies

```bash
npm uninstall firebase
npm install @supabase/supabase-js
```

### 6.2 New .env file

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 6.3 src/supabase.js (new file, replaces src/firebase.js)

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
});
```

### 6.4 src/context/AuthContext.jsx - Complete Rewrite

```javascript
import React, { createContext, useContext, useState } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(false);

  const getFriendlyError = (error) => {
    if (!error?.message) return 'An error occurred. Please try again.';
    const msg = error.message.toLowerCase();
    if (msg.includes('email already registered') || msg.includes('user already registered'))
      return 'An account with this email already exists.';
    if (msg.includes('invalid login credentials'))
      return 'Invalid email or password. Please try again.';
    if (msg.includes('email not confirmed'))
      return 'Please verify your email before signing in.';
    if (msg.includes('too many requests'))
      return 'Too many attempts. Please wait and try again.';
    if (msg.includes('network'))
      return 'Network error. Check your connection.';
    return error.message || 'An error occurred. Please try again.';
  };

  const signIn = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    } finally { setLoading(false); }
  };

  const signUp = async (email, password, name, phone) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { display_name: name, phone: phone || '' } }
      });
      if (error) throw error;
      toast.info('A verification email has been sent. Please check your inbox.');
      return data;
    } catch (error) {
      toast.error(getFriendlyError(error));
      throw error;
    } finally { setLoading(false); }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('You have been signed out.');
    } catch (error) { toast.error('Failed to sign out.'); throw error; }
  };

  const resetPassword = async (email) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?reset=true`
      });
      if (error) throw error;
      toast.success('A password reset link has been sent to your email.');
    } catch (error) { toast.error(getFriendlyError(error)); throw error; }
  };

  const resendVerificationEmail = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user.');
      if (user.email_confirmed_at) { toast.info('Your email is already verified.'); return; }
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email });
      if (error) throw error;
      toast.success('Verification email sent! Please check your inbox.');
    } catch (err) { toast.error('Failed to send verification email.'); }
  };

  const updateUserProfileData = async (data) => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error('No authenticated user found.');

      const authMeta = {};
      if (data.displayName !== undefined) authMeta.display_name = data.displayName;
      if (Object.keys(authMeta).length > 0) {
        const { error: metaErr } = await supabase.auth.updateUser({ data: authMeta });
        if (metaErr) throw metaErr;
      }

      if (data.email && data.email.trim().toLowerCase() !== user.email?.toLowerCase()) {
        const { error: emailErr } = await supabase.auth.updateUser({ email: data.email.trim() });
        if (emailErr) {
          toast.warning('Email change requires verification. Check your new email inbox.');
          delete data.email;
        } else {
          toast.info('A verification link has been sent to your new email.');
        }
      }

      const profileUpdate = { updated_at: new Date().toISOString() };
      if (data.displayName !== undefined) profileUpdate.display_name = data.displayName;
      if (data.email !== undefined) profileUpdate.email = data.email;
      if (data.phone !== undefined) profileUpdate.phone = data.phone;
      if (data.avatar !== undefined) profileUpdate.avatar = data.avatar;

      const { error: profileErr } = await supabase
        .from('profiles').update(profileUpdate).eq('id', user.id);
      if (profileErr) throw profileErr;

      toast.success('Profile updated successfully!');
      return true;
    } catch (err) {
      console.error('Profile update error:', err);
      toast.error(err.message || 'Failed to update profile.');
      throw err;
    } finally { setLoading(false); }
  };

  return (
    <AuthContext.Provider value={{
      signIn, signUp, signOut, resetPassword,
      resendVerificationEmail, updateUserProfileData, loading
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
```

### 6.5 src/context/GlobalState.jsx - Complete Rewrite

```javascript
import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '../supabase';
import { mapPropertyFromDB } from '../utils/mappers';
import { toast } from 'react-toastify';

const GlobalStateContext = createContext();

export const GlobalStateProvider = ({ children }) => {
  const [authUser, setAuthUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [wishlist, setWishlist] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [adminUnsavedChanges, setAdminUnsavedChanges] = useState(false);
  const [bypassUnsavedGuard, setBypassUnsavedGuard] = useState(false);
  const [siteSettings, setSiteSettings] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user ?? null);
      if (!session?.user) setAuthLoading(false);
    });

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const user = session?.user ?? null;
        setAuthUser(user);
        if (!user) {
          setUserProfile(null); setWishlist([]); setNotifications([]);
          setAuthLoading(false);
        }
      }
    );
    return () => authSub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authUser) return;
    const mapProfile = (data) => ({
      uid: data.id, id: data.id, displayName: data.display_name,
      email: data.email, phone: data.phone, role: data.role,
      isBanned: data.is_banned, referralCode: data.referral_code,
      avatar: data.avatar, createdAt: data.created_at,
    });

    const fetchProfile = async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).single();
      if (error) { console.error('Profile fetch error:', error); setAuthLoading(false); return; }
      if (data?.is_banned) {
        await supabase.auth.signOut(); toast.error('Your account has been suspended.'); setUserProfile(null);
      } else { setUserProfile(mapProfile(data)); }
      setAuthLoading(false);
    };
    fetchProfile();

    const profileSub = supabase.channel(`profile:${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${authUser.id}` },
        (payload) => {
          const data = payload.new;
          if (data?.is_banned) { supabase.auth.signOut(); toast.error('Your account has been suspended.'); setUserProfile(null); }
          else { setUserProfile(mapProfile(data)); }
        })
      .subscribe();
    return () => supabase.removeChannel(profileSub);
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser) { setWishlist([]); return; }
    const fetch = async () => {
      const { data } = await supabase.from('wishlist').select('*').eq('user_id', authUser.id);
      setWishlist(data || []);
    };
    fetch();
    const sub = supabase.channel(`wishlist:${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist', filter: `user_id=eq.${authUser.id}` }, fetch)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [authUser?.id]);

  useEffect(() => {
    if (!authUser) { setNotifications([]); return; }
    const fetch = async () => {
      const { data } = await supabase.from('notifications').select('*')
        .eq('user_id', authUser.id).order('created_at', { ascending: false }).limit(20);
      setNotifications(data || []);
    };
    fetch();
    const sub = supabase.channel(`notifications:${authUser.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${authUser.id}` }, fetch)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, [authUser?.id]);

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.from('properties').select('*');
      if (error) console.error('Properties fetch error:', error);
      setProperties((data || []).map(mapPropertyFromDB));
      setLoadingProperties(false);
    };
    fetch();
    const sub = supabase.channel('properties_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, fetch)
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'site').single();
      setSiteSettings(data?.value || { facebookUrl: '', youtubeUrl: '', linkedinUrl: '', whatsappNumber: '' });
    };
    fetch();
    const sub = supabase.channel('settings_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.site' },
        (payload) => setSiteSettings(payload.new?.value || {}))
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const toggleWishlist = async (property) => {
    if (!authUser) { toast.info('Sign in to save properties to your wishlist.'); return false; }
    const exists = wishlist.find(p => p.property_id === property.id);
    try {
      if (exists) {
        await supabase.from('wishlist').delete().eq('user_id', authUser.id).eq('property_id', property.id);
        toast.success('Removed from wishlist');
      } else {
        await supabase.from('wishlist').insert({ user_id: authUser.id, property_id: property.id, property_name: property.name, location: property.location, price: property.price });
        toast.success('Added to wishlist');
      }
      return true;
    } catch (err) { console.error(err); toast.error('Failed to update wishlist'); return false; }
  };

  const markNotificationsRead = async () => {
    if (!authUser) return;
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  };

  const isLoggedIn = !!authUser;
  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const isSuperAdmin = userProfile?.role === 'super_admin';

  return (
    <GlobalStateContext.Provider value={{
      authUser, userProfile, authLoading, isLoggedIn, isAdmin, isSuperAdmin,
      wishlist, toggleWishlist, notifications, markNotificationsRead,
      properties, loadingProperties, adminUnsavedChanges, setAdminUnsavedChanges,
      bypassUnsavedGuard, setBypassUnsavedGuard, siteSettings
    }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => useContext(GlobalStateContext);
```

### 6.6 src/utils/mappers.js (NEW FILE)

```javascript
export function mapPropertyFromDB(row) {
  if (!row) return null;
  return {
    id: row.id, name: row.name, location: row.location, price: row.price, status: row.status,
    propertyType: row.property_type || [], beds: row.beds, baths: row.baths, sqft: row.sqft,
    buildingType: row.building_type, unitsPerFloor: row.units_per_floor, totalUnits: row.total_units,
    landArea: row.land_area, architect: row.architect, parkingAvailable: row.parking_available,
    parkingPrice: row.parking_price, passengerLifts: row.passenger_lifts, frontRoadSize: row.front_road_size,
    totalShare: row.total_share, landmarks: row.landmarks, googleMapLink: row.google_map_link,
    completionDate: row.completion_date, overview: row.overview, brochureUrl: row.brochure_url,
    amenities: row.amenities || [], customAmenities: row.custom_amenities || [],
    availableUnits: row.available_units || [], inventory: row.inventory || [],
    parkingInventory: row.parking_inventory || [], milestones: row.milestones || [],
    images: row.images || { hero: '', map: '', floorPlan: '', video: '', gallery: [] },
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function mapPropertyToDB(formData) {
  return {
    id: formData.id, name: formData.name, location: formData.location, price: formData.price,
    status: formData.status, property_type: formData.propertyType || [],
    beds: Number(formData.beds) || 0, baths: Number(formData.baths) || 0, sqft: formData.sqft,
    building_type: formData.buildingType, units_per_floor: formData.unitsPerFloor,
    total_units: formData.totalUnits, land_area: formData.landArea, architect: formData.architect,
    parking_available: formData.parkingAvailable, parking_price: formData.parkingPrice,
    passenger_lifts: formData.passengerLifts, front_road_size: formData.frontRoadSize,
    total_share: formData.totalShare, landmarks: formData.landmarks,
    google_map_link: formData.googleMapLink, completion_date: formData.completionDate,
    overview: formData.overview, brochure_url: formData.brochureUrl,
    amenities: formData.amenities || [], custom_amenities: formData.customAmenities || [],
    available_units: formData.availableUnits || [], inventory: formData.inventory || [],
    parking_inventory: formData.parkingInventory || [],
    images: formData.images || { hero: '', map: '', floorPlan: '', video: '', gallery: [] },
    updated_at: new Date().toISOString(),
  };
}

export function mapBookingFromDB(row) {
  if (!row) return null;
  return {
    id: row.id, propertyId: row.property_id, propertyName: row.property_name,
    clientName: row.client_name, clientEmail: row.client_email, clientPhone: row.client_phone,
    clientAddress: row.client_address, linkedUserId: row.linked_user_id,
    unitNumber: row.unit_number, unitType: row.unit_type, floorNumber: row.floor_number,
    parkingSlot: row.parking_slot, parkingPrice: row.parking_price,
    totalPrice: row.total_price, totalPaid: row.total_paid, balanceDue: row.balance_due,
    tokenAmount: row.token_amount, downPaymentAmount: row.down_payment_amount,
    stage: row.stage, status: row.status, agreementDate: row.agreement_date,
    handoverDate: row.handover_date, notes: row.notes,
    createdAt: row.created_at, updatedAt: row.updated_at, createdBy: row.created_by,
  };
}

export function mapPaymentFromDB(row) {
  if (!row) return null;
  return {
    id: row.id, bookingId: row.booking_id, type: row.type,
    scheduledAmount: row.scheduled_amount, receivedAmount: row.received_amount,
    status: row.status, dueDate: row.due_date, paidDate: row.paid_date,
    notes: row.notes, createdAt: row.created_at,
  };
}

export function mapActivityFromDB(row) {
  if (!row) return null;
  return {
    id: row.id, bookingId: row.booking_id, type: row.type, message: row.message,
    actorId: row.actor_id, actorName: row.actor_name, metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}
```

### 6.7 src/utils/supabaseStorage.js (NEW - replaces src/utils/cloudinary.js)

```javascript
import { supabase } from '../supabase';

const BUCKET_MAP = {
  hero: 'property-media', map: 'property-media', floorPlan: 'property-media',
  video: 'property-media', gallery: 'property-media',
  brochure: 'brochures', milestone: 'milestones', avatar: 'avatars',
};

export const uploadMedia = async (file, mediaType, prefix = '') => {
  const bucket = BUCKET_MAP[mediaType] || 'property-media';
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = prefix ? `${prefix}/${mediaType}_${timestamp}_${sanitizedName}` : `${mediaType}_${timestamp}_${sanitizedName}`;

  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, cacheControl: '3600' });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path);
  return publicUrl;
};

export const deleteMedia = async (url) => {
  if (!url) return true;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!url.includes(supabaseUrl)) { console.warn('Skipping non-Supabase URL:', url); return true; }
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/object/public/');
    if (pathParts.length < 2) return false;
    const [bucket, ...fileParts] = pathParts[1].split('/');
    const filePath = decodeURIComponent(fileParts.join('/'));
    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) { console.error('Storage delete error:', error); return false; }
    return true;
  } catch (err) { console.error('Delete media error:', err); return false; }
};

export const deleteMediaBeacon = (url) => {
  if (!url || !navigator.sendBeacon) return;
  try {
    const blob = new Blob([JSON.stringify({ url })], { type: 'application/json' });
    navigator.sendBeacon('/api/deleteMedia', blob);
  } catch (err) { console.error('Beacon deletion error:', err); }
};
```

### 6.8 src/hooks/usePropertyTypes.js - Complete Rewrite

```javascript
import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

const DEFAULT_TYPES = ['Apartment', 'Penthouse', 'Luxury Apartment', 'Duplex', 'Smart Home', 'Villa', 'Townhouse', 'Commercial'];

export function usePropertyTypes() {
  const [types, setTypes] = useState(DEFAULT_TYPES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('settings').select('value').eq('key', 'property_types').single();
      const t = data?.value?.types;
      setTypes(Array.isArray(t) && t.length > 0 ? [...t].sort() : DEFAULT_TYPES);
      setLoading(false);
    };
    fetch();
    const sub = supabase.channel('property_types_setting')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings', filter: 'key=eq.property_types' },
        (payload) => { const t = payload.new?.value?.types; if (Array.isArray(t)) setTypes([...t].sort()); })
      .subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  return { types, loading };
}

export async function addPropertyType(newType, currentTypes) {
  const updated = [...new Set([...currentTypes, newType.trim()])].sort();
  await supabase.from('settings').upsert({ key: 'property_types', value: { types: updated } });
  return updated;
}

export async function removePropertyType(typeToRemove, currentTypes) {
  const updated = currentTypes.filter(t => t !== typeToRemove);
  await supabase.from('settings').upsert({ key: 'property_types', value: { types: updated } });
  return updated;
}
```
