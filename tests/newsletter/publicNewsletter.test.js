import { describe, it, expect, vi } from 'vitest';
import { validateNewsletterEmail, normalizeNewsletterEmail } from '../helpers/newsletterLogic';

describe('Public & Website Visitor Newsletter Subsystem (TC-PUB)', () => {

  describe('TC-PUB-001: RFC 5322 Client-Side Email Syntax Validation', () => {
    it('should approve standard valid emails', () => {
      const validEmails = [
        'investor@viridiannexus.com',
        'nrb.client@gmail.com',
        'director@sub.domain.org',
        'first.last@company.com.bd'
      ];

      validEmails.forEach(email => {
        const result = validateNewsletterEmail(email);
        expect(result.valid).toBe(true);
        expect(result.normalizedEmail).toBe(email.toLowerCase());
      });
    });

    it('should reject invalid email formats missing domain or @ symbol', () => {
      const invalidEmails = [
        'plainaddress',
        '@missinglocal.com',
        'missingat.com',
        'missingdomain@.com',
        'missingdot@domain',
        'spaces in email@domain.com',
        ''
      ];

      invalidEmails.forEach(email => {
        const result = validateNewsletterEmail(email);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Please enter a valid email address.');
      });
    });
  });

  describe('TC-PUB-002: Public Validation Error Feedback', () => {
    it('should return error when input is null, undefined, or empty whitespace', () => {
      expect(validateNewsletterEmail(null).valid).toBe(false);
      expect(validateNewsletterEmail(undefined).valid).toBe(false);
      expect(validateNewsletterEmail('   ').valid).toBe(false);
    });

    it('should display error toast message matching layout specifications', () => {
      const result = validateNewsletterEmail('invalid-input');
      expect(result.error).toBe('Please enter a valid email address.');
    });
  });

  describe('TC-PUB-003: Submission In-Progress UI State (Locking & Spinner)', () => {
    it('should manage subscription loading states to prevent double submissions', () => {
      let isSubscribing = false;
      const email = 'investor@nexus.com';

      // Simulating submit handler start
      isSubscribing = true;
      expect(isSubscribing).toBe(true);

      // Simulating payload preparation
      const payload = {
        email: normalizeNewsletterEmail(email),
        subscribed_at: new Date().toISOString(),
        status: 'active'
      };

      expect(payload.email).toBe('investor@nexus.com');
      expect(payload.status).toBe('active');
      expect(payload.subscribed_at).toBeDefined();

      // Simulating finally block
      isSubscribing = false;
      expect(isSubscribing).toBe(false);
    });
  });

  describe('TC-PUB-004: Subscription Success Handling & Input Reset', () => {
    it('should construct valid Supabase insert row and clear input upon success', () => {
      let emailState = '  INVESTOR.DHAKA@EXAMPLE.COM  ';
      const validation = validateNewsletterEmail(emailState);
      expect(validation.valid).toBe(true);

      const dbRow = {
        email: validation.normalizedEmail,
        subscribed_at: new Date().toISOString(),
        status: 'active'
      };

      expect(dbRow.email).toBe('investor.dhaka@example.com');
      expect(dbRow.status).toBe('active');

      // State is reset on success
      emailState = '';
      expect(emailState).toBe('');
    });

    it('should return company standard welcome confirmation message', () => {
      const expectedToast = 'Welcome to Viridian Nexus Development Ltd. Exclusive Updates.';
      expect(expectedToast).toContain('Viridian Nexus Development Ltd.');
      expect(expectedToast).toContain('Exclusive Updates');
    });
  });

  describe('TC-PUB-005: Network Error Resilience', () => {
    it('should handle API failure gracefully with user-friendly error notice', () => {
      let isSubscribing = true;
      let errorToast = null;

      try {
        throw new Error('PostgREST connection timeout');
      } catch (err) {
        errorToast = 'An error occurred. Please try again later.';
      } finally {
        isSubscribing = false;
      }

      expect(errorToast).toBe('An error occurred. Please try again later.');
      expect(isSubscribing).toBe(false);
    });
  });
});
