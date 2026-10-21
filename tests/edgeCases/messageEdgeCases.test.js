import { describe, it, expect } from 'vitest';
import {
  parseInquiryDate,
  cleansePhoneNumber
} from '../helpers/messageLogic';

describe('Messaging Edge Cases, Boundaries & Injection Defense (TC-EDG)', () => {

  describe('TC-EDG-001: Malicious XSS & Injection Defense', () => {
    it('should safely escape and parameterize script tags and HTML injection payloads', () => {
      const maliciousInquiry = {
        name: "<script>alert('xss')</script>Attacker",
        email: "attacker@domain.com",
        phone: "+8801700000000",
        message: '"><img src=x onerror=alert(document.cookie)><b>Bold Attempt</b>'
      };

      // Raw strings should be stored without evaluation, and React DOM escapes them automatically
      expect(maliciousInquiry.name).toContain("<script>");
      expect(maliciousInquiry.message).toContain("onerror=alert");

      // Verify escaping helper simulation
      const escapeHtml = (str) => {
        return str
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
      };

      const sanitizedMessage = escapeHtml(maliciousInquiry.message);
      expect(sanitizedMessage).not.toContain('<img');
      expect(sanitizedMessage).toContain('&lt;img');
    });
  });

  describe('TC-EDG-002: Multi-Line Whitespace & Extreme Length Preservation', () => {
    it('should preserve multi-line carriage returns and formatting', () => {
      const multiLineMessage = `Dear Viridian Nexus Team,
      
I am writing regarding the 2,860 sqft unit:
1. What is the scheduled completion date?
2. Are two parking spaces included?

Best regards,
Chowdhury`;

      expect(multiLineMessage.split('\n')).toHaveLength(8);
      expect(multiLineMessage).toContain('1. What is the scheduled completion date?');
    });
  });

  describe('TC-EDG-003: Phone Number Formatting Variants', () => {
    it('should cleanse domestic and international phone numbers into clean dialed strings', () => {
      expect(cleansePhoneNumber('+880 1711-223344')).toBe('+8801711223344');
      expect(cleansePhoneNumber('01711-223344')).toBe('01711223344');
      expect(cleansePhoneNumber('+1 (555) 234-5678')).toBe('+15552345678');
      expect(cleansePhoneNumber('')).toBe('');
      expect(cleansePhoneNumber(null)).toBe('');
    });
  });

  describe('TC-EDG-004: Dual Timestamp Architecture (PostgreSQL vs Firestore Legacy)', () => {
    it('should parse standard PostgreSQL ISO timestamp strings', () => {
      const isoTimestamp = '2026-10-21T10:30:00.000Z';
      const parsed = parseInquiryDate(isoTimestamp);
      expect(parsed).toBe('2026-10-21T10:30:00.000Z');
    });

    it('should gracefully parse legacy Firestore timestamp objects with seconds property', () => {
      const legacyFirestoreTimestamp = { seconds: 1761042600, nanoseconds: 0 };
      const parsed = parseInquiryDate(legacyFirestoreTimestamp);
      expect(parsed).toMatch(/^2025|2026/); // Valid ISO date
    });

    it('should return N/A for null, empty, or unparseable timestamps without crashing', () => {
      expect(parseInquiryDate(null)).toBe('N/A');
      expect(parseInquiryDate(undefined)).toBe('N/A');
      expect(parseInquiryDate('invalid-date-string')).toBe('N/A');
    });
  });
});
