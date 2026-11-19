// src/supabase.ts — Supabase client and cached auth token helpers
import { createClient, type Session } from '@supabase/supabase-js';
import { normalizeSupabaseUrl } from './utils/urlHelpers';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Invalid or missing Supabase environment variables. ' +
    'Set VITE_SUPABASE_URL (e.g. https://<project>.supabase.co) and VITE_SUPABASE_ANON_KEY in your .env file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

let cachedAccessToken: string | null = null;

function updateCachedToken(session: Session | null): void {
  cachedAccessToken = session?.access_token ?? null;
}

void supabase.auth.getSession().then(({ data }) => {
  updateCachedToken(data.session);
});

supabase.auth.onAuthStateChange((_event, session) => {
  updateCachedToken(session);
});

/**
 * Synchronous accessor for the latest JWT access token, used by pagehide/unmount
 * keepalive cleanup requests that cannot await an async getSession() call.
 */
export function getCachedAccessToken(): string | null {
  return cachedAccessToken;
}

export function clearCachedAccessToken(): void {
  cachedAccessToken = null;
}

/**
 * Fetches the current Supabase session JWT access token (or null if unauthenticated).
 */
export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  updateCachedToken(data.session);
  return data.session?.access_token ?? null;
}
