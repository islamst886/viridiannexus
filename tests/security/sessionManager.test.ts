import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ADMIN_IDLE_TIMEOUT_MS,
  ADMIN_MAX_SESSION_AGE_MS,
  IDLE_WARNING_WINDOW_MS,
  USER_IDLE_TIMEOUT_MS,
  USER_MAX_SESSION_AGE_MS,
  deriveSessionIdentity,
  evaluateSessionValidity,
  extractSessionIdFromJwt,
  getSessionExpirationMessage,
  getSessionPolicy,
  syncSessionMetaOnAuth,
  touchStoredSessionActivity,
  type StoredSessionMeta,
} from '../../src/utils/sessionManager';

function createFakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>): string =>
    Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

describe('Enterprise Session Lifecycle & Expiration Controls', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSessionPolicy', () => {
    it('enforces stricter limits for admin and super_admin than standard users', () => {
      expect(getSessionPolicy('user')).toEqual({
        idleTimeoutMs: USER_IDLE_TIMEOUT_MS,
        maxSessionAgeMs: USER_MAX_SESSION_AGE_MS,
        isPrivileged: false,
      });

      expect(getSessionPolicy('admin')).toEqual({
        idleTimeoutMs: ADMIN_IDLE_TIMEOUT_MS,
        maxSessionAgeMs: ADMIN_MAX_SESSION_AGE_MS,
        isPrivileged: true,
      });

      expect(getSessionPolicy('super_admin')).toEqual({
        idleTimeoutMs: ADMIN_IDLE_TIMEOUT_MS,
        maxSessionAgeMs: ADMIN_MAX_SESSION_AGE_MS,
        isPrivileged: true,
      });
    });
  });

  describe('extractSessionIdFromJwt & deriveSessionIdentity', () => {
    it('extracts Supabase session_id and last_sign_in_at from valid session payloads', () => {
      const token = createFakeJwt({ sub: 'user-1', session_id: 'sess-uuid-999' });
      expect(extractSessionIdFromJwt(token)).toBe('sess-uuid-999');

      const identity = deriveSessionIdentity({
        access_token: token,
        user: {
          id: 'user-1',
          last_sign_in_at: '2026-09-01T10:00:00.000Z',
        },
      });

      expect(identity).toEqual({
        userId: 'user-1',
        sessionKey: 'sess-uuid-999',
        serverSignInAt: Date.parse('2026-09-01T10:00:00.000Z'),
      });
    });

    it('returns null on malformed tokens or missing users', () => {
      expect(extractSessionIdFromJwt('not-a-jwt')).toBeNull();
      expect(extractSessionIdFromJwt(null)).toBeNull();
      expect(deriveSessionIdentity(null)).toBeNull();
    });
  });

  describe('evaluateSessionValidity', () => {
    const baseNow = Date.parse('2026-11-14T12:00:00.000Z');

    it('rejects missing or corrupted metadata as revoked', () => {
      expect(evaluateSessionValidity({ meta: null, role: 'user', now: baseNow })).toMatchObject({
        valid: false,
        reason: 'revoked',
      });
    });

    it('immediately expires sessions created 2 months ago even if localStorage was touched', () => {
      const twoMonthsAgo = baseNow - 60 * 24 * 60 * 60 * 1000;
      const meta: StoredSessionMeta = {
        userId: 'user-1',
        sessionKey: 'sess-1',
        startedAt: twoMonthsAgo,
        lastActivityAt: baseNow - 1000, // active 1 second ago
      };

      expect(
        evaluateSessionValidity({ meta, role: 'user', serverSignInAt: twoMonthsAgo, now: baseNow })
      ).toMatchObject({
        valid: false,
        reason: 'max_age',
      });
    });

    it('prevents bypassing max age via client storage tampering when serverSignInAt is older', () => {
      const fifteenDaysAgo = baseNow - 15 * 24 * 60 * 60 * 1000;
      const tamperedMeta: StoredSessionMeta = {
        userId: 'user-1',
        sessionKey: 'sess-1',
        startedAt: baseNow - 60_000, // client pretended session started 1 min ago
        lastActivityAt: baseNow - 1_000,
      };

      expect(
        evaluateSessionValidity({
          meta: tamperedMeta,
          role: 'user',
          serverSignInAt: fifteenDaysAgo,
          now: baseNow,
        })
      ).toMatchObject({
        valid: false,
        reason: 'max_age',
      });
    });

    it('expires standard user sessions after 7 days of inactivity and admin after 2 hours', () => {
      const userIdleMeta: StoredSessionMeta = {
        userId: 'user-1',
        sessionKey: 'sess-u',
        startedAt: baseNow - 8 * 24 * 60 * 60 * 1000,
        lastActivityAt: baseNow - USER_IDLE_TIMEOUT_MS,
      };
      expect(
        evaluateSessionValidity({ meta: userIdleMeta, role: 'user', now: baseNow })
      ).toMatchObject({
        valid: false,
        reason: 'idle',
      });

      const adminIdleMeta: StoredSessionMeta = {
        userId: 'admin-1',
        sessionKey: 'sess-a',
        startedAt: baseNow - 4 * 60 * 60 * 1000,
        lastActivityAt: baseNow - ADMIN_IDLE_TIMEOUT_MS,
      };
      expect(
        evaluateSessionValidity({ meta: adminIdleMeta, role: 'admin', now: baseNow })
      ).toMatchObject({
        valid: false,
        reason: 'idle',
      });
    });

    it('enforces 24-hour absolute max lifetime for admin sessions even during continuous activity', () => {
      const twentyFiveHoursAgo = baseNow - 25 * 60 * 60 * 1000;
      const meta: StoredSessionMeta = {
        userId: 'admin-1',
        sessionKey: 'sess-a',
        startedAt: twentyFiveHoursAgo,
        lastActivityAt: baseNow - 5_000,
      };

      expect(
        evaluateSessionValidity({
          meta,
          role: 'admin',
          serverSignInAt: twentyFiveHoursAgo,
          now: baseNow,
        })
      ).toMatchObject({
        valid: false,
        reason: 'max_age',
      });
    });

    it('flags shouldWarnIdle inside the final 2-minute inactivity window while remaining valid', () => {
      const meta: StoredSessionMeta = {
        userId: 'user-1',
        sessionKey: 'sess-1',
        startedAt: baseNow - 8 * 24 * 60 * 60 * 1000,
        lastActivityAt: baseNow - (USER_IDLE_TIMEOUT_MS - IDLE_WARNING_WINDOW_MS + 10_000),
      };

      const res = evaluateSessionValidity({ meta, role: 'user', now: baseNow });
      expect(res.valid).toBe(true);
      expect(res.shouldWarnIdle).toBe(true);
      expect(res.remainingIdleMs).toBeLessThan(IDLE_WARNING_WINDOW_MS);
    });
  });

  describe('storage sync & messaging helpers', () => {
    it('safely handles environments without window/localStorage', () => {
      expect(syncSessionMetaOnAuth({ session: null })).toBeNull();
      expect(touchStoredSessionActivity('user-1')).toBe(false);
    });

    it('returns accurate security messages for expiration reasons', () => {
      expect(getSessionExpirationMessage('idle', true)).toContain('2 hours');
      expect(getSessionExpirationMessage('idle', false)).toContain('7 days');
      expect(getSessionExpirationMessage('max_age', true)).toContain('24 hours');
      expect(getSessionExpirationMessage('max_age', false)).toContain('14 days');
    });
  });
});
