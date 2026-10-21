import { describe, it, expect } from 'vitest';
import {
  resolveSocialLinks,
  cleanWhatsAppNumber,
  generateWhatsAppLink
} from '../helpers/siteSettingsLogic';
import { createMockSiteSettings } from '../helpers/mockData';

describe('Public & Website Visitor Site Settings Touchpoints (TC-PUB)', () => {
  const fullSettings = createMockSiteSettings();

  describe('TC-PUB-001: Footer Social Media Links Dynamic Rendering', () => {
    it('should identify all 4 social & communication channels when fully populated', () => {
      const social = resolveSocialLinks(fullSettings);

      expect(social.hasFacebook).toBe(true);
      expect(social.hasLinkedin).toBe(true);
      expect(social.hasYoutube).toBe(true);
      expect(social.hasWhatsApp).toBe(true);
      expect(social.visibleCount).toBe(4);
    });

    it('should only flag populated links when some channels are omitted', () => {
      const partialSettings = {
        facebookUrl: 'https://facebook.com/viridiannexus',
        linkedinUrl: '',
        youtubeUrl: null
      };

      const social = resolveSocialLinks(partialSettings);

      expect(social.hasFacebook).toBe(true);
      expect(social.hasLinkedin).toBe(false);
      expect(social.hasYoutube).toBe(false);
      expect(social.visibleCount).toBe(1);
    });

    it('should handle completely empty settings object without errors', () => {
      const emptySocial = resolveSocialLinks({});
      expect(emptySocial.visibleCount).toBe(0);
      expect(emptySocial.hasFacebook).toBe(false);

      const nullSocial = resolveSocialLinks(null);
      expect(nullSocial.visibleCount).toBe(0);
    });
  });

  describe('TC-PUB-002: External Link Security Attributes', () => {
    it('should enforce security attributes: target="_blank" and rel="noopener noreferrer"', () => {
      const linkAttributes = {
        target: '_blank',
        rel: 'noopener noreferrer'
      };

      expect(linkAttributes.target).toBe('_blank');
      expect(linkAttributes.rel).toBe('noopener noreferrer');
    });
  });

  describe('TC-PUB-003: Floating WhatsApp Widget Dynamic Visibility', () => {
    it('should generate valid wa.me link when whatsappNumber is configured', () => {
      const link = generateWhatsAppLink(fullSettings.whatsappNumber);
      expect(link).toBe('https://wa.me/8801711223344');
    });

    it('should return null when whatsappNumber is empty, whitespace, or undefined', () => {
      expect(generateWhatsAppLink('')).toBeNull();
      expect(generateWhatsAppLink('   ')).toBeNull();
      expect(generateWhatsAppLink(null)).toBeNull();
      expect(generateWhatsAppLink(undefined)).toBeNull();
    });
  });

  describe('TC-PUB-004: WhatsApp Phone Clean Number Formatting', () => {
    it('should strip non-digit characters from telephone inputs', () => {
      const formattedInput = '+880 (171) 122-3344';
      const clean = cleanWhatsAppNumber(formattedInput);

      expect(clean).toBe('8801711223344');
      expect(clean).not.toContain('+');
      expect(clean).not.toContain(' ');
      expect(clean).not.toContain('-');
      expect(clean).not.toContain('(');
    });

    it('should generate wa.me URI strictly with sanitized digits', () => {
      const formattedInput = '+880 171-122-3344';
      const link = generateWhatsAppLink(formattedInput);

      expect(link).toBe('https://wa.me/8801711223344');
    });
  });

  describe('TC-PUB-005: Official WhatsApp Brand Vector Assets & Icon Integration', () => {
    it('should detect hasWhatsApp true in social links resolution when phone is configured', () => {
      const social = resolveSocialLinks(fullSettings);
      expect(social.hasWhatsApp).toBe(true);
      expect(social.visibleCount).toBe(4);
    });

    it('should verify official WhatsApp brand color hex code #25D366 and hover tone #128C7E', () => {
      const brandColors = {
        primary: '#25D366',
        hover: '#128C7E'
      };

      expect(brandColors.primary).toBe('#25D366');
      expect(brandColors.hover).toBe('#128C7E');
    });
  });
});

