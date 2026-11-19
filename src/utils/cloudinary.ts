import { getAccessToken, getCachedAccessToken } from '../supabase';

/**
 * Validates that a URL points strictly to a Cloudinary HTTPS asset URL (not a spoofed query/path).
 */
export function isCloudinaryAssetUrl(url: unknown): url is string {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return host === 'res.cloudinary.com' || host.endsWith('.cloudinary.com');
  } catch {
    return false;
  }
}

/**
 * Deletes a media file from Cloudinary via our authenticated backend function.
 * Returns true if successful or skipped (non-Cloudinary URL), false on error.
 */
export const deleteCloudinaryMedia = async (url: string): Promise<boolean> => {
  if (!isCloudinaryAssetUrl(url)) return true;

  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch('/api/deleteMedia', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url }),
    });
    const contentType = res.headers.get('content-type');

    if (!res.ok) {
      if (contentType && contentType.includes('text/html')) {
        console.error(
          "Media deletion API returned HTML (Error 500 or 404). This means the Cloudflare Function failed or doesn't exist. Check your deployment logs."
        );
      } else {
        console.error('Media deletion API error:', await res.text());
      }
      return false;
    }

    return true;
  } catch (err) {
    console.error('Deletion API error:', err);
    return false;
  }
};

/**
 * Keepalive cleanup deletion for unmount or pagehide events.
 * Uses fetch(..., { keepalive: true }) so the Bearer Authorization header is preserved.
 */
export const deleteCloudinaryMediaBeacon = (url: string): void => {
  if (!isCloudinaryAssetUrl(url) || typeof fetch === 'undefined') return;

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
    console.error('Beacon deletion error:', err);
  }
};
