import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { moveMock, getPublicUrlMock, fromMock } = vi.hoisted(() => {
  const moveFn = vi.fn();
  const getPublicUrlFn = vi.fn();
  const fromFn = vi.fn(() => ({
    move: moveFn,
    getPublicUrl: getPublicUrlFn,
  }));
  return {
    moveMock: moveFn,
    getPublicUrlMock: getPublicUrlFn,
    fromMock: fromFn,
  };
});

vi.mock('../../src/supabase', () => ({
  supabase: {
    storage: {
      from: fromMock,
    },
  },
  getCachedAccessToken: vi.fn(() => null),
}));

import {
  RESERVED_PROPERTY_SLUGS,
  buildMediaStoragePath,
  moveMediaToPrefix,
  resolvePropertyStoragePrefix,
  slugifyPropertyId,
} from '../../src/utils/supabaseStorage';

describe('Property Media Storage & Slug Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcdefgh.supabase.co');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('slugifyPropertyId', () => {
    it('converts names into clean lowercase kebab-case slugs without leading/trailing hyphens', () => {
      expect(slugifyPropertyId('  The Sapphire Penthouse!  ')).toBe('the-sapphire-penthouse');
      expect(slugifyPropertyId('Viridian Nexus — Phase II (2026)')).toBe(
        'viridian-nexus-phase-ii-2026'
      );
      expect(slugifyPropertyId('---emerald---')).toBe('emerald');
      expect(slugifyPropertyId('')).toBe('');
      expect(slugifyPropertyId(null)).toBe('');
    });
  });

  describe('resolvePropertyStoragePrefix', () => {
    it('uses explicit ID when given and auto-generates from Property Name when ID is blank', () => {
      expect(resolvePropertyStoragePrefix('custom-id-1', 'Some Property')).toBe('custom-id-1');
      expect(resolvePropertyStoragePrefix('', 'Emerald Height Tower')).toBe('emerald-height-tower');
      expect(resolvePropertyStoragePrefix('   ', '   ')).toBe('');
    });

    it('blocks reserved "new" slug so properties never share a default new/ folder', () => {
      expect(RESERVED_PROPERTY_SLUGS.has('new')).toBe(true);
      expect(resolvePropertyStoragePrefix('new', 'Emerald Height')).toBe('');
      expect(resolvePropertyStoragePrefix('', 'New')).toBe('');
    });

    it('produces distinct storage folder prefixes for two newly created properties', () => {
      const firstPrefix = resolvePropertyStoragePrefix('', 'The Emerald Estate');
      const secondPrefix = resolvePropertyStoragePrefix('', 'The Sapphire Penthouse');
      expect(firstPrefix).toBe('the-emerald-estate');
      expect(secondPrefix).toBe('the-sapphire-penthouse');
      expect(firstPrefix).not.toBe(secondPrefix);
    });
  });

  describe('buildMediaStoragePath', () => {
    it('stores uploads under the property prefix with unique filenames and strips traversal', () => {
      const pathA = buildMediaStoragePath('hero', 'front view.jpg', 'the-emerald-estate');
      const pathB = buildMediaStoragePath('hero', 'front view.jpg', 'the-emerald-estate');

      expect(pathA).toMatch(/^the-emerald-estate\/hero_\d+_[a-z0-9-]+_front_view\.jpg$/);
      expect(pathA).not.toBe(pathB);

      const safePath = buildMediaStoragePath('gallery', '../secret.png', '../the-emerald/../estate');
      expect(safePath).not.toContain('..');
      expect(safePath).toMatch(/^the-emerald\/estate\/gallery_/);
    });
  });

  describe('moveMediaToPrefix', () => {
    it('does nothing when the file is already inside the target property folder', async () => {
      const url =
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/the-emerald-estate/hero_123_abc_photo.jpg';
      const result = await moveMediaToPrefix(url, 'the-emerald-estate');

      expect(result).toBe(url);
      expect(fromMock).not.toHaveBeenCalled();
      expect(moveMock).not.toHaveBeenCalled();
    });

    it('relocates uploaded media into the final property ID folder if name or ID changed before save', async () => {
      const oldUrl =
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/draft-name/hero_123_abc_photo.jpg';
      const expectedNewUrl =
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/final-sapphire/hero_123_abc_photo.jpg';

      moveMock.mockResolvedValue({ data: { message: 'Successfully moved' }, error: null });
      getPublicUrlMock.mockReturnValue({ data: { publicUrl: expectedNewUrl } });

      const result = await moveMediaToPrefix(oldUrl, 'final-sapphire');

      expect(fromMock).toHaveBeenCalledWith('property-media');
      expect(moveMock).toHaveBeenCalledWith(
        'draft-name/hero_123_abc_photo.jpg',
        'final-sapphire/hero_123_abc_photo.jpg'
      );
      expect(getPublicUrlMock).toHaveBeenCalledWith('final-sapphire/hero_123_abc_photo.jpg');
      expect(result).toBe(expectedNewUrl);
    });

    it('leaves external non-Supabase URLs unchanged', async () => {
      const externalUrl = 'https://images.unsplash.com/photo-12345.jpg';
      const result = await moveMediaToPrefix(externalUrl, 'the-emerald-estate');

      expect(result).toBe(externalUrl);
      expect(fromMock).not.toHaveBeenCalled();
    });
  });
});
