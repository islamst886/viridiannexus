import { describe, expect, it, vi } from 'vitest';
import {
  buildBaseSiteJsonLd,
  buildCanonicalUrl,
  buildJournalSeoMetadata,
  buildPropertySeoMetadata,
  CANONICAL_SITE_URL,
  getSeoMetadataForPath,
  INDEXABLE_STATIC_ROUTES,
} from '../../src/utils/seo';
import {
  buildSitemapXml,
  collectSitemapEntries,
  handleSitemapRequest,
} from '../../src/utils/sitemapServer';
import { JOURNAL_ARTICLES } from '../../src/data/journalArticles';
import type { Property } from '../../src/types';

describe('SEO Metadata, Structured Data & Sitemap for viridiannexus.com', () => {
  it('uses https://viridiannexus.com as the canonical origin across public pages', () => {
    expect(CANONICAL_SITE_URL).toBe('https://viridiannexus.com');
    expect(buildCanonicalUrl('/')).toBe('https://viridiannexus.com/');
    expect(buildCanonicalUrl('/projects/')).toBe('https://viridiannexus.com/projects');
    expect(buildCanonicalUrl('/managing-director')).toBe('https://viridiannexus.com/leadership');

    const homeMeta = getSeoMetadataForPath('/');
    expect(homeMeta.robots).toBe('index, follow');
    expect(homeMeta.title).toContain('Viridian Nexus');

    const projectsMeta = getSeoMetadataForPath('/projects');
    expect(projectsMeta.title).toContain('Projects');
    expect(projectsMeta.description).not.toBe(homeMeta.description);
    expect(projectsMeta.robots).toBe('index, follow');
  });

  it('marks private admin, client portal, auth, and booking routes as noindex, nofollow', () => {
    for (const path of ['/admin', '/admin/dashboard', '/dashboard', '/dashboard/wishlist', '/booking', '/auth']) {
      const meta = getSeoMetadataForPath(path);
      expect(meta.robots).toBe('noindex, nofollow');
    }
  });

  it('builds Organization, WebSite SearchAction, and Primary Navigation JSON-LD for sitelinks', () => {
    const schemas = buildBaseSiteJsonLd();
    const org = schemas.find((s) => Array.isArray(s['@type']) && s['@type'].includes('Organization'));
    const website = schemas.find((s) => s['@type'] === 'WebSite');
    const navList = schemas.find((s) => s['@type'] === 'ItemList');

    expect(org).toBeDefined();
    expect(org?.url).toBe('https://viridiannexus.com/');
    expect(website).toBeDefined();
    expect(JSON.stringify(website)).toContain('https://viridiannexus.com/projects?search={search_term_string}');
    expect(navList).toBeDefined();
    const navElements = (navList?.itemListElement as Array<{ url: string; name: string }>) ?? [];
    expect(navElements.some((el) => el.url === 'https://viridiannexus.com/projects')).toBe(true);
    expect(navElements.some((el) => el.url === 'https://viridiannexus.com/contact')).toBe(true);
    expect(navElements.some((el) => el.url === 'https://viridiannexus.com/leadership')).toBe(true);
  });

  it('generates RealEstateListing and Article structured metadata dynamically', () => {
    const mockProperty: Property = {
      id: 'sapphire-penthouse',
      name: 'The Sapphire Penthouse',
      location: 'Jolshiri Abashon Sector 15',
      price: '45000000',
      status: 'Ready',
      propertyType: ['Penthouse'],
      beds: 4,
      baths: 5,
      sqft: '3200',
      buildingType: 'G+8',
      unitsPerFloor: '1',
      totalUnits: '8',
      landArea: '10 Katha',
      architect: 'Atelier',
      parkingAvailable: 'Yes',
      parkingPrice: '500000',
      passengerLifts: '2',
      frontRoadSize: '60 FT',
      totalShare: '',
      landmarks: '',
      googleMapLink: '',
      completionDate: '2026',
      overview: 'Biophilic flagship penthouses overlooking the Jolshiri central lake.',
      brochureUrl: '',
      amenities: [],
      customAmenities: [],
      availableUnits: [],
      inventory: [],
      parkingInventory: [],
      milestones: [],
      images: { hero: 'https://cdn.example.com/hero.jpg', map: '', floorPlan: '', video: '', gallery: [] },
    };

    const propSeo = buildPropertySeoMetadata(mockProperty);
    expect(propSeo.path).toBe('/property/sapphire-penthouse');
    expect(propSeo.title).toContain('The Sapphire Penthouse');
    expect(propSeo.image).toBe('https://cdn.example.com/hero.jpg');
    expect(JSON.stringify(propSeo.structuredData)).toContain('RealEstateListing');

    const journalSeo = buildJournalSeoMetadata(JOURNAL_ARTICLES[0]);
    expect(journalSeo.path).toBe(`/journal/${JOURNAL_ARTICLES[0].slug}`);
    expect(journalSeo.type).toBe('article');
    expect(JSON.stringify(journalSeo.structuredData)).toContain('Article');
  });

  it('builds valid sitemap.xml with static pages, journal articles, and dynamic properties', () => {
    const xml = buildSitemapXml([
      { id: 'emerald-estate', updated_at: '2026-11-10T10:00:00Z' },
      { id: 'sky&villa', updated_at: '2026-11-12T12:00:00Z' },
    ]);

    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    for (const route of INDEXABLE_STATIC_ROUTES) {
      expect(xml).toContain(`<loc>${buildCanonicalUrl(route.path)}</loc>`);
    }
    for (const article of JOURNAL_ARTICLES) {
      expect(xml).toContain(`<loc>https://viridiannexus.com/journal/${article.slug}</loc>`);
    }
    expect(xml).toContain('<loc>https://viridiannexus.com/property/emerald-estate</loc>');
    expect(xml).toContain('<lastmod>2026-11-10</lastmod>');
    expect(xml).toContain('<loc>https://viridiannexus.com/property/sky%26villa</loc>');
    expect(xml).not.toContain('/admin');
    expect(xml).not.toContain('/dashboard');
  });

  it('serves live Supabase properties in /api/sitemap and falls back cleanly when offline', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ id: 'oasis-towers', updated_at: '2026-11-14T08:00:00Z' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const okRes = await handleSitemapRequest(
      {
        PUBLIC_SITE_URL: 'https://viridiannexus.com',
        SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      },
      fetchMock as unknown as typeof fetch
    );

    expect(okRes.status).toBe(200);
    expect(okRes.headers['Content-Type']).toBe('application/xml; charset=utf-8');
    expect(okRes.body).toContain('https://viridiannexus.com/property/oasis-towers');

    const failingFetch = vi.fn(async () => {
      throw new Error('Network unreachable');
    });

    const fallbackRes = await handleSitemapRequest(
      {
        SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon-key',
      },
      failingFetch as unknown as typeof fetch
    );

    expect(fallbackRes.status).toBe(200);
    expect(collectSitemapEntries([]).length).toBeGreaterThanOrEqual(INDEXABLE_STATIC_ROUTES.length);
  });
});
