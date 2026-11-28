import { createClient } from '@supabase/supabase-js';
import { getProcessEnv } from '../src/utils/serverEnv.js';

interface ApiRequest {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: { url?: unknown } | string | null;
}

interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (payload: Record<string, unknown>) => unknown;
}

const ALLOWED_BUCKETS = new Set(['property-media', 'brochures', 'milestones', 'avatars']);
const ADMIN_MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

async function isServerSessionActive(
  supabaseUrl: string,
  apiKey: string,
  userToken: string,
  lastSignInAt?: string | null
): Promise<boolean> {
  try {
    const rpcRes = await fetch(`${supabaseUrl}/rest/v1/rpc/is_session_valid`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${userToken}`,
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
    });
    if (rpcRes.ok) {
      return Boolean(await rpcRes.json());
    }
    if (rpcRes.status === 401 || rpcRes.status === 403) {
      return false;
    }
  } catch {
    // Fall back to sign-in timestamp check if RPC is unavailable
  }

  if (lastSignInAt) {
    const signInMs = Date.parse(lastSignInAt);
    if (Number.isFinite(signInMs) && Date.now() - signInMs > ADMIN_MAX_SESSION_AGE_MS) {
      return false;
    }
  }
  return true;
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined> | undefined,
  name: string
): string | null {
  if (!headers) return null;
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (typeof direct === 'string') return direct;
  if (Array.isArray(direct) && direct.length > 0) return direct[0] ?? null;
  return null;
}

function parseValidatedStorageUrl(
  rawUrl: string,
  expectedSupabaseUrl: string
): { bucket: string; filePath: string } | null {
  try {
    const parsed = new URL(rawUrl.trim());
    const expected = new URL(expectedSupabaseUrl);

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (parsed.username || parsed.password) return null;
    if (parsed.origin !== expected.origin) return null;

    const marker = '/storage/v1/object/public/';
    const markerIdx = parsed.pathname.indexOf(marker);
    if (markerIdx === -1) return null;

    const remainder = parsed.pathname.slice(markerIdx + marker.length);
    const slashIdx = remainder.indexOf('/');
    if (slashIdx === -1) return null;

    const bucket = remainder.slice(0, slashIdx);
    const encodedPath = remainder.slice(slashIdx + 1);
    if (!ALLOWED_BUCKETS.has(bucket) || !encodedPath) return null;

    const segments = encodedPath.split('/').map((seg) => decodeURIComponent(seg));
    if (
      segments.some(
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

    return { bucket, filePath: segments.join('/') };
  } catch {
    return null;
  }
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<unknown> {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const env = getProcessEnv();
  const rawSupabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim();
  const supabaseUrl = rawSupabaseUrl
    .replace(/\/+(?:rest|auth|storage|realtime)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const authHeader = getHeaderValue(req.headers, 'authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  let parsedBody: { url?: unknown } = {};
  if (typeof req.body === 'string') {
    try {
      parsedBody = JSON.parse(req.body) as { url?: unknown };
    } catch {
      return res.status(400).json({ error: 'Invalid JSON request body' });
    }
  } else if (req.body && typeof req.body === 'object') {
    parsedBody = req.body;
  }

  const rawUrl = parsedBody.url;
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      return res.status(401).json({ error: 'Invalid or expired authorization token' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, is_banned')
      .eq('id', userData.user.id)
      .single();

    if (
      profileError ||
      !profile ||
      profile.is_banned ||
      (profile.role !== 'admin' && profile.role !== 'super_admin')
    ) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    const sessionActive = await isServerSessionActive(
      supabaseUrl,
      serviceRoleKey,
      token,
      userData.user.last_sign_in_at
    );
    if (!sessionActive) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    const parsedStorage = parseValidatedStorageUrl(rawUrl, supabaseUrl);
    if (!parsedStorage) {
      return res.status(400).json({ error: 'Not a valid Supabase storage URL' });
    }

    const { error } = await supabase.storage
      .from(parsedStorage.bucket)
      .remove([parsedStorage.filePath]);

    if (error) {
      console.error('[api/deleteMedia] Storage remove error:', error);
      return res.status(500).json({ error: 'Failed to delete media' });
    }

    return res.status(200).json({ result: 'ok' });
  } catch (err) {
    console.error('[api/deleteMedia] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
