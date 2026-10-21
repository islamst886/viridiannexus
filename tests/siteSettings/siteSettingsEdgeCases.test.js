import { describe, it, expect } from 'vitest';
import {
  validateSiteSettingsForm,
  cleanWhatsAppNumber,
  generateWhatsAppLink,
  resolveSocialLinks,
  evaluateSettingsRLS,
  addPropertyTypePure,
  removePropertyTypePure
} from '../helpers/siteSettingsLogic';

describe('Site Settings Edge Cases & Security Defenses (TC-EDG)', () => {

  describe('TC-EDG-001: Malicious Protocol & Script Injection Defense', () => {
    it('should reject javascript: protocol injection attempts', () => {
      const maliciousForm = {
        facebookUrl: 'javascript:alert(document.cookie)',
        linkedinUrl: 'https://linkedin.com',
        youtubeUrl: 'https://youtube.com',
        whatsappNumber: '8801711223344'
      };

      const result = validateSiteSettingsForm(maliciousForm);

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid protocol'))).toBe(true);
    });

    it('should reject data: and vbscript: protocol injection attempts', () => {
      const dataUriForm = {
        facebookUrl: 'https://facebook.com',
        linkedinUrl: 'data:text/html,<script>alert(1)</script>',
        youtubeUrl: 'vbscript:msgbox("hello")',
        whatsappNumber: '8801711223344'
      };

      const result = validateSiteSettingsForm(dataUriForm);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('TC-EDG-002: WhatsApp Phone Number Edge Formatting', () => {
    it('should strip all alphabetic letters and special characters', () => {
      expect(cleanWhatsAppNumber('+880-HOTLINE-VIP')).toBe('880');
      expect(cleanWhatsAppNumber('CallUsNow')).toBe('');
      expect(cleanWhatsAppNumber(null)).toBe('');
      expect(cleanWhatsAppNumber(undefined)).toBe('');
    });

    it('should return null link when phone contains no digits', () => {
      expect(generateWhatsAppLink('CallUsNow')).toBeNull();
      expect(generateWhatsAppLink('   ')).toBeNull();
      expect(generateWhatsAppLink('+++---')).toBeNull();
    });

    it('should handle complex international formatting with extensions safely', () => {
      const complexPhone = '+880 (02) 988-1234 ext 56';
      const clean = cleanWhatsAppNumber(complexPhone);
      expect(clean).toBe('88002988123456');
    });
  });

  describe('TC-EDG-003: Database Row Level Security (RLS) Policies', () => {
    it('should permit public read on public.settings for all users and visitors', () => {
      // Under CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);
      expect(evaluateSettingsRLS(null, 'SELECT')).toBe(true);
      expect(evaluateSettingsRLS('user', 'SELECT')).toBe(true);
      expect(evaluateSettingsRLS('admin', 'SELECT')).toBe(true);
      expect(evaluateSettingsRLS('super_admin', 'SELECT')).toBe(true);
    });

    it('should permit write operations on public.settings for administrative roles', () => {
      // Under CREATE POLICY "settings_write" ON public.settings FOR ALL USING (is_admin());
      expect(evaluateSettingsRLS('admin', 'UPDATE')).toBe(true);
      expect(evaluateSettingsRLS('super_admin', 'UPDATE')).toBe(true);
      expect(evaluateSettingsRLS('admin', 'INSERT')).toBe(true);
      expect(evaluateSettingsRLS('super_admin', 'DELETE')).toBe(true);
    });

    it('should deny write operations on public.settings for standard users and public visitors', () => {
      expect(evaluateSettingsRLS('user', 'UPDATE')).toBe(false);
      expect(evaluateSettingsRLS('user', 'INSERT')).toBe(false);
      expect(evaluateSettingsRLS(null, 'UPDATE')).toBe(false);
    });
  });

  describe('TC-EDG-004: Corrupted or Null Database Settings Resilience', () => {
    it('should safely resolve social links when settings value is null or corrupted', () => {
      expect(() => resolveSocialLinks(null)).not.toThrow();
      expect(() => resolveSocialLinks(undefined)).not.toThrow();
      expect(() => resolveSocialLinks('corrupted-string')).not.toThrow();

      const resolved = resolveSocialLinks('corrupted-string');
      expect(resolved.visibleCount).toBe(0);
    });

    it('should safely handle null inputs in property types taxonomy mutations', () => {
      expect(addPropertyTypePure(null, ['Villa'])).toEqual(['Villa']);
      expect(addPropertyTypePure(undefined, ['Villa'])).toEqual(['Villa']);
      expect(removePropertyTypePure(null, ['Villa'])).toEqual(['Villa']);
      expect(removePropertyTypePure(undefined, ['Villa'])).toEqual(['Villa']);
    });
  });
});
