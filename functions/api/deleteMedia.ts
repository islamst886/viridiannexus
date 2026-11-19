interface CloudflareEnv {
  VITE_CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_KEY?: string;
  VITE_CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_API_SECRET?: string;
  VITE_CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_CLOUD_NAME?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

interface CloudflareEventContext {
  request: Request;
  env: CloudflareEnv;
}

interface SupabaseAuthUserResponse {
  id?: string;
  last_sign_in_at?: string | null;
}

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

interface ProfileRoleRow {
  role?: string;
  is_banned?: boolean;
}

function jsonResponse(payload: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json;charset=UTF-8' },
  });
}

function parseValidatedCloudinaryUrl(
  rawUrl: string,
  cloudName: string
): { resourceType: 'image' | 'video' | 'raw'; publicId: string } | null {
  try {
    const parsed = new URL(rawUrl.trim());
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
      return null;
    }

    const host = parsed.hostname.toLowerCase();
    if (host !== 'res.cloudinary.com' && !host.endsWith('.cloudinary.com')) {
      return null;
    }

    if (!parsed.pathname.startsWith(`/${cloudName}/`)) {
      return null;
    }

    let resourceType: 'image' | 'video' | 'raw' = 'image';
    if (parsed.pathname.includes('/video/upload/')) {
      resourceType = 'video';
    } else if (parsed.pathname.includes('/raw/upload/')) {
      resourceType = 'raw';
    } else if (!parsed.pathname.includes('/image/upload/')) {
      return null;
    }

    const match = /\/upload\/(?:v\d+\/)?([^.]+)/.exec(parsed.pathname);
    if (!match || !match[1]) {
      return null;
    }

    const publicId = decodeURIComponent(match[1]);
    if (
      !publicId ||
      publicId.startsWith('/') ||
      publicId.includes('..') ||
      publicId.includes('\\') ||
      publicId.includes('\0') ||
      !/^[a-zA-Z0-9_/-]+$/.test(publicId)
    ) {
      return null;
    }

    return { resourceType, publicId };
  } catch {
    return null;
  }
}

async function verifyAdminRequest(
  request: Request,
  env: CloudflareEnv
): Promise<{ authorized: true } | { authorized: false; response: Response }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Authorization token required' }, 401),
    };
  }
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Authorization token required' }, 401),
    };
  }

  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '')
    .trim()
    .replace(/\/+(?:rest|auth|storage|realtime)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
  const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  const anonKey = (env.VITE_SUPABASE_ANON_KEY || '').trim();
  const apiKey = serviceRoleKey || anonKey;

  if (!supabaseUrl || !apiKey) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Server missing authentication configuration' }, 500),
    };
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: apiKey,
    },
  });

  if (!userRes.ok) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Invalid or expired authorization token' }, 401),
    };
  }

  const userData = (await userRes.json()) as SupabaseAuthUserResponse;
  if (!userData.id) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Invalid or expired authorization token' }, 401),
    };
  }

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userData.id)}&select=role,is_banned`,
    {
      headers: {
        Authorization: `Bearer ${serviceRoleKey || token}`,
        apikey: apiKey,
      },
    }
  );

  if (!profileRes.ok) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Failed to verify permissions' }, 403),
    };
  }

  const rows = (await profileRes.json()) as ProfileRoleRow[];
  const profile = rows[0];
  if (
    !profile ||
    profile.is_banned ||
    (profile.role !== 'admin' && profile.role !== 'super_admin')
  ) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Admin privileges required' }, 403),
    };
  }

  const sessionActive = await isServerSessionActive(
    supabaseUrl,
    apiKey,
    token,
    userData.last_sign_in_at
  );
  if (!sessionActive) {
    return {
      authorized: false,
      response: jsonResponse({ error: 'Session expired. Please sign in again.' }, 401),
    };
  }

  return { authorized: true };
}

export async function onRequestPost(context: CloudflareEventContext): Promise<Response> {
  try {
    const authCheck = await verifyAdminRequest(context.request, context.env);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    let body: { url?: unknown };
    try {
      body = (await context.request.json()) as { url?: unknown };
    } catch {
      return jsonResponse({ error: 'Invalid JSON request body' }, 400);
    }

    const url = body?.url;
    if (typeof url !== 'string' || !url.trim()) {
      return jsonResponse({ error: 'Valid Cloudinary URL required' }, 400);
    }

    const rawApiKey = context.env.VITE_CLOUDINARY_API_KEY || context.env.CLOUDINARY_API_KEY;
    const rawApiSecret =
      context.env.VITE_CLOUDINARY_API_SECRET || context.env.CLOUDINARY_API_SECRET;
    const rawCloudName =
      context.env.VITE_CLOUDINARY_CLOUD_NAME || context.env.CLOUDINARY_CLOUD_NAME;

    const apiKey = rawApiKey ? rawApiKey.trim() : '';
    const apiSecret = rawApiSecret ? rawApiSecret.trim() : '';
    const cloudName = rawCloudName ? rawCloudName.trim() : '';

    if (!apiKey || !apiSecret || !cloudName) {
      return jsonResponse({ error: 'Server missing Cloudinary credentials' }, 500);
    }

    const parsed = parseValidatedCloudinaryUrl(url, cloudName);
    if (!parsed) {
      return jsonResponse({ error: 'Valid Cloudinary URL required' }, 400);
    }

    const timestamp = Math.round(Date.now() / 1000);
    const strToSign = `public_id=${parsed.publicId}&timestamp=${timestamp}${apiSecret}`;

    const buffer = new TextEncoder().encode(strToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/${parsed.resourceType}/destroy`;

    const formData = new URLSearchParams();
    formData.append('public_id', parsed.publicId);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const response = await fetch(cloudinaryUrl, {
      method: 'POST',
      body: formData,
    });

    const result = (await response.json()) as Record<string, unknown>;
    return jsonResponse(result, response.status);
  } catch (error) {
    console.error('[functions/api/deleteMedia] Unexpected error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}
