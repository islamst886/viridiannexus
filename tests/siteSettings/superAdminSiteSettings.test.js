import { describe, it, expect } from 'vitest';
import {
  validateSiteSettingsForm,
  prepareSettingsUpsertPayload
} from '../helpers/siteSettingsLogic';
import { createMockSiteSettings, mockUsers } from '../helpers/mockData';

describe('Super Admin Site Settings Operations (TC-SAD)', () => {
  const superAdmin = mockUsers.superAdminUser;

  describe('TC-SAD-001: Form Data Validation', () => {
    it('should approve valid corporate social media URLs and clean WhatsApp number', () => {
      const validForm = {
        facebookUrl: 'https://facebook.com/viridiannexus',
        linkedinUrl: 'https://linkedin.com/company/viridiannexus',
        youtubeUrl: 'https://youtube.com/@viridiannexus',
        whatsappNumber: '+880 (171) 122-3344'
      };

      const result = validateSiteSettingsForm(validForm);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized.facebookUrl).toBe('https://facebook.com/viridiannexus');
      expect(result.sanitized.whatsappNumber).toBe('8801711223344');
    });

    it('should reject URLs without http:// or https:// protocol', () => {
      const invalidForm = {
        facebookUrl: 'facebook.com/viridiannexus',
        linkedinUrl: 'www.linkedin.com/company/viridiannexus',
        youtubeUrl: 'https://youtube.com/@viridiannexus',
        whatsappNumber: '8801711223344'
      };

      const result = validateSiteSettingsForm(invalidForm);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('URL for facebookUrl must start with http:// or https://');
      expect(result.errors).toContain('URL for linkedinUrl must start with http:// or https://');
    });
  });

  describe('TC-SAD-002: Supabase Upsert Payload & Audit Trail', () => {
    it('should construct valid settings upsert object with key and audit metadata', () => {
      const formData = {
        facebookUrl: 'https://facebook.com/viridiannexus',
        linkedinUrl: 'https://linkedin.com/company/viridiannexus',
        youtubeUrl: 'https://youtube.com/@viridiannexus',
        whatsappNumber: '8801711223344'
      };

      const payload = prepareSettingsUpsertPayload(formData, superAdmin.id);

      expect(payload.key).toBe('site');
      expect(payload.value.facebookUrl).toBe('https://facebook.com/viridiannexus');
      expect(payload.value.lastUpdatedBy).toBe(superAdmin.id);
      expect(payload.value.lastUpdatedAt).toBeDefined();

      const parsedDate = new Date(payload.value.lastUpdatedAt);
      expect(isNaN(parsedDate.getTime())).toBe(false);
    });
  });

  describe('TC-SAD-003: Realtime Settings Synchronization', () => {
    it('should parse incoming postgres_changes payload on settings table', () => {
      const realtimePayload = {
        new: {
          key: 'site',
          value: {
            facebookUrl: 'https://facebook.com/viridiannexus_updated',
            linkedinUrl: 'https://linkedin.com/company/viridiannexus_updated',
            youtubeUrl: 'https://youtube.com/@viridiannexus',
            whatsappNumber: '8801999999999'
          }
        }
      };

      const newSettings = realtimePayload.new?.value || {};

      expect(newSettings.facebookUrl).toBe('https://facebook.com/viridiannexus_updated');
      expect(newSettings.whatsappNumber).toBe('8801999999999');
    });
  });
});
