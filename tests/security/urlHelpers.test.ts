import { describe, it, expect } from 'vitest';
import {
  normalizeExternalUrl,
  getYouTubeEmbedUrl,
  sanitizeRedirectPath,
  sanitizeTelHref,
  sanitizeMailtoHref,
  parseSupabaseStorageUrl,
  normalizeSupabaseUrl,
} from '../../src/utils/urlHelpers';

describe('Production URL, Redirect & Storage Security Helpers', () => {
  describe('normalizeExternalUrl', () => {
    it('normalizes bare domains and preserves http/https URLs', () => {
      expect(normalizeExternalUrl('youtube.com/@viridian')).toBe('https://youtube.com/@viridian');
      expect(normalizeExternalUrl('//cdn.example.com/img.jpg')).toBe('https://cdn.example.com/img.jpg');
      expect(normalizeExternalUrl('http://example.com/page')).toBe('http://example.com/page');
      expect(normalizeExternalUrl('https://example.com/page\u0000\n')).toBe('https://example.com/page');
    });

    it('rejects dangerous protocols, non-http schemes, and embedded credentials', () => {
      expect(normalizeExternalUrl('javascript:alert(1)')).toBe('');
      expect(normalizeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe('');
      expect(normalizeExternalUrl('vbscript:msgbox(1)')).toBe('');
      expect(normalizeExternalUrl('file:///etc/passwd')).toBe('');
      expect(normalizeExternalUrl('ftp://files.example.com')).toBe('');
      expect(normalizeExternalUrl('https://user:pass@evil.com/login')).toBe('');
      expect(normalizeExternalUrl('')).toBe('');
      expect(normalizeExternalUrl(null)).toBe('');
    });
  });

  describe('getYouTubeEmbedUrl', () => {
    it('converts watch, youtu.be, shorts, live, and embed URLs with strict 11-char IDs', () => {
      expect(getYouTubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
      expect(getYouTubeEmbedUrl('https://youtu.be/dQw4w9WgXcQ?si=track')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
      expect(getYouTubeEmbedUrl('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
      expect(getYouTubeEmbedUrl('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')).toBe(
        'https://www.youtube.com/embed/dQw4w9WgXcQ'
      );
    });

    it('rejects non-YouTube hosts, malformed video IDs, and dangerous schemes', () => {
      expect(getYouTubeEmbedUrl('https://evil.com/watch?v=dQw4w9WgXcQ')).toBe('');
      expect(getYouTubeEmbedUrl('https://youtube.com/watch?v=short')).toBe('');
      expect(getYouTubeEmbedUrl('https://cdn.example.com/tour.mp4')).toBe('');
      expect(getYouTubeEmbedUrl('javascript:alert(1)')).toBe('');
    });
  });

  describe('sanitizeRedirectPath', () => {
    it('allows strict in-app relative paths and rejects open-redirect vectors', () => {
      expect(sanitizeRedirectPath('/dashboard/bookings?tab=payments#top')).toBe(
        '/dashboard/bookings?tab=payments#top'
      );
      expect(sanitizeRedirectPath('//evil.com/phish')).toBe('/dashboard');
      expect(sanitizeRedirectPath('https://evil.com/phish')).toBe('/dashboard');
      expect(sanitizeRedirectPath('/\\evil.com')).toBe('/dashboard');
      expect(sanitizeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
      expect(sanitizeRedirectPath(null, '/login')).toBe('/login');
    });
  });

  describe('sanitizeTelHref & sanitizeMailtoHref', () => {
    it('sanitizes phone links and blocks non-digit strings', () => {
      expect(sanitizeTelHref('+880 1711-223344')).toBe('tel:+8801711-223344');
      expect(sanitizeTelHref('call-support')).toBe('');
      expect(sanitizeTelHref(null)).toBe('');
    });

    it('sanitizes email links and blocks header/query injection', () => {
      expect(sanitizeMailtoHref('concierge@viridiannexus.com')).toBe(
        'mailto:concierge@viridiannexus.com'
      );
      expect(sanitizeMailtoHref('user@example.com?subject=hack')).toBe('');
      expect(sanitizeMailtoHref('user@example.com\r\nBcc:evil@x.com')).toBe('');
      expect(sanitizeMailtoHref('invalid-email')).toBe('');
    });
  });

  describe('parseSupabaseStorageUrl', () => {
    const supabaseOrigin = 'https://abcdefgh.supabase.co';

    it('parses valid Supabase public object URLs for allowed buckets', () => {
      expect(
        parseSupabaseStorageUrl(
          'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/prop-1/hero.jpg',
          supabaseOrigin
        )
      ).toEqual({
        bucket: 'property-media',
        filePath: 'prop-1/hero.jpg',
      });
    });

    it('rejects origin mismatch, disallowed buckets, credentials, and traversal', () => {
      expect(
        parseSupabaseStorageUrl(
          'https://other.supabase.co/storage/v1/object/public/property-media/hero.jpg',
          supabaseOrigin
        )
      ).toBeNull();
      expect(
        parseSupabaseStorageUrl(
          'https://abcdefgh.supabase.co/storage/v1/object/public/private-docs/secret.pdf',
          supabaseOrigin
        )
      ).toBeNull();
      expect(
        parseSupabaseStorageUrl(
          'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/%2e%2e/secret.jpg',
          supabaseOrigin
        )
      ).toBeNull();
      expect(
        parseSupabaseStorageUrl(
          'https://user:pass@abcdefgh.supabase.co/storage/v1/object/public/property-media/a.jpg',
          supabaseOrigin
        )
      ).toBeNull();
    });
  });

  describe('normalizeSupabaseUrl', () => {
    it('strips accidental /rest/v1, /auth/v1, and trailing slashes from valid Supabase URLs', () => {
      expect(normalizeSupabaseUrl('https://abcdefgh.supabase.co/rest/v1/')).toBe(
        'https://abcdefgh.supabase.co'
      );
      expect(normalizeSupabaseUrl('https://abcdefgh.supabase.co/rest/v1')).toBe(
        'https://abcdefgh.supabase.co'
      );
      expect(normalizeSupabaseUrl('https://abcdefgh.supabase.co/auth/v1/')).toBe(
        'https://abcdefgh.supabase.co'
      );
      expect(normalizeSupabaseUrl('https://abcdefgh.supabase.co///')).toBe(
        'https://abcdefgh.supabase.co'
      );
    });

    it('rejects malformed URLs, dangerous protocols, and embedded credentials', () => {
      expect(normalizeSupabaseUrl('your_supabase_project_url_here')).toBe('');
      expect(normalizeSupabaseUrl('javascript:alert(1)')).toBe('');
      expect(normalizeSupabaseUrl('https://user:pass@abcdefgh.supabase.co')).toBe('');
      expect(normalizeSupabaseUrl(null)).toBe('');
    });
  });
});
