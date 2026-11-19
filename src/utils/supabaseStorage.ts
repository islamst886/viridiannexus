import { getCachedAccessToken, supabase } from '../supabase';
import { parseSupabaseStorageUrl } from './urlHelpers';

export type MediaType =
  | 'hero'
  | 'map'
  | 'floorPlan'
  | 'video'
  | 'gallery'
  | 'brochure'
  | 'milestone'
  | 'avatar';

const BUCKET_MAP: Record<string, string> = {
  hero: 'property-media',
  map: 'property-media',
  floorPlan: 'property-media',
  video: 'property-media',
  gallery: 'property-media',
  brochure: 'brochures',
  milestone: 'milestones',
  avatar: 'avatars',
};

export const MAX_SUPABASE_FILE_SIZE = 50 * 1024 * 1024; // 50MB Supabase hard limit

/**
 * Uploads a file to Supabase Storage and returns its public URL.
 */
export const uploadMedia = async (
  file: File,
  mediaType: MediaType | string,
  prefix = ''
): Promise<string> => {
  if (file && file.size > MAX_SUPABASE_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `File size (${sizeMB}MB) exceeds the 50MB storage limit. For large documents like brochures, please compress the file or link it via Google Drive/Dropbox.`
    );
  }

  const bucket = BUCKET_MAP[mediaType] || 'property-media';
  const timestamp = Date.now();
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const sanitizedPrefix = prefix
    .replace(/[^a-zA-Z0-9/_-]/g, '_')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');

  const path = sanitizedPrefix
    ? `${sanitizedPrefix}/${mediaType}_${timestamp}_${sanitizedName}`
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
 */
export const deleteMedia = async (url: string | null | undefined): Promise<boolean> => {
  if (!url) return true;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    console.warn('[deleteMedia] Skipping — Supabase URL not configured');
    return true;
  }

  let sameOrigin = false;
  try {
    sameOrigin = new URL(url.trim()).origin === new URL(supabaseUrl).origin;
  } catch {
    sameOrigin = false;
  }

  // Skip non-Supabase URLs silently (e.g. old Cloudinary or Unsplash placeholders)
  if (!sameOrigin) {
    console.warn('[deleteMedia] Skipping non-Supabase URL:', url);
    return true;
  }

  const parsed = parseSupabaseStorageUrl(url, supabaseUrl);
  if (!parsed) {
    console.warn('[deleteMedia] Could not parse or validate Supabase URL:', url);
    return false;
  }

  try {
    const { error } = await supabase.storage.from(parsed.bucket).remove([parsed.filePath]);
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
 * Keepalive cleanup deletion for page unload / component unmount.
 * Calls /api/deleteMedia with the user's Bearer JWT token so authenticated
 * admin authorization succeeds even during teardown.
 */
export const deleteMediaBeacon = (url: string | null | undefined): void => {
  if (!url || typeof fetch === 'undefined') return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (supabaseUrl && !parseSupabaseStorageUrl(url, supabaseUrl)) {
    return;
  }

  try {
    const token = getCachedAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    void fetch('/api/deleteMedia', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
      keepalive: true,
    });
  } catch (err) {
    console.error('[deleteMediaBeacon] Error:', err);
  }
};
