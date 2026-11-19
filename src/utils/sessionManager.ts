// src/utils/sessionManager.ts — Enterprise session lifecycle, inactivity, and absolute timeout controls

export const USER_IDLE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days of inactivity
export const ADMIN_IDLE_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2 hours of inactivity
export const USER_MAX_SESSION_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days absolute max
export const ADMIN_MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours absolute max
export const IDLE_WARNING_WINDOW_MS = 2 * 60 * 1000; // Warn 2 minutes before idle sign-out
export const ACTIVITY_THROTTLE_MS = 15 * 1000; // Persist activity heartbeat every 15 seconds
export const SESSION_CHECK_INTERVAL_MS = 15 * 1000; // Check expiration every 15 seconds

export const SESSION_META_STORAGE_KEY = 'vn_session_meta_v1';
export const SESSION_LOGOUT_EVENT_KEY = 'vn_session_logout_v1';
const AUTH_TRANSITION_WINDOW_MS = 15 * 1000;

let authTransitionStartedAt = 0;

export function beginAuthTransition(now = Date.now()): void {
  authTransitionStartedAt = now;
}

export function isAuthTransitionActive(now = Date.now()): boolean {
  return authTransitionStartedAt > 0 && now - authTransitionStartedAt <= AUTH_TRANSITION_WINDOW_MS;
}

export function clearAuthTransition(): void {
  authTransitionStartedAt = 0;
}

export type SessionExpirationReason = 'idle' | 'max_age' | 'revoked';

export interface SessionPolicy {
  idleTimeoutMs: number;
  maxSessionAgeMs: number;
  isPrivileged: boolean;
}

export interface StoredSessionMeta {
  userId: string;
  sessionKey: string;
  startedAt: number;
  lastActivityAt: number;
}

export interface SessionUserLike {
  id?: string | null;
  last_sign_in_at?: string | null;
}

export interface SessionLike {
  access_token?: string | null;
  user?: SessionUserLike | null;
}

export interface SessionIdentity {
  userId: string;
  sessionKey: string;
  serverSignInAt: number | null;
}

export interface SessionEvaluation {
  valid: boolean;
  reason?: SessionExpirationReason;
  remainingIdleMs: number;
  remainingMaxAgeMs: number;
  shouldWarnIdle: boolean;
}

export function isPrivilegedRole(role: string | null | undefined): boolean {
  const normalized = typeof role === 'string' ? role.trim().toLowerCase() : '';
  return normalized === 'admin' || normalized === 'super_admin';
}

export function getSessionPolicy(role: string | null | undefined): SessionPolicy {
  const isPrivileged = isPrivilegedRole(role);
  return {
    idleTimeoutMs: isPrivileged ? ADMIN_IDLE_TIMEOUT_MS : USER_IDLE_TIMEOUT_MS,
    maxSessionAgeMs: isPrivileged ? ADMIN_MAX_SESSION_AGE_MS : USER_MAX_SESSION_AGE_MS,
    isPrivileged,
  };
}

function decodeBase64UrlJson(segment: string): Record<string, unknown> | null {
  try {
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);

    let binary: string;
    if (typeof atob === 'function') {
      binary = atob(padded);
    } else if (typeof Buffer !== 'undefined') {
      binary = Buffer.from(padded, 'base64').toString('binary');
    } else {
      return null;
    }

    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const jsonText = new TextDecoder().decode(bytes);
    const parsed: unknown = JSON.parse(jsonText);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function extractSessionIdFromJwt(accessToken: unknown): string | null {
  if (!accessToken || typeof accessToken !== 'string') return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  const payload = decodeBase64UrlJson(parts[1]);
  const sessionId = payload?.session_id;
  return typeof sessionId === 'string' && sessionId.trim() ? sessionId.trim() : null;
}

export function deriveSessionIdentity(
  session: SessionLike | null | undefined
): SessionIdentity | null {
  const userId = session?.user?.id;
  if (!userId || typeof userId !== 'string') return null;

  const rawSignIn = session?.user?.last_sign_in_at;
  const parsedSignIn = typeof rawSignIn === 'string' && rawSignIn ? Date.parse(rawSignIn) : Number.NaN;
  const serverSignInAt = Number.isFinite(parsedSignIn) ? parsedSignIn : null;

  const jwtSessionId = extractSessionIdFromJwt(session?.access_token);
  const sessionKey = jwtSessionId || `${userId}:${rawSignIn || 'default'}`;

  return {
    userId,
    sessionKey,
    serverSignInAt,
  };
}

export function evaluateSessionValidity({
  meta,
  role,
  serverSignInAt,
  now = Date.now(),
}: {
  meta: StoredSessionMeta | null | undefined;
  role?: string | null;
  serverSignInAt?: number | null;
  now?: number;
}): SessionEvaluation {
  const policy = getSessionPolicy(role);

  if (!meta || !Number.isFinite(meta.startedAt) || !Number.isFinite(meta.lastActivityAt)) {
    return {
      valid: false,
      reason: 'revoked',
      remainingIdleMs: 0,
      remainingMaxAgeMs: 0,
      shouldWarnIdle: false,
    };
  }

  // Anchor session start to the earliest known authentication timestamp so clearing
  // client storage cannot extend an already-aged Supabase session.
  const effectiveStartedAt =
    typeof serverSignInAt === 'number' && Number.isFinite(serverSignInAt)
      ? Math.min(meta.startedAt, serverSignInAt)
      : meta.startedAt;

  const elapsedAgeMs = Math.max(0, now - effectiveStartedAt);
  const remainingMaxAgeMs = Math.max(0, policy.maxSessionAgeMs - elapsedAgeMs);

  if (elapsedAgeMs >= policy.maxSessionAgeMs) {
    return {
      valid: false,
      reason: 'max_age',
      remainingIdleMs: 0,
      remainingMaxAgeMs: 0,
      shouldWarnIdle: false,
    };
  }

  const elapsedIdleMs = Math.max(0, now - meta.lastActivityAt);
  const remainingIdleMs = Math.max(0, policy.idleTimeoutMs - elapsedIdleMs);

  if (elapsedIdleMs >= policy.idleTimeoutMs) {
    return {
      valid: false,
      reason: 'idle',
      remainingIdleMs: 0,
      remainingMaxAgeMs,
      shouldWarnIdle: false,
    };
  }

  return {
    valid: true,
    remainingIdleMs,
    remainingMaxAgeMs,
    shouldWarnIdle: remainingIdleMs <= IDLE_WARNING_WINDOW_MS,
  };
}

function getSafeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readStoredSessionMeta(): StoredSessionMeta | null {
  const storage = getSafeLocalStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(SESSION_META_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;

    const candidate = parsed as Record<string, unknown>;
    if (
      typeof candidate.userId !== 'string' ||
      typeof candidate.sessionKey !== 'string' ||
      typeof candidate.startedAt !== 'number' ||
      !Number.isFinite(candidate.startedAt) ||
      typeof candidate.lastActivityAt !== 'number' ||
      !Number.isFinite(candidate.lastActivityAt)
    ) {
      return null;
    }

    return {
      userId: candidate.userId,
      sessionKey: candidate.sessionKey,
      startedAt: candidate.startedAt,
      lastActivityAt: candidate.lastActivityAt,
    };
  } catch {
    return null;
  }
}

export function writeStoredSessionMeta(meta: StoredSessionMeta): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(SESSION_META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // Ignore storage quota or private-browsing errors
  }
}

export function clearStoredSessionMeta(): void {
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.removeItem(SESSION_META_STORAGE_KEY);
  } catch {
    // Ignore storage access errors
  }
}

export function broadcastSessionLogout(reason: SessionExpirationReason | 'manual'): void {
  clearStoredSessionMeta();
  const storage = getSafeLocalStorage();
  if (!storage) return;

  try {
    storage.setItem(
      SESSION_LOGOUT_EVENT_KEY,
      JSON.stringify({ reason, at: Date.now() })
    );
  } catch {
    // Ignore storage access errors
  }
}

export function syncSessionMetaOnAuth({
  session,
  now = Date.now(),
  isExplicitLogin = false,
}: {
  session: SessionLike | null | undefined;
  now?: number;
  isExplicitLogin?: boolean;
}): StoredSessionMeta | null {
  const identity = deriveSessionIdentity(session);
  if (!identity) {
    clearStoredSessionMeta();
    return null;
  }

  if (isExplicitLogin) {
    const fresh: StoredSessionMeta = {
      userId: identity.userId,
      sessionKey: identity.sessionKey,
      startedAt: now,
      lastActivityAt: now,
    };
    writeStoredSessionMeta(fresh);
    return fresh;
  }

  const existing = readStoredSessionMeta();
  if (
    existing &&
    existing.userId === identity.userId &&
    existing.sessionKey === identity.sessionKey
  ) {
    return existing;
  }

  // First time tracking an already-persisted Supabase session (e.g. created days/months ago
  // before client timeout tracking existed): anchor both start and activity to server sign-in time
  // so legacy sessions expire immediately on load rather than getting a fresh lease.
  const anchorTimestamp = identity.serverSignInAt ?? now;
  const seeded: StoredSessionMeta = {
    userId: identity.userId,
    sessionKey: identity.sessionKey,
    startedAt: anchorTimestamp,
    lastActivityAt: anchorTimestamp,
  };
  writeStoredSessionMeta(seeded);
  return seeded;
}

export function touchStoredSessionActivity(expectedUserId: string, now = Date.now()): boolean {
  const existing = readStoredSessionMeta();
  if (!existing || existing.userId !== expectedUserId) return false;
  if (now <= existing.lastActivityAt) return true;

  writeStoredSessionMeta({
    ...existing,
    lastActivityAt: now,
  });
  return true;
}

export function getSessionExpirationMessage(
  reason: string | null | undefined,
  isPrivileged = false
): string {
  if (reason === 'idle') {
    const windowLabel = isPrivileged ? '2 hours' : '7 days';
    return `Your session expired after ${windowLabel} of inactivity. Please sign in again.`;
  }
  if (reason === 'max_age') {
    const windowLabel = isPrivileged ? '24 hours' : '14 days';
    return `For your security, sessions require re-authentication every ${windowLabel}. Please sign in again.`;
  }
  return 'Your session is no longer active. Please sign in again.';
}
