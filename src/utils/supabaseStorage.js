// src/utils/supabaseStorage.js — replaces src/utils/cloudinary.js
import { supabase } from '../supabase';

// Maps mediaType to the correct Supabase bucket
const BUCKET_MAP = {
  hero: 'property-media',
  map: 'property-media',
  floorPlan: 'property-media',
  video: 'property-media',
  gallery: 'property-media',
  brochure: 'brochures',
  milestone: 'milestones',
  avatar: 'avatars',
};

/**
 * Uploads a file to Supabase Storage and returns its public URL.
 *
 * @param {File} file — The File object to upload
 * @param {string} mediaType — One of: hero, map, floorPlan, video, gallery, brochure, milestone, avatar
 * @param {string} [prefix=''] — Optional path prefix (e.g. property slug)
 * @returns {Promise<string>} Public URL of the uploaded file
 */
export const uploadMedia = async (file, mediaType, prefix = '') => {
  const bucket = BUCKET_MAP[mediaType] || 'property-media';
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = prefix
    ? `${prefix}/${mediaType}_${timestamp}_${sanitizedName}`
    : `${mediaType}_${timestamp}_${sanitizedName}`;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: false, cacheControl: '3600' });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(data.path);

  return publicUrl;
};

/**
 * Deletes a file from Supabase Storage using its public URL.
 * Silently skips non-Supabase URLs (e.g. old Cloudinary URLs during transition).
 *
 * @param {string} url — The public URL returned by Supabase Storage
 * @returns {Promise<boolean>}
 */
export const deleteMedia = async (url) => {
  if (!url) return true;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  // Skip non-Supabase URLs silently (e.g. old Cloudinary or Unsplash placeholders)
  if (!supabaseUrl || !url.includes(supabaseUrl)) {
    console.warn('[deleteMedia] Skipping non-Supabase URL:', url);
    return true;
  }

  try {
    // URL format: https://xxx.supabase.co/storage/v1/object/public/{bucket}/{path}
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/object/public/');
    if (pathParts.length < 2) {
      console.warn('[deleteMedia] Could not parse Supabase URL:', url);
      return false;
    }

    const [bucket, ...fileParts] = pathParts[1].split('/');
    const filePath = decodeURIComponent(fileParts.join('/'));

    const { error } = await supabase.storage.from(bucket).remove([filePath]);
    if (error) {
      console.error('[deleteMedia] Storage remove error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[deleteMedia] Unexpected error:', err);
    return false;
  }
};

/**
 * Beacon-based deletion for cleanup on page unload / component unmount.
 * Calls the Vercel /api/deleteMedia serverless route.
 *
 * @param {string} url — The public Supabase Storage URL to delete
 */
export const deleteMediaBeacon = (url) => {
  if (!url || !navigator.sendBeacon) return;
  try {
    const blob = new Blob([JSON.stringify({ url })], { type: 'application/json' });
    navigator.sendBeacon('/api/deleteMedia', blob);
  } catch (err) {
    console.error('[deleteMediaBeacon] Error:', err);
  }
};
