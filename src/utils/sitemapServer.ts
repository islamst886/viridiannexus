import { JOURNAL_ARTICLES } from '../data/journalArticles.js';
import {
  buildCanonicalUrl,
  CANONICAL_SITE_URL,
  INDEXABLE_STATIC_ROUTES,
  normalizeSeoOrigin,
} from './seo.js';

export interface SitemapEnv {
  PUBLIC_SITE_URL?: string;
  SUPABASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

export interface SitemapPropertyRecord {
  id: string;
  updated_at?: string | null;
}

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

export function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeIsoDate(raw?: string | null): string | undefined {
  if (!raw || typeof raw !== 'string') return undefined;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return undefined;
  return new Date(ms).toISOString().split('T')[0];
}

export function collectSitemapEntries(
  properties: SitemapPropertyRecord[] = [],
  origin = CANONICAL_SITE_URL
): SitemapUrlEntry[] {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const seen = new Set<string>();
  const entries: SitemapUrlEntry[] = [];

  const pushUnique = (entry: SitemapUrlEntry) => {
    if (seen.has(entry.loc)) return;
    seen.add(entry.loc);
    entries.push(entry);
  };

  for (const route of INDEXABLE_STATIC_ROUTES) {
    pushUnique({
      loc: buildCanonicalUrl(route.path, cleanOrigin),
      changefreq: route.changefreq,
      priority: route.priority,
    });
  }

  for (const article of JOURNAL_ARTICLES) {
    pushUnique({
      loc: buildCanonicalUrl(`/journal/${article.slug}`, cleanOrigin),
      changefreq: 'monthly',
      priority: '0.7',
    });
  }

  for (const prop of properties) {
    const cleanId = typeof prop.id === 'string' ? prop.id.trim() : '';
    if (!cleanId) continue;
    pushUnique({
      loc: buildCanonicalUrl(`/property/${encodeURIComponent(cleanId)}`, cleanOrigin),
      lastmod: normalizeIsoDate(prop.updated_at),
      changefreq: 'weekly',
      priority: '0.85',
    });
  }

  return entries;
}

export function buildSitemapXml(
  properties: SitemapPropertyRecord[] = [],
  origin = CANONICAL_SITE_URL
): string {
  const entries = collectSitemapEntries(properties, origin);
  const rows = entries
    .map((entry) => {
      const lastmodTag = entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod)}</lastmod>` : '';
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>${lastmodTag}\n    <changefreq>${escapeXml(entry.changefreq)}</changefreq>\n    <priority>${escapeXml(entry.priority)}</priority>\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
}

export async function fetchSitemapProperties(
  env: SitemapEnv,
  fetchFn: typeof fetch = fetch
): Promise<SitemapPropertyRecord[]> {
  const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const apiKey = (env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
  if (!supabaseUrl || !apiKey) {
    return [];
  }

  try {
    const res = await fetchFn(
      `${supabaseUrl}/rest/v1/properties?select=id,updated_at&order=updated_at.desc`,
      {
        method: 'GET',
        headers: {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (item): item is SitemapPropertyRecord =>
        Boolean(item) && typeof item === 'object' && typeof (item as { id?: unknown }).id === 'string'
    );
  } catch {
    return [];
  }
}

export async function handleSitemapRequest(
  env: SitemapEnv,
  fetchFn: typeof fetch = fetch
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  const origin = normalizeSeoOrigin(env.PUBLIC_SITE_URL || CANONICAL_SITE_URL);
  const properties = await fetchSitemapProperties(env, fetchFn);
  const body = buildSitemapXml(properties, origin);

  return {
    status: 200,
    body,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  };
}
