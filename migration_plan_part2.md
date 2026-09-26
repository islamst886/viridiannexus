# Migration Plan Part 2: Admin Pages, Public Pages, Deployment and Testing
## Viridiannexus: Firebase + Cloudflare to Vercel + Supabase

This is Part 2 of 2. See migration_plan_part1.md for schema, RLS, auth and core files.

---

## Phase 7: Admin Panel File Changes

### 7.1 src/pages/Admin/PropertyForm.jsx

IMPORTS to change:
- Remove: import { db, storage } from '../../firebase'
- Remove: import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
- Remove: import { collection, doc, setDoc, getDoc } from 'firebase/firestore'
- Remove: import { deleteCloudinaryMedia, deleteCloudinaryMediaBeacon } from '../../utils/cloudinary'
- Add: import { supabase } from '../../supabase'
- Add: import { uploadMedia, deleteMedia, deleteMediaBeacon } from '../../utils/supabaseStorage'
- Add: import { mapPropertyFromDB, mapPropertyToDB } from '../../utils/mappers'

fetchProperty() function - replace entirely:
```javascript
const fetchProperty = async () => {
  try {
    const { data, error } = await supabase.from('properties').select('*').eq('id', id).single();
    if (error || !data) { toast.error('Property not found'); navigate('/admin/dashboard'); return; }
    const d = mapPropertyFromDB(data);
    setFormData({
      ...d,
      propertyType: d.propertyType || [],
      amenities: d.amenities || [],
      customAmenities: d.customAmenities || [],
      availableUnits: d.availableUnits || [],
      inventory: d.inventory || [],
      parkingInventory: d.parkingInventory || [],
    });
  } catch (error) { toast.error('Error fetching property details'); }
};
```

handleGalleryUpload() - replace fetch call:
```javascript
// Replace Cloudinary block with:
for (const file of files) {
  const publicUrl = await uploadMedia(file, 'gallery', formData.id || 'new');
  setNewlyUploadedMedia(prev => [...prev, publicUrl]);
  newGalleryUrls.push(publicUrl);
}
```

handleFileUpload() - replace entire try block body:
```javascript
// Remove the entire Firebase Storage brochure block AND Cloudinary block
// Replace with a single unified upload:
const publicUrl = await uploadMedia(file, mediaType, formData.id || 'new');

const oldUrl = mediaType === 'brochure' ? formData.brochureUrl : formData.images[mediaType];
if (oldUrl) { setMediaToDelete(prev => [...prev, oldUrl]); }
setNewlyUploadedMedia(prev => [...prev, publicUrl]);

if (mediaType === 'brochure') {
  setFormData(prev => ({ ...prev, brochureUrl: publicUrl }));
} else {
  setFormData(prev => ({ ...prev, images: { ...prev.images, [mediaType]: publicUrl } }));
}
setIsDirty(true);
toast.success(`${mediaType} uploaded successfully!`);
```

handleSubmit() - replace Firestore save block:
```javascript
const propId = formData.id || formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const dbData = mapPropertyToDB({ ...formData, id: propId });

const { error } = await supabase.from('properties').upsert(dbData, { onConflict: 'id' });
if (error) throw error;

await supabase.from('settings').upsert({ key: 'property_types', value: { types: localPropertyTypes } });

if (mediaToDelete.length > 0) {
  toast.info('Cleaning up old media...');
  await Promise.all(mediaToDelete.map(url => deleteMedia(url)));
  setMediaToDelete([]);
}
setNewlyUploadedMedia([]);
setSaveSuccess(true);
setIsDirty(false);
toast.success(`Property ${isEditing ? 'updated' : 'created'} successfully!`);
navigate('/admin/dashboard');
```

Unmount cleanup - replace beacon calls:
```javascript
// Replace deleteCloudinaryMediaBeacon with deleteMediaBeacon
newlyUploadedRef.current.forEach(url => deleteMediaBeacon(url));
```

---

### 7.2 src/pages/Admin/Dashboard.jsx

IMPORTS:
- Remove: import { db } from '../../firebase'
- Remove: import { collection, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
- Remove: import { deleteCloudinaryMedia } from '../../utils/cloudinary'
- Add: import { supabase } from '../../supabase'
- Add: import { deleteMedia } from '../../utils/supabaseStorage'
- Add: import { useGlobalState } from '../../context/GlobalState'

Replace the entire useEffect with:
```javascript
const { properties: globalProperties, loadingProperties } = useGlobalState();

useEffect(() => {
  setProperties(globalProperties);
  setStats(prev => ({ ...prev, properties: globalProperties.filter(p => p.status === 'Active').length }));
}, [globalProperties]);

useEffect(() => {
  setLoading(loadingProperties);
}, [loadingProperties]);

useEffect(() => {
  const fetchStats = async () => {
    const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    const { data: bookingsData } = await supabase.from('bookings').select('total_price, status').neq('status', 'Cancelled');
    const totalValue = (bookingsData || []).reduce((acc, b) => acc + (Number(b.total_price) || 0), 0);
    setStats(prev => ({ ...prev, users: usersCount || 0, value: totalValue }));
  };
  fetchStats();

  const statsSub = supabase.channel('dashboard_stats')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchStats)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchStats)
    .subscribe();
  return () => supabase.removeChannel(statsSub);
}, []);
```

handleDelete() - replace:
```javascript
const allMediaUrls = [];
if (property.images) {
  Object.values(property.images).forEach(val => {
    if (Array.isArray(val)) val.forEach(url => { if (url && typeof url === 'string') allMediaUrls.push(url); });
    else if (val && typeof val === 'string') allMediaUrls.push(val);
  });
}
if (property.brochureUrl) allMediaUrls.push(property.brochureUrl);
if (property.milestones && Array.isArray(property.milestones)) {
  property.milestones.forEach(m => {
    if (m.images && Array.isArray(m.images)) m.images.forEach(url => { if (url) allMediaUrls.push(url); });
    if (m.imageUrl) allMediaUrls.push(m.imageUrl);
  });
}

if (allMediaUrls.length > 0) {
  toast.info(`Deleting ${allMediaUrls.length} associated media files...`);
  await Promise.all(allMediaUrls.map(url => deleteMedia(url)));
}

const { error } = await supabase.from('properties').delete().eq('id', property.id);
if (error) throw error;
toast.success('Property deleted completely.');
```

---

### 7.3 src/pages/Admin/Messages.jsx

IMPORTS: Remove firebase imports, add supabase.

fetchInquiries():
```javascript
const fetchInquiries = async () => {
  try {
    const { data, error } = await supabase.from('inquiries').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    setInquiries(data || []);
  } catch (error) { toast.error('Failed to fetch messages'); } finally { setLoading(false); }
};
```

toggleStatus():
```javascript
const { error } = await supabase.from('inquiries').update({ status: newStatus }).eq('id', inquiry.id);
if (error) throw error;
```

handleDelete():
```javascript
const { error } = await supabase.from('inquiries').delete().eq('id', id);
if (error) throw error;
```

Timestamp display: change inquiry.createdAt?.seconds to:
```javascript
{inquiry.created_at && (
  <span>{new Date(inquiry.created_at).toLocaleDateString()}</span>
)}
```
and in expanded view:
```javascript
{new Date(inquiry.created_at).toLocaleString()}
```

---

### 7.4 src/pages/Admin/Newsletter.jsx

IMPORTS: Remove firebase imports, add supabase.

fetchSubscribers():
```javascript
const { data, error } = await supabase.from('newsletter_subscribers').select('*').order('subscribed_at', { ascending: false });
if (error) throw error;
setSubscribers(data || []);
```

handleDelete():
```javascript
const { error } = await supabase.from('newsletter_subscribers').delete().eq('id', id);
if (error) throw error;
```

Timestamp: change sub.subscribedAt?.seconds to:
```javascript
{sub.subscribed_at ? new Date(sub.subscribed_at).toLocaleDateString() : 'Unknown Date'}
```

---

### 7.5 src/pages/Admin/UserManager.jsx

IMPORTS: Remove firebase imports, add supabase.

useEffect listener:
```javascript
useEffect(() => {
  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers(data || []);
    setLoading(false);
  };
  fetchUsers();

  const sub = supabase.channel('users_realtime')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
    .subscribe();
  return () => supabase.removeChannel(sub);
}, []);
```

handleToggleBan():
```javascript
const { error } = await supabase.from('profiles').update({
  is_banned: newStatus,
  updated_at: new Date().toISOString()
}).eq('id', user.id);
if (error) throw error;
```

handleRoleChange():
```javascript
const { error } = await supabase.from('profiles').update({
  role: newRole,
  updated_at: new Date().toISOString()
}).eq('id', selectedUser.id);
if (error) throw error;
```

Field mapping changes (snake_case from DB):
- u.displayName -> u.display_name
- u.isBanned -> u.is_banned
- u.createdAt?.toDate -> new Date(u.created_at).toLocaleDateString()
- isSelf check: u.id === userProfile?.uid (id stays as UUID)

---

### 7.6 src/pages/Admin/SiteSettings.jsx

IMPORTS: Remove firebase imports, add supabase.

fetchSettings():
```javascript
const { data } = await supabase.from('settings').select('value').eq('key', 'site').single();
if (data) setFormData(prev => ({ ...prev, ...data.value }));
```

handleSubmit():
```javascript
const { error } = await supabase.from('settings').upsert({
  key: 'site',
  value: { ...formData, lastUpdatedAt: new Date().toISOString(), lastUpdatedBy: userProfile?.uid }
});
if (error) throw error;
```

---

### 7.7 src/pages/Admin/ProgressManager.jsx

IMPORTS:
- Remove: import { db } from '../../firebase'
- Remove: import { deleteCloudinaryMedia, deleteCloudinaryMediaBeacon } from '../../utils/cloudinary'
- Add: import { supabase } from '../../supabase'
- Add: import { uploadMedia, deleteMedia, deleteMediaBeacon } from '../../utils/supabaseStorage'

handleImageUpload() - replace Cloudinary fetch:
```javascript
const publicUrl = await uploadMedia(file, 'milestone', selectedPropertyId);
setNewlyUploadedImages(prev => [...prev, publicUrl]);
setMilestoneForm(prev => ({ ...prev, images: [...(prev.images || []), publicUrl] }));
toast.success('Milestone image uploaded successfully!');
```

handleSaveMilestone() and handleDeleteMilestone() - replace updateDoc:
```javascript
const { error } = await supabase.from('properties').update({ milestones: updatedMilestones }).eq('id', selectedPropertyId);
if (error) throw error;
```

deleteMedia calls: replace deleteCloudinaryMedia with deleteMedia
Beacon calls: replace deleteCloudinaryMediaBeacon with deleteMediaBeacon

---

### 7.8 src/pages/Admin/Bookings.jsx

This is the largest admin file. Key changes:

IMPORTS: Remove all firebase imports, add supabase, mapBookingFromDB, mapPaymentFromDB.

Replace all onSnapshot listeners with Supabase realtime:
```javascript
useEffect(() => {
  const fetchBookings = async () => {
    const { data } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
    setBookings((data || []).map(mapBookingFromDB));
    setLoading(false);
  };
  fetchBookings();

  const sub = supabase.channel('bookings_admin')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, fetchBookings)
    .subscribe();
  return () => supabase.removeChannel(sub);
}, []);
```

For properties, use the GlobalState context (already realtime, no separate listener needed).

All new booking creation (addDoc -> supabase insert):
```javascript
const { data: newBooking, error } = await supabase.from('bookings').insert({
  property_id: selectedPropertyId, property_name: ..., client_name: ...,
  // ... all snake_case fields
  created_by: userProfile?.uid,
}).select().single();
if (error) throw error;
```

Payment creation (addDoc -> supabase insert):
```javascript
await supabase.from('booking_payments').insert({
  booking_id: newBooking.id, type: ..., scheduled_amount: ..., status: 'Pending'
});
```

Activity log (addDoc -> supabase insert):
```javascript
await supabase.from('booking_activity_log').insert({
  booking_id: newBooking.id, type: 'booking_created',
  message: 'Booking created by admin', actor_id: userProfile?.uid, actor_name: adminName
});
```

For Firestore runTransaction equivalents, use Vercel API route /api/advance-booking-stage.

---

### 7.9 src/pages/Admin/BookingDetailAdmin.jsx

IMPORTS: Remove firebase, add supabase and mappers.

Main booking listener:
```javascript
useEffect(() => {
  const fetchBooking = async () => {
    const { data } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    setBooking(data ? mapBookingFromDB(data) : null);
    setLoading(false);
  };
  fetchBooking();

  const sub = supabase.channel(`booking_detail:${bookingId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `id=eq.${bookingId}` }, fetchBooking)
    .subscribe();
  return () => supabase.removeChannel(sub);
}, [bookingId]);
```

Payments listener:
```javascript
useEffect(() => {
  if (!bookingId) return;
  const fetch = async () => {
    const { data } = await supabase.from('booking_payments').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true });
    setPayments((data || []).map(mapPaymentFromDB));
  };
  fetch();
  const sub = supabase.channel(`payments:${bookingId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_payments', filter: `booking_id=eq.${bookingId}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(sub);
}, [bookingId]);
```

Activity log listener:
```javascript
useEffect(() => {
  if (!bookingId) return;
  const fetch = async () => {
    const { data } = await supabase.from('booking_activity_log').select('*').eq('booking_id', bookingId).order('created_at', { ascending: false });
    setActivity((data || []).map(mapActivityFromDB));
  };
  fetch();
  const sub = supabase.channel(`activity:${bookingId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'booking_activity_log', filter: `booking_id=eq.${bookingId}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(sub);
}, [bookingId]);
```

Linked user listener:
```javascript
useEffect(() => {
  if (!booking?.linkedUserId) { setLinkedUser(null); return; }
  const fetch = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('id', booking.linkedUserId).single();
    setLinkedUser(data ? { id: data.id, displayName: data.display_name, phone: data.phone, email: data.email } : null);
  };
  fetch();
  const sub = supabase.channel(`linked_user:${booking.linkedUserId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${booking.linkedUserId}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(sub);
}, [booking?.linkedUserId]);
```

All write operations (updateDoc -> supabase update):
```javascript
// Example: update booking stage
const { error } = await supabase.from('bookings').update({ stage: newStage, updated_at: new Date().toISOString() }).eq('id', bookingId);
// Example: add activity log entry
await supabase.from('booking_activity_log').insert({ booking_id: bookingId, type: 'stage_change', message: `Stage advanced to "${newStage}"`, actor_id: adminUid, actor_name: adminName });
// Example: update payment
const { error } = await supabase.from('booking_payments').update({ status: 'Paid', received_amount: amount, paid_date: new Date().toISOString() }).eq('id', paymentId);
```

For runTransaction equivalents (atomic parking slot + booking update), use Vercel API route.

---

### 7.10 src/pages/Admin/Login.jsx

Replace Firebase direct import with useAuth from AuthContext:
```javascript
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function AdminLogin() {
  const { signIn, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      navigate('/admin/dashboard');
    } catch (error) {
      // Error already toasted by signIn
    }
  };
  // ... rest of JSX unchanged
}
```

---

### 7.11 StageAdvanceModal, CancelBookingModal, ReleaseParkingModal, AddParkingModal, ChangeParkingModal

These modals write to Firestore via runTransaction or updateDoc. Replace pattern for each:

For simple updates (non-atomic):
- Replace all updateDoc -> supabase.from(table).update({...}).eq('id', id)
- Replace all addDoc -> supabase.from(table).insert({...})

For atomic operations involving multiple tables (e.g., parking inventory + booking update), create a Supabase RPC function:
```sql
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
```

Then call from frontend:
```javascript
const { error } = await supabase.rpc('release_parking_slot', {
  p_booking_id: bookingId, p_parking_slot: parkingSlot,
  p_property_id: propertyId, p_actor_id: adminUid, p_actor_name: adminName
});
```

Create similar RPC functions for: add_parking_slot, change_parking_slot, cancel_booking, change_unit.

---

## Phase 8: Public Pages Changes

### 8.1 src/pages/Contact.jsx

Replace addDoc:
```javascript
const { error } = await supabase.from('inquiries').insert({
  name: formData.name, email: formData.email, phone: formData.phone,
  inquiry_type: formData.inquiryType, message: formData.message,
  property_name: propertyParam ? formatPropertyName(propertyParam) : null,
  source: propertyParam ? 'Property Page' : 'Contact Form',
  status: 'Unread',
});
if (error) throw error;
```

### 8.2 src/pages/Home.jsx (newsletter subscribe)

Find the newsletter form handler and replace addDoc:
```javascript
const { error } = await supabase.from('newsletter_subscribers').insert({ email: newsletterEmail, status: 'Active' });
if (error) {
  if (error.code === '23505') { toast.info('You are already subscribed!'); return; }
  throw error;
}
toast.success('Subscribed successfully!');
```

### 8.3 src/pages/Booking.jsx

Replace all addDoc/setDoc for booking requests:
```javascript
const { error } = await supabase.from('booking_requests').insert({
  property_id: propertyId, property_name: propertyName,
  linked_user_id: authUser?.id || null,
  client_name: formData.name, client_email: formData.email,
  client_phone: formData.phone, unit_type: formData.unitType,
  message: formData.message, status: 'Pending',
});
if (error) throw error;
```

### 8.4 src/pages/Dashboard/Overview.jsx

```javascript
useEffect(() => {
  if (!authUser) return;
  const fetch = async () => {
    const { data } = await supabase.from('bookings').select('*').eq('linked_user_id', authUser.id).order('created_at', { ascending: false });
    setBookings((data || []).map(mapBookingFromDB));
    setLoading(false);
  };
  fetch();
  const sub = supabase.channel(`user_bookings:${authUser.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `linked_user_id=eq.${authUser.id}` }, fetch)
    .subscribe();
  return () => supabase.removeChannel(sub);
}, [authUser?.id]);
```

### 8.5 src/pages/Dashboard/BookingDetail.jsx

```javascript
const { data: bookingData } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
const booking = mapBookingFromDB(bookingData);
const { data: paymentsData } = await supabase.from('booking_payments').select('*').eq('booking_id', bookingId).order('created_at', { ascending: true });
const payments = (paymentsData || []).map(mapPaymentFromDB);
```

### 8.6 src/pages/Dashboard/EditProfileModal.jsx

Avatar upload:
```javascript
import { uploadMedia } from '../../utils/supabaseStorage';
// Replace Cloudinary upload with:
const publicUrl = await uploadMedia(file, 'avatar', authUser.id);
// Then save to profile:
await updateUserProfileData({ avatar: publicUrl });
```

---

## Phase 9: Vercel API Routes

Create an api/ directory at project root (same level as src/).

### api/deleteMedia.js (replaces functions/api/deleteMedia.js)

```javascript
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: 'URL is required' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server missing Supabase credentials' });
  }

  if (!url.includes(supabaseUrl)) {
    return res.status(400).json({ error: 'Not a valid Supabase storage URL' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/object/public/');
    if (pathParts.length < 2) return res.status(400).json({ error: 'Could not parse Supabase storage URL' });

    const [bucket, ...fileParts] = pathParts[1].split('/');
    const filePath = decodeURIComponent(fileParts.join('/'));

    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ result: 'ok' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
```

---

## Phase 10: Vite Config Update

Replace entire vite.config.js:
```javascript
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
});
```

Note: Remove the entire localCloudflareApiPlugin. For local dev, run: vercel dev

---

## Phase 11: vercel.json Configuration

Create vercel.json at project root:
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

The rewrite is CRITICAL for React Router. Without it, direct URL access to /admin/dashboard returns 404.

---

## Phase 12: Vercel Deployment

Install Vercel CLI and deploy:
```bash
npm install -g vercel
vercel login
vercel --prod
```

Set environment variables in Vercel Dashboard, Project Settings, Environment Variables:

| Variable | Environments |
|---|---|
| VITE_SUPABASE_URL | Production, Preview, Development |
| VITE_SUPABASE_ANON_KEY | Production, Preview, Development |
| SUPABASE_SERVICE_ROLE_KEY | Production, Preview, Development |

CRITICAL: SUPABASE_SERVICE_ROLE_KEY must NOT have VITE_ prefix. If it starts with VITE_ it gets bundled into client JS and exposed publicly.

---

## Phase 13: Domain Configuration (Cloudflare DNS pointing to Vercel)

You bought the domain on Cloudflare but are NOT using Cloudflare Pages anymore. Here is the exact procedure:

Step 1 - In Vercel Dashboard:
1. Go to your project, Settings, Domains
2. Add viridiannexus.com and www.viridiannexus.com
3. Vercel will show you the DNS records to create

Step 2 - In Cloudflare Dashboard (cloudflare.com):
1. Go to your domain, DNS, Records
2. DELETE any existing A record for @ (apex) and CNAME for www
3. ADD the records Vercel provided:
   - A record: Name=@, Content=76.76.21.21, Proxy status=DNS only (grey cloud)
   - CNAME record: Name=www, Content=cname.vercel-dns.com, Proxy status=DNS only (grey cloud)

CRITICAL WARNING: Proxy status MUST be set to DNS only (grey cloud), NOT the orange Cloudflare proxy cloud. If you leave Cloudflare proxy enabled, Vercel cannot issue SSL certificates and your site will show SSL errors.

Step 3 - SSL: Vercel auto-issues Let's Encrypt SSL within minutes of DNS propagation. No action needed.

---

## Phase 14: Data Migration Strategy

### Export Firestore Data
Use Firebase Console, Firestore, Export to get JSON files.
Or use firebase-admin in a Node.js script to export collections.

### Transform and Import
For each collection, transform camelCase to snake_case and insert to Supabase.
Use Supabase Dashboard, Table Editor for small datasets.
For large datasets, use the Supabase REST API or a migration script.

### User Migration
Firebase Auth users cannot be silently migrated to Supabase because they use different password hashing (Firebase: scrypt, Supabase: bcrypt).

Recommended approach for this project:
1. Create admin accounts manually in Supabase Auth
2. Display a prominent banner to existing users: "We have upgraded our platform. Please create a new account - your booking history will be linked by email."
3. Import all non-auth data (bookings, wishlist, etc.) and link by email address

---

## Phase 15: Global Search and Replace Checklist

Run these find-and-replace operations across all files:

| Find | Replace With |
|---|---|
| from '../firebase' | from '../supabase' |
| from '../../firebase' | from '../../supabase' |
| from '../utils/cloudinary' | from '../utils/supabaseStorage' |
| from '../../utils/cloudinary' | from '../../utils/supabaseStorage' |
| deleteCloudinaryMedia | deleteMedia |
| deleteCloudinaryMediaBeacon | deleteMediaBeacon |
| import.meta.env.VITE_CLOUDINARY | (remove entire expression) |
| .toDate() | (ISO string - use new Date(field)) |
| .seconds * 1000 | (use new Date(field).getTime()) |
| serverTimestamp() | new Date().toISOString() |
| cloudinary.com | supabase.co (in URL checks) |
| firebasestorage | (remove - no longer used) |

---

## Phase 16: Files to Delete After Migration

- src/firebase.js
- src/utils/cloudinary.js
- functions/ directory (entire folder - Cloudflare Pages Functions)
- firestore.rules
- All VITE_FIREBASE_* entries from .env
- All CLOUDINARY_* and VITE_CLOUDINARY_* entries from .env
- postcss.config.js and tailwind.config.js references if Cloudinary config was there

---

## Phase 17: Edge Case Testing Checklist

### Authentication
- Sign up creates profile in profiles table via DB trigger
- Email verification email arrives and redirect works
- Password reset email arrives, redirect goes to /auth?reset=true, user can set new password
- Banned user gets signed out immediately via realtime profile listener (test by banning from another admin session)
- Admin login (role=admin) redirects to /admin/dashboard
- Super admin login redirects to /admin/dashboard
- Regular user logging in via /admin route gets redirected to /
- User with authLoading=true sees spinner, never flashes wrong content

### Property Management
- Create new property with auto-generated slug (name with spaces becomes kebab-case)
- Edit existing property loads all JSONB fields: images, inventory, parkingInventory, availableUnits, milestones
- Gallery: upload multiple files, verify all appear, drag to reorder, remove one image
- Brochure PDF upload goes to brochures bucket, old brochure gets deleted
- Hero/map/floorPlan/video upload goes to property-media bucket
- Unsaved changes guard: navigate away without saving triggers warning dialog
- Orphan cleanup: upload image then navigate away without saving, verify the image is cleaned up via beacon
- Delete property: all Supabase Storage files deleted AND properties row deleted
- Property types: add custom type, save, refresh page, verify it persists. Remove type, verify it disappears.

### Booking Management (Admin)
- All 8 stages advance correctly with gate validation (EOI > Token Paid requires token payment)
- Stage rollback from later stage to earlier allowed by admin
- Payment ledger: add payment entry, mark as Paid, mark as Waived, partial amount
- Cancel booking marks status=Cancelled and logs to activity log
- Change unit within same property updates inventory atomically
- Add parking slot: marks slot as Reserved in parking_inventory
- Change parking slot: releases old slot, reserves new slot atomically
- Release parking slot: slot becomes Available in inventory
- Profile sync: when linked user changes displayName, admin sees yellow diff banner and can sync it to booking
- Activity log records every admin action with correct actor name
- Custom payment entry modal

### User Dashboard
- User can ONLY see their own bookings (test by trying to access another user's booking ID directly)
- Booking detail page shows payment ledger correctly (Postgres join via booking_payments table)
- Wishlist: add property, remove property, persists across browser refresh
- Edit profile: update name, phone, avatar upload goes to avatars bucket
- Email change shows info toast about verification, does NOT immediately change the displayed email
- Notifications appear in real time when admin triggers action, mark all read clears badge

### Public Pages
- Contact form submits to inquiries table, admin sees it in Messages panel immediately
- Newsletter subscribe: first subscribe succeeds, second subscribe with same email shows already subscribed toast
- Booking request form saves to booking_requests table, appears in admin booking requests panel

### Admin Panel General
- Dashboard KPIs update live: total users, active properties, total booking value
- Messages: mark read changes icon and highlight, mark unread reverses, delete removes row
- Newsletter: list shows all subscribers, remove subscriber deletes from DB
- User Manager: search by name/email/phone works, ban user, unban user, change role user to admin and back
- Site Settings: only super_admin can save (admin sees read-only banner, Save button disabled)
- Admin accessing /admin/users with role=admin (not super_admin) sees Permission Denied screen
- Admin accessing /admin/settings with role=admin sees read-only view

### Deployment
- Direct URL access to /admin/dashboard returns the app (not 404) - tests vercel.json rewrite
- Direct URL access to /property/my-property returns the app
- API route /api/deleteMedia accepts POST and returns 200 for valid Supabase URLs
- SSL certificate valid on viridiannexus.com and www.viridiannexus.com
- www.viridiannexus.com redirects to viridiannexus.com (or vice versa)

---

## Recommended Implementation Order

1. Supabase: Create project, run SQL schema, run RLS, run DB trigger
2. Supabase: Create 4 storage buckets with policies
3. Supabase: Configure Auth (site URL, redirect URLs)
4. Code: npm uninstall firebase && npm install @supabase/supabase-js
5. Code: Create src/supabase.js
6. Code: Create src/utils/mappers.js
7. Code: Create src/utils/supabaseStorage.js
8. Code: Rewrite src/context/AuthContext.jsx
9. Code: Rewrite src/context/GlobalState.jsx
10. Code: Rewrite src/hooks/usePropertyTypes.js
11. Code: Update all Admin pages (16 files)
12. Code: Update public pages (Contact, Home, Booking, Dashboard/*)
13. Code: Create api/deleteMedia.js
14. Code: Update vite.config.js (remove cloudflare plugin)
15. Code: Create vercel.json
16. Code: Update .env (remove Firebase/Cloudinary, add Supabase vars)
17. Vercel: Deploy with vercel --prod
18. Vercel: Add environment variables in dashboard
19. DNS: Update Cloudflare DNS records (grey cloud, not orange)
20. SQL: Create super admin user and set role
21. Data: Export Firestore data and import to Supabase
22. Test: Run all edge case tests from checklist above
