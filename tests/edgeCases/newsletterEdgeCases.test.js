import { describe, it, expect } from 'vitest';
import {
  validateNewsletterEmail,
  normalizeNewsletterEmail,
  formatSubscriberDate,
  formatSubscriberStatus,
  filterSubscribers,
  exportSubscribersToCSV,
  handleSubscriberDeletion
} from '../helpers/newsletterLogic';

describe('Newsletter Edge Cases & Failure Modes (TC-EDG)', () => {

  describe('TC-EDG-001: Malicious Injection Defense', () => {
    it('should reject email containing script tags', () => {
      const xssEmail = '<script>alert("xss")</script>@domain.com';
      const result = validateNewsletterEmail(xssEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid or unsafe characters');
    });

    it('should reject email containing SQL injection quotes or semicolons', () => {
      const sqlEmail = "admin' OR '1'='1;--@nexus.com";
      const result = validateNewsletterEmail(sqlEmail);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('invalid or unsafe characters');
    });
  });

  describe('TC-EDG-002: Complex RFC 5322 Plus-Addressed & Subdomain Formats', () => {
    it('should accept plus-addressed emails used by investors for tracking', () => {
      const plusEmail = 'investor+luxuryproperty@gmail.com';
      const result = validateNewsletterEmail(plusEmail);
      expect(result.valid).toBe(true);
      expect(result.normalizedEmail).toBe('investor+luxuryproperty@gmail.com');
    });

    it('should accept multi-level corporate subdomain emails', () => {
      const subdomainEmail = 'director@asia.operations.viridiannexus.com';
      const result = validateNewsletterEmail(subdomainEmail);
      expect(result.valid).toBe(true);
      expect(result.normalizedEmail).toBe('director@asia.operations.viridiannexus.com');
    });

    it('should accept hyphens and numbers in domain and local parts', () => {
      const hyphenEmail = 'client-01@dhaka-capital2026.net';
      const result = validateNewsletterEmail(hyphenEmail);
      expect(result.valid).toBe(true);
      expect(result.normalizedEmail).toBe('client-01@dhaka-capital2026.net');
    });
  });

  describe('TC-EDG-003: RFC 5321 Length Boundary Conditions', () => {
    it('should accept email at maximum standard length of 254 characters', () => {
      // 254 characters: local 64 + @ + 189
      const localPart = 'a'.repeat(64);
      const domainPart = 'b'.repeat(185) + '.com'; // 64 + 1 + 185 + 4 = 254 chars
      const email254 = `${localPart}@${domainPart}`;

      expect(email254.length).toBe(254);
      const result = validateNewsletterEmail(email254);
      expect(result.valid).toBe(true);
    });

    it('should reject email exceeding 254 characters', () => {
      const localPart = 'a'.repeat(64);
      const domainPart = 'b'.repeat(186) + '.com'; // 64 + 1 + 186 + 4 = 255 chars
      const email255 = `${localPart}@${domainPart}`;

      expect(email255.length).toBe(255);
      const result = validateNewsletterEmail(email255);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowable length');
    });
  });

  describe('TC-EDG-004: Robust Date Formatting Resilience', () => {
    it('should return "Unknown Date" for null, undefined, or empty timestamps', () => {
      expect(formatSubscriberDate(null)).toBe('Unknown Date');
      expect(formatSubscriberDate(undefined)).toBe('Unknown Date');
      expect(formatSubscriberDate('')).toBe('Unknown Date');
    });

    it('should return "Unknown Date" for malformed or corrupted date strings', () => {
      expect(formatSubscriberDate('invalid-date-format')).toBe('Unknown Date');
      expect(formatSubscriberDate('NaN')).toBe('Unknown Date');
    });
  });

  describe('TC-EDG-005: Whitespace & Case-Folding Consistency', () => {
    it('should trim irregular whitespace and convert to lowercase reliably', () => {
      const irregularEmail = '\t\n  INVESTOR.VILLA@GMAIL.COM \r\n ';
      const normalized = normalizeNewsletterEmail(irregularEmail);
      expect(normalized).toBe('investor.villa@gmail.com');
    });
  });

  describe('TC-EDG-006: Empty Collection Resilience', () => {
    it('should handle null or non-array inputs in filterSubscribers safely', () => {
      expect(filterSubscribers(null, 'query')).toEqual([]);
      expect(filterSubscribers(undefined, 'query')).toEqual([]);
    });

    it('should export valid CSV header even when subscriber list is null', () => {
      expect(exportSubscribersToCSV(null)).toBe('Email,Status,SubscribedDate\n');
    });

    it('should handle deletion on empty array without exceptions', () => {
      const result = handleSubscriberDeletion([], 'any-id', true);
      expect(result.deleted).toBe(false);
      expect(result.updatedSubscribers).toEqual([]);
    });
  });

  describe('TC-EDG-007: Idempotent Consecutive Deletion Attempts', () => {
    it('should safely ignore repeated deletion requests for an already deleted ID', () => {
      const initialList = [{ id: 'sub-1', email: 'a@a.com' }, { id: 'sub-2', email: 'b@b.com' }];

      // First deletion
      const firstResult = handleSubscriberDeletion(initialList, 'sub-1', true);
      expect(firstResult.deleted).toBe(true);
      expect(firstResult.updatedSubscribers).toHaveLength(1);

      // Second deletion with same ID
      const secondResult = handleSubscriberDeletion(firstResult.updatedSubscribers, 'sub-1', true);
      expect(secondResult.deleted).toBe(false);
      expect(secondResult.updatedSubscribers).toHaveLength(1);
    });
  });

  describe('TC-EDG-008: Custom / Unrecognized Subscriber Status Values', () => {
    it('should handle unusual status codes gracefully with safe fallback styling', () => {
      const customStatus = formatSubscriberStatus('Pending_Verification');
      expect(customStatus.text).toBe('Pending_Verification');
      expect(customStatus.badgeClass).toContain('bg-green-100');
    });
  });
});
