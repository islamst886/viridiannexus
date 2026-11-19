/**
 * Sanitizes and normalizes external URLs to ensure they have a valid, safe HTTP(S) scheme.
 * Blocks dangerous schemes (javascript:, data:, vbscript:, file:, blob:, etc.),
 * embedded credentials (user:pass@host), and control characters.
 */
export function normalizeExternalUrl(url: unknown): string {
  if (!url || typeof url !== 'string') return '';

  const trimmed = url.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!trimmed) return '';

  if (/^(javascript|data|vbscript|file|blob|about):/i.test(trimmed)) {
    return '';
  }

  let candidate: string;
  if (/^https?:\/\//i.test(trimmed)) {
    candidate = trimmed;
  } else if (trimmed.startsWith('//')) {
    candidate = `https:${trimmed}`;
  } else if (
    /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) &&
    !/^[a-zA-Z0-9.-]+:\d+(?:[/?#]|$)/.test(trimmed)
  ) {
    // Reject non-HTTP(S) schemes such as ftp:, mailto:, tel:, etc.
    return '';
  } else {
    candidate = `https://${trimmed}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    if (!parsed.hostname || parsed.username || parsed.password) {
      return '';
    }
    return candidate;
  } catch {
    return '';
  }
}

const YOUTUBE_HOSTNAMES = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
]);

const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/**
 * Extracts and validates a YouTube video ID from common YouTube URL formats and
 * returns a strict embed URL (`https://www.youtube.com/embed/<id>`), or `''` if invalid.
 */
export function getYouTubeEmbedUrl(url: unknown): string {
  const normalized = normalizeExternalUrl(url);
  if (!normalized) return '';

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!YOUTUBE_HOSTNAMES.has(host)) {
      return '';
    }

    let videoId: string | null = null;
    if (host === 'youtu.be' || host === 'www.youtu.be') {
      videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
    } else if (parsed.pathname === '/watch') {
      videoId = parsed.searchParams.get('v');
    } else {
      const match = /^\/(?:embed|shorts|live|v)\/([a-zA-Z0-9_-]{11})(?:\/|$)/.exec(
        parsed.pathname
      );
      videoId = match ? match[1] : null;
    }

    if (!videoId || !YOUTUBE_VIDEO_ID_RE.test(videoId)) {
      return '';
    }

    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return '';
  }
}

/**
 * Prevents open-redirect attacks by validating that a redirect target is a strictly
 * relative in-app path (starts with a single `/` and resolves on the same origin).
 */
export function sanitizeRedirectPath(
  rawRedirect: string | null | undefined,
  fallback = '/dashboard'
): string {
  if (!rawRedirect || typeof rawRedirect !== 'string') return fallback;

  const cleaned = rawRedirect.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned || !cleaned.startsWith('/') || cleaned.startsWith('//') || cleaned.includes('\\')) {
    return fallback;
  }

  try {
    const parsed = new URL(cleaned, 'https://app.local');
    if (parsed.origin !== 'https://app.local' || parsed.pathname.startsWith('//')) {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Sanitizes a phone number into a safe `tel:` href, or `''` if invalid.
 */
export function sanitizeTelHref(phone: unknown): string {
  if (!phone || typeof phone !== 'string') return '';
  const cleaned = phone.replace(/[\u0000-\u001f\u007f]/g, '').replace(/[^\d+\-() ]/g, '').trim();
  if (!/\d/.test(cleaned)) return '';
  return `tel:${cleaned.replace(/\s+/g, '')}`;
}

/**
 * Sanitizes an email address into a safe `mailto:` href without header/query injection.
 */
export function sanitizeMailtoHref(email: unknown): string {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!/^[^\s@<>?,;&#]+@[^\s@<>?,;&#]+\.[^\s@<>?,;&#]+$/.test(trimmed)) {
    return '';
  }
  return `mailto:${trimmed}`;
}

export const ALLOWED_STORAGE_BUCKETS = new Set([
  'property-media',
  'brochures',
  'milestones',
  'avatars',
]);

export interface ParsedSupabaseStorageUrl {
  bucket: string;
  filePath: string;
}

/**
 * Parses and strictly validates a Supabase public storage URL against an optional
 * expected Supabase origin, bucket allowlist, and path-traversal checks.
 */
export function parseSupabaseStorageUrl(
  url: unknown,
  expectedSupabaseUrl?: string
): ParsedSupabaseStorageUrl | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }

    if (expectedSupabaseUrl) {
      const expected = new URL(expectedSupabaseUrl);
      if (parsed.origin !== expected.origin) {
        return null;
      }
    }

    const marker = '/storage/v1/object/public/';
    const markerIndex = parsed.pathname.indexOf(marker);
    if (markerIndex === -1) {
      return null;
    }

    const remainder = parsed.pathname.slice(markerIndex + marker.length);
    const slashIndex = remainder.indexOf('/');
    if (slashIndex === -1) {
      return null;
    }

    const bucket = remainder.slice(0, slashIndex);
    const rawFilePath = remainder.slice(slashIndex + 1);

    if (!ALLOWED_STORAGE_BUCKETS.has(bucket) || !rawFilePath) {
      return null;
    }

    const decodedSegments = rawFilePath.split('/').map((seg) => decodeURIComponent(seg));
    if (
      decodedSegments.some(
        (seg) =>
          !seg ||
          seg === '.' ||
          seg === '..' ||
          seg.includes('\\') ||
          seg.includes('\0')
      )
    ) {
      return null;
    }

    return {
      bucket,
      filePath: decodedSegments.join('/'),
    };
  } catch {
    return null;
  }
}

const SUPABASE_API_SUFFIX_RE = /\/+(?:rest|auth|storage|realtime)\/v1\/?$/i;

/**
 * Normalizes a Supabase project base URL by validating http(s) without embedded
 * credentials and stripping accidental API subpaths like /rest/v1 or trailing slashes.
 */
export function normalizeSupabaseUrl(url: unknown): string {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    if (parsed.username || parsed.password) {
      return '';
    }

    parsed.search = '';
    parsed.hash = '';
    const cleanedPath = parsed.pathname
      .replace(SUPABASE_API_SUFFIX_RE, '')
      .replace(/\/+$/, '');

    return `${parsed.origin}${cleanedPath}`;
  } catch {
    return '';
  }
}
