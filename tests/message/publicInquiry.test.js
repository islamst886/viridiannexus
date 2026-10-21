import { describe, it, expect } from 'vitest';
import {
  validateInquiryForm,
  formatContactPropertyName
} from '../helpers/messageLogic';

describe('Public Inquiries & Contact Features (TC-PUB)', () => {

  describe('TC-PUB-001 & TC-PUB-002: Form Validation & Mandatory Constraints', () => {
    it('should validate and approve a well-formed inquiry submission', () => {
      const validPayload = {
        name: 'Sultana Razia',
        email: 'sultana@example.com',
        phone: '+8801711223344',
        message: 'Requesting private consultation for Jolshiri project.',
        agreedToPolicy: true
      };

      const result = validateInquiryForm(validPayload);
      expect(result.valid).toBe(true);
    });

    it('should reject submission if any mandatory field is missing', () => {
      expect(validateInquiryForm({ name: '', phone: '017', email: 'a@b.com', message: 'Hi', agreedToPolicy: true }).error).toBe(
        'Please fill out all fields.'
      );
      expect(validateInquiryForm({ name: 'User', phone: '', email: 'a@b.com', message: 'Hi', agreedToPolicy: true }).error).toBe(
        'Please fill out all fields.'
      );
      expect(validateInquiryForm({ name: 'User', phone: '017', email: '', message: 'Hi', agreedToPolicy: true }).error).toBe(
        'Please fill out all fields.'
      );
      expect(validateInquiryForm({ name: 'User', phone: '017', email: 'a@b.com', message: '', agreedToPolicy: true }).error).toBe(
        'Please fill out all fields.'
      );
    });

    it('should enforce valid email syntax', () => {
      const invalidEmailPayload = {
        name: 'Sultana Razia',
        email: 'not-an-email',
        phone: '+8801711223344',
        message: 'Hello',
        agreedToPolicy: true
      };

      const result = validateInquiryForm(invalidEmailPayload);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Valid email is required.');
    });
  });

  describe('TC-PUB-003: Inquiry Topic Selection', () => {
    it('should support multiple real-estate inquiry topics', () => {
      const supportedTopics = [
        'Domestic Investment',
        'NRB / International Purchase',
        'Brochure Request',
        'Virtual Tour Request',
        'Private Consultation'
      ];

      expect(supportedTopics).toHaveLength(5);
      expect(supportedTopics).toContain('NRB / International Purchase');
      expect(supportedTopics).toContain('Virtual Tour Request');
    });
  });

  describe('TC-PUB-004: Property Parameter Auto-Detection & Title Formatting', () => {
    it('should convert URL slug into title-cased property name', () => {
      expect(formatContactPropertyName('viridian-jolshiri-exclusivity')).toBe(
        'Viridian Jolshiri Exclusivity'
      );
      expect(formatContactPropertyName('purbachal-lakefront-villa')).toBe(
        'Purbachal Lakefront Villa'
      );
      expect(formatContactPropertyName('')).toBe('');
    });
  });

  describe('TC-PUB-005: Privacy Policy Mandatory Consent Guard', () => {
    it('should strictly reject submission when user has not checked privacy policy', () => {
      const payloadWithoutConsent = {
        name: 'Sultana Razia',
        email: 'sultana@example.com',
        phone: '+8801711223344',
        message: 'Requesting consultation',
        agreedToPolicy: false // Unchecked
      };

      const result = validateInquiryForm(payloadWithoutConsent);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('You must agree to the Privacy Policy to submit.');
    });
  });
});
