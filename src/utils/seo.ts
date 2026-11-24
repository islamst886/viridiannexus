import { COMPANY_INFO } from '../data/companyInfo.js';
import { getJournalArticle } from '../data/journalArticles.js';
import type { JournalArticle, Property } from '../types/index.js';
import { normalizeExternalUrl } from './urlHelpers.js';

export const CANONICAL_SITE_URL = 'https://viridiannexus.com';

export interface SeoMetadata {
  title: string;
  description: string;
  path: string;
  robots: 'index, follow' | 'noindex, nofollow';
  type: 'website' | 'article';
  image: string;
  structuredData?: Array<Record<string, unknown>>;
}

export interface StaticSeoRouteSpec {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
  title: string;
  description: string;
  navName?: string;
}

export const INDEXABLE_STATIC_ROUTES: StaticSeoRouteSpec[] = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: '1.0',
    title: 'Viridian Nexus Development Ltd. | Homes Woven in Nature',
    description:
      'RAJUK & Cantt. Board enlisted luxury real estate developer in Dhaka. Explore biophilic residences in Jolshiri Abashon and flagship developments by Viridian Nexus.',
  },
  {
    path: '/projects',
    changefreq: 'daily',
    priority: '0.9',
    title: 'Our Projects & Luxury Residences | Viridian Nexus Development Ltd.',
    description:
      'Explore ready, ongoing, and upcoming luxury residential projects in Jolshiri Abashon and Dhaka by Viridian Nexus Development Ltd.',
    navName: 'Our Projects',
  },
  {
    path: '/leadership',
    changefreq: 'monthly',
    priority: '0.8',
    title: 'Executive Leadership | Viridian Nexus Development Ltd.',
    description:
      'Meet the executive leadership guiding Viridian Nexus Development Ltd. with punctual delivery, structural fidelity, and long-term client stewardship.',
    navName: 'Leadership',
  },
  {
    path: '/progress',
    changefreq: 'weekly',
    priority: '0.8',
    title: 'Construction Progress & Milestones | Viridian Nexus Development Ltd.',
    description:
      'Follow transparent stage-by-stage construction milestones and verified engineering progress across active Viridian Nexus properties.',
    navName: 'Project Progress',
  },
  {
    path: '/virtual-tour',
    changefreq: 'monthly',
    priority: '0.7',
    title: '360° Virtual Tours | Viridian Nexus Development Ltd.',
    description:
      'Experience high-definition 360-degree virtual spatial walkthroughs of signature Viridian Nexus residences.',
    navName: '360° Virtual Tour',
  },
  {
    path: '/live-cameras',
    changefreq: 'weekly',
    priority: '0.7',
    title: 'Live Construction Cameras | Viridian Nexus Development Ltd.',
    description:
      'Monitor real-time site visibility and live construction camera feeds across Viridian Nexus active developments.',
    navName: 'Live Cameras',
  },
  {
    path: '/location',
    changefreq: 'monthly',
    priority: '0.75',
    title: 'Jolshiri Abashon Smart City | Viridian Nexus Development Ltd.',
    description:
      'Learn about Jolshiri Abashon’s 48% open ecological master plan, 205-acre central lake, and sustainable green urbanism in Dhaka.',
    navName: 'Jolshiri Smart City',
  },
  {
    path: '/nrb',
    changefreq: 'monthly',
    priority: '0.75',
    title: 'NRB & International Investors Portal | Viridian Nexus Development Ltd.',
    description:
      'Dedicated NITA remittance guidance, remote Power of Attorney execution, and international brokerage concierge for Non-Resident Bangladeshis.',
    navName: 'NRB Portal',
  },
  {
    path: '/contact',
    changefreq: 'monthly',
    priority: '0.85',
    title: 'Contact & Corporate Office | Viridian Nexus Development Ltd.',
    description:
      'Book a private consultation with Viridian Nexus Development Ltd. Visit our Uttara Sector #04 corporate office in Dhaka or inquire online.',
    navName: 'Contact Us',
  },
  {
    path: '/legal',
    changefreq: 'monthly',
    priority: '0.6',
    title: 'Legal, Compliance & Buyer Protection | Viridian Nexus Development Ltd.',
    description:
      'Review Viridian Nexus buyer protection standards, RAJUK & Cantt. Board compliance, terms of service, and privacy policy.',
    navName: 'Legal & Compliance',
  },
];

const STATIC_ROUTE_MAP = new Map<string, StaticSeoRouteSpec>(
  INDEXABLE_STATIC_ROUTES.map((entry) => [entry.path, entry])
);

const NOINDEX_PREFIXES = ['/admin', '/dashboard', '/booking', '/auth'];

export function normalizeSeoOrigin(raw?: string | null): string {
  const candidate = typeof raw === 'string' && raw.trim() ? raw.trim() : CANONICAL_SITE_URL;
  return candidate.replace(/\/+$/, '');
}

export function normalizeRoutePath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const cleaned = pathname.replace(/\/+$/, '');
  if (cleaned === '/managing-director') return '/leadership';
  return cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
}

export function buildCanonicalUrl(path: string, origin = CANONICAL_SITE_URL): string {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const normalizedPath = normalizeRoutePath(path);
  return normalizedPath === '/' ? `${cleanOrigin}/` : `${cleanOrigin}${normalizedPath}`;
}

function defaultBrandImage(origin = CANONICAL_SITE_URL): string {
  return `${normalizeSeoOrigin(origin)}/logo.png`;
}

function compactText(raw: string | null | undefined, maxLen = 158): string {
  if (!raw) return '';
  const singleLine = raw.replace(/\s+/g, ' ').trim();
  if (singleLine.length <= maxLen) return singleLine;
  return `${singleLine.slice(0, maxLen - 1).trimEnd()}…`;
}

export function buildBaseSiteJsonLd(origin = CANONICAL_SITE_URL): Array<Record<string, unknown>> {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const logoUrl = defaultBrandImage(cleanOrigin);

  const organization: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['RealEstateAgent', 'Organization'],
    '@id': `${cleanOrigin}/#organization`,
    name: COMPANY_INFO.legalName,
    alternateName: 'Viridian Nexus',
    slogan: COMPANY_INFO.motto,
    url: `${cleanOrigin}/`,
    logo: {
      '@type': 'ImageObject',
      url: logoUrl,
    },
    image: logoUrl,
    email: COMPANY_INFO.email,
    telephone: COMPANY_INFO.phones.mobile,
    address: {
      '@type': 'PostalAddress',
      streetAddress: COMPANY_INFO.corporateOffice.street,
      addressLocality: 'Uttara, Dhaka',
      postalCode: '1230',
      addressCountry: 'BD',
    },
    areaServed: {
      '@type': 'City',
      name: 'Dhaka',
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: COMPANY_INFO.phones.mobile,
        contactType: 'sales',
        areaServed: 'BD',
        availableLanguage: ['English', 'Bengali'],
      },
      {
        '@type': 'ContactPoint',
        telephone: COMPANY_INFO.phones.landline,
        contactType: 'customer support',
        areaServed: 'BD',
        availableLanguage: ['English', 'Bengali'],
      },
    ],
  };

  const website: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${cleanOrigin}/#website`,
    name: COMPANY_INFO.legalName,
    alternateName: COMPANY_INFO.shortName,
    url: `${cleanOrigin}/`,
    publisher: {
      '@id': `${cleanOrigin}/#organization`,
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${cleanOrigin}/projects?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const sitelinkItems = INDEXABLE_STATIC_ROUTES.filter((r) => Boolean(r.navName)).map(
    (route, index) => ({
      '@type': 'SiteNavigationElement',
      position: index + 1,
      name: route.navName,
      description: route.description,
      url: buildCanonicalUrl(route.path, cleanOrigin),
    })
  );

  const navigationList: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${cleanOrigin}/#site-navigation`,
    name: 'Primary Navigation',
    itemListElement: sitelinkItems,
  };

  return [organization, website, navigationList];
}

export function buildJournalSeoMetadata(
  article: JournalArticle,
  origin = CANONICAL_SITE_URL
): SeoMetadata {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const path = `/journal/${article.slug}`;
  const description = compactText(article.subtitle || article.summary);

  const structuredData: Array<Record<string, unknown>> = [
    ...buildBaseSiteJsonLd(cleanOrigin),
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: article.title,
      description,
      image: [normalizeExternalUrl(article.heroImage) || defaultBrandImage(cleanOrigin)],
      author: {
        '@type': 'Person',
        name: article.author.name,
        jobTitle: article.author.role,
      },
      publisher: {
        '@id': `${cleanOrigin}/#organization`,
      },
      mainEntityOfPage: buildCanonicalUrl(path, cleanOrigin),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: buildCanonicalUrl('/', cleanOrigin) },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Viridian Journal',
          item: buildCanonicalUrl('/journal', cleanOrigin),
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: article.title,
          item: buildCanonicalUrl(path, cleanOrigin),
        },
      ],
    },
  ];

  return {
    title: `${article.title} | Viridian Journal`,
    description,
    path,
    robots: 'index, follow',
    type: 'article',
    image: normalizeExternalUrl(article.heroImage) || defaultBrandImage(cleanOrigin),
    structuredData,
  };
}

export function buildPropertySeoMetadata(
  property: Property,
  origin = CANONICAL_SITE_URL
): SeoMetadata {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const path = `/property/${property.id}`;
  const fallbackDesc = `${property.name} at ${property.location || 'Dhaka'}${property.status ? ` (${property.status})` : ''} — eco-integrated luxury residential development by ${COMPANY_INFO.legalName}.`;
  const description = compactText(property.overview) || fallbackDesc;
  const heroImage = normalizeExternalUrl(property.images?.hero) || defaultBrandImage(cleanOrigin);
  const canonical = buildCanonicalUrl(path, cleanOrigin);

  const structuredData: Array<Record<string, unknown>> = [
    ...buildBaseSiteJsonLd(cleanOrigin),
    {
      '@context': 'https://schema.org',
      '@type': 'RealEstateListing',
      name: property.name,
      description,
      url: canonical,
      image: [heroImage],
      address: property.location
        ? {
            '@type': 'PostalAddress',
            streetAddress: property.location,
            addressLocality: 'Dhaka',
            addressCountry: 'BD',
          }
        : undefined,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: buildCanonicalUrl('/', cleanOrigin) },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Our Projects',
          item: buildCanonicalUrl('/projects', cleanOrigin),
        },
        { '@type': 'ListItem', position: 3, name: property.name, item: canonical },
      ],
    },
  ];

  return {
    title: `${property.name}${property.location ? ` — ${property.location}` : ''} | ${COMPANY_INFO.shortName}`,
    description,
    path,
    robots: 'index, follow',
    type: 'website',
    image: heroImage,
    structuredData,
  };
}

export function getSeoMetadataForPath(pathname: string, origin = CANONICAL_SITE_URL): SeoMetadata {
  const cleanOrigin = normalizeSeoOrigin(origin);
  const path = normalizeRoutePath(pathname);
  const baseImage = defaultBrandImage(cleanOrigin);

  if (NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
    let portalTitle = `Portal | ${COMPANY_INFO.shortName}`;
    if (path.startsWith('/admin')) portalTitle = `Admin Portal | ${COMPANY_INFO.shortName}`;
    else if (path.startsWith('/dashboard')) portalTitle = `Client Dashboard | ${COMPANY_INFO.shortName}`;
    else if (path.startsWith('/booking')) portalTitle = `Property Reservation | ${COMPANY_INFO.shortName}`;
    else if (path.startsWith('/auth')) portalTitle = `Sign In | ${COMPANY_INFO.shortName}`;

    return {
      title: portalTitle,
      description: `${COMPANY_INFO.legalName} secure portal.`,
      path,
      robots: 'noindex, nofollow',
      type: 'website',
      image: baseImage,
    };
  }

  if (path === '/verify') {
    return {
      title: `Official Document Verification | ${COMPANY_INFO.legalName}`,
      description: `Verify official allotment invoices, payment receipts, statements, cancellation settlements, and refund vouchers issued by ${COMPANY_INFO.legalName}.`,
      path,
      robots: 'noindex, nofollow',
      type: 'website',
      image: baseImage,
    };
  }

  if (path === '/journal' || path.startsWith('/journal/')) {
    const slug = path.startsWith('/journal/') ? path.slice('/journal/'.length) : 'jolshiri-revolution';
    const article = getJournalArticle(slug);
    if (article) {
      return buildJournalSeoMetadata(article, cleanOrigin);
    }
  }

  if (path === '/project' || path.startsWith('/property/')) {
    return {
      title: `Property Details | ${COMPANY_INFO.legalName}`,
      description: `Explore floor plans, amenities, construction milestones, and unit availability with ${COMPANY_INFO.legalName}.`,
      path,
      robots: 'index, follow',
      type: 'website',
      image: baseImage,
      structuredData: buildBaseSiteJsonLd(cleanOrigin),
    };
  }

  const staticEntry = STATIC_ROUTE_MAP.get(path);
  if (staticEntry) {
    const pageSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: staticEntry.title,
      description: staticEntry.description,
      url: buildCanonicalUrl(staticEntry.path, cleanOrigin),
      isPartOf: { '@id': `${cleanOrigin}/#website` },
    };

    const structuredData: Array<Record<string, unknown>> = [
      ...buildBaseSiteJsonLd(cleanOrigin),
      pageSchema,
    ];

    if (staticEntry.path !== '/') {
      structuredData.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: buildCanonicalUrl('/', cleanOrigin) },
          {
            '@type': 'ListItem',
            position: 2,
            name: staticEntry.navName || staticEntry.title,
            item: buildCanonicalUrl(staticEntry.path, cleanOrigin),
          },
        ],
      });
    }

    return {
      title: staticEntry.title,
      description: staticEntry.description,
      path: staticEntry.path,
      robots: 'index, follow',
      type: 'website',
      image: baseImage,
      structuredData,
    };
  }

  return {
    title: `${COMPANY_INFO.legalName} | ${COMPANY_INFO.motto}`,
    description:
      'Viridian Nexus Development Ltd. - Homes Woven in Nature. Crafting architectural masterpieces where natural ecology seamlessly meets modern luxury.',
    path,
    robots: 'index, follow',
    type: 'website',
    image: baseImage,
    structuredData: buildBaseSiteJsonLd(cleanOrigin),
  };
}

function upsertMetaTag(attrName: 'name' | 'property', attrValue: string, content: string): void {
  if (typeof document === 'undefined' || !document.head) return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attrName, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertCanonicalLink(href: string): void {
  if (typeof document === 'undefined' || !document.head) return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

function upsertDynamicJsonLd(items?: Array<Record<string, unknown>>): void {
  if (typeof document === 'undefined' || !document.head) return;
  const existing = document.getElementById('vn-dynamic-seo-jsonld');
  if (!items || items.length === 0) {
    existing?.remove();
    return;
  }

  const script = existing instanceof HTMLScriptElement ? existing : document.createElement('script');
  script.id = 'vn-dynamic-seo-jsonld';
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(items.length === 1 ? items[0] : items);
  if (!script.parentNode) {
    document.head.appendChild(script);
  }
}

export function applyDocumentSeo(meta: SeoMetadata, origin = CANONICAL_SITE_URL): void {
  if (typeof document === 'undefined') return;

  const canonicalUrl = buildCanonicalUrl(meta.path, origin);
  document.title = meta.title;

  upsertCanonicalLink(canonicalUrl);
  upsertMetaTag('name', 'description', meta.description);
  upsertMetaTag('name', 'robots', meta.robots);

  upsertMetaTag('property', 'og:type', meta.type);
  upsertMetaTag('property', 'og:site_name', COMPANY_INFO.legalName);
  upsertMetaTag('property', 'og:title', meta.title);
  upsertMetaTag('property', 'og:description', meta.description);
  upsertMetaTag('property', 'og:url', canonicalUrl);
  upsertMetaTag('property', 'og:image', meta.image);

  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', meta.title);
  upsertMetaTag('name', 'twitter:description', meta.description);
  upsertMetaTag('name', 'twitter:image', meta.image);

  upsertDynamicJsonLd(meta.structuredData);
}
