import { describe, it, expect } from 'vitest';
import {
  NEWSLETTER_MESSAGES,
  classifyNewsletterSubscribeError,
  isDuplicateNewsletterError,
  isValidNewsletterEmail,
  normalizeNewsletterEmail as normalizeProductionEmail,
} from '../../src/utils/newsletter';
import {
  normalizeNewsletterEmail,
  validateNewsletterEmail,
  evaluateNewsletterRLS,
} from '../helpers/newsletterLogic';
import { mockUsers, createMockNewsletterSubscribers } from '../helpers/mockData';

describe('User & High-Net-Worth Investor Newsletter Subsystem (TC-USR)', () => {
  const existingSubscribers = createMockNewsletterSubscribers();

  describe('TC-USR-001: Authenticated Client Email Normalization', () => {
    it('should normalize uppercase and spaced emails from investor profiles', () => {
      const clientEmail = '  Rahim.Chowdhury@Example.COM  ';
      const normalized = normalizeNewsletterEmail(clientEmail);

      expect(normalized).toBe('rahim.chowdhury@example.com');
      expect(normalized).not.toContain(' ');
      expect(normalized).toBe(normalized.toLowerCase());
    });

    it('should successfully validate profile email of registered investor', () => {
      const clientUser = mockUsers.clientUserA;
      const validation = validateNewsletterEmail(clientUser.email);

      expect(validation.valid).toBe(true);
      expect(validation.normalizedEmail).toBe(clientUser.email);
    });

    it('should normalize and validate investor emails with production utility', () => {
      const normalized = normalizeProductionEmail('  Rahim.Chowdhury@Example.COM  ');
      expect(normalized).toBe('rahim.chowdhury@example.com');
      expect(isValidNewsletterEmail(normalized)).toBe(true);
      expect(isValidNewsletterEmail('invalid-email')).toBe(false);
      expect(isValidNewsletterEmail('<script>@example.com')).toBe(false);
      expect(isValidNewsletterEmail('')).toBe(false);
    });
  });

  describe('TC-USR-002: Duplicate Subscription Conflict (Unique Constraint)', () => {
    it('should identify when an email is already present in subscribers directory', () => {
      const existingEmail = 'investor.rahim@example.com';
      const isDuplicate = existingSubscribers.some(
        (s) => s.email.toLowerCase() === existingEmail.toLowerCase()
      );

      expect(isDuplicate).toBe(true);
    });

    it('should classify Supabase Postgres 23505 unique constraint violation as already subscribed', () => {
      const duplicateError = {
        code: '23505',
        details: null,
        hint: null,
        message: 'duplicate key value violates unique constraint "newsletter_subscribers_email_key"',
      };

      expect(isDuplicateNewsletterError(duplicateError)).toBe(true);
      const result = classifyNewsletterSubscribeError(duplicateError);
      expect(result).toEqual({
        status: 'already_subscribed',
        message: NEWSLETTER_MESSAGES.ALREADY_SUBSCRIBED,
      });
    });

    it('should classify HTTP 409 conflicts and duplicate-key messages as already subscribed', () => {
      expect(classifyNewsletterSubscribeError({ status: 409 })).toEqual({
        status: 'already_subscribed',
        message: NEWSLETTER_MESSAGES.ALREADY_SUBSCRIBED,
      });
      expect(
        classifyNewsletterSubscribeError({
          message: 'duplicate key value violates unique constraint "newsletter_subscribers_email_key"',
        })
      ).toEqual({
        status: 'already_subscribed',
        message: NEWSLETTER_MESSAGES.ALREADY_SUBSCRIBED,
      });
    });

    it('should classify non-duplicate errors and invalid inputs as generic errors', () => {
      expect(
        classifyNewsletterSubscribeError({ code: '42501', message: 'row-level security violation' })
      ).toEqual({
        status: 'error',
        message: NEWSLETTER_MESSAGES.GENERIC_ERROR,
      });
      expect(classifyNewsletterSubscribeError(new Error('Network timeout'))).toEqual({
        status: 'error',
        message: NEWSLETTER_MESSAGES.GENERIC_ERROR,
      });
      expect(classifyNewsletterSubscribeError(null)).toEqual({
        status: 'error',
        message: NEWSLETTER_MESSAGES.GENERIC_ERROR,
      });
      expect(classifyNewsletterSubscribeError(undefined)).toEqual({
        status: 'error',
        message: NEWSLETTER_MESSAGES.GENERIC_ERROR,
      });
    });
  });

  describe('TC-USR-003: Cross-Tenant Subscriber Privacy Isolation', () => {
    it('should prohibit regular authenticated client from reading subscriber directories', () => {
      const userCanSelect = evaluateNewsletterRLS('user', 'SELECT');
      const userCanDelete = evaluateNewsletterRLS('user', 'DELETE');
      const userCanUpdate = evaluateNewsletterRLS('user', 'UPDATE');

      expect(userCanSelect).toBe(false);
      expect(userCanDelete).toBe(false);
      expect(userCanUpdate).toBe(false);
    });

    it('should permit authenticated client to insert their subscription', () => {
      const userCanInsert = evaluateNewsletterRLS('user', 'INSERT');
      expect(userCanInsert).toBe(true);
    });
  });
});
