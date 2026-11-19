// tests/helpers/siteSettingsLogic.ts
// Pure domain logic for Site Settings, Floating WhatsApp, Social Links, Property Taxonomy, and RLS

export const DEFAULT_PROPERTY_TYPES: string[] = [
  'Apartment',
  'Commercial',
  'Duplex',
  'Luxury Apartment',
  'Penthouse',
  'Smart Home',
  'Townhouse',
  'Villa',
].sort();

export interface SiteSettingsInput {
  facebookUrl?: unknown;
  linkedinUrl?: unknown;
  youtubeUrl?: unknown;
  whatsappNumber?: unknown;
  [key: string]: unknown;
}

export interface SiteSettingsValidationResult {
  valid: boolean;
  errors: string[];
  sanitized: Record<string, unknown>;
}

/**
 * Validates site settings form inputs and sanitizes URLs & phone numbers
 */
export function validateSiteSettingsForm(formData: unknown): SiteSettingsValidationResult {
  const errors: string[] = [];
  if (!formData || typeof formData !== 'object') {
    return { valid: false, errors: ['Form data is required.'], sanitized: {} };
  }

  const record = formData as SiteSettingsInput;
  const urlFields = ['facebookUrl', 'linkedinUrl', 'youtubeUrl'] as const;
  const sanitized: Record<string, unknown> = { ...record };

  urlFields.forEach((field) => {
    const val = record[field];
    if (val && typeof val === 'string' && val.trim()) {
      const trimmed = val.trim();
      // Block dangerous protocols
      if (/^(javascript|data|vbscript):/i.test(trimmed)) {
        errors.push(`Invalid protocol in ${field}. Only HTTP and HTTPS URLs are allowed.`);
      } else if (!/^https?:\/\/.+/i.test(trimmed)) {
        errors.push(`URL for ${field} must start with http:// or https://`);
      }
      sanitized[field] = trimmed;
    } else {
      sanitized[field] = '';
    }
  });

  const rawPhone = record.whatsappNumber;
  if (rawPhone && typeof rawPhone === 'string') {
    sanitized.whatsappNumber = rawPhone.replace(/\D/g, '');
  } else {
    sanitized.whatsappNumber = '';
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}

/**
 * Cleans phone number to digits only for wa.me URL
 */
export function cleanWhatsAppNumber(number: unknown): string {
  if (!number || typeof number !== 'string') return '';
  return number.replace(/\D/g, '');
}

/**
 * Generates direct chat link for WhatsApp widget
 */
export function generateWhatsAppLink(rawNumber: unknown): string | null {
  const cleanNumber = cleanWhatsAppNumber(rawNumber);
  if (!cleanNumber) return null;
  return `https://wa.me/${cleanNumber}`;
}

export interface ResolvedSocialLinks {
  hasFacebook: boolean;
  hasLinkedin: boolean;
  hasYoutube: boolean;
  hasWhatsApp: boolean;
  visibleCount: number;
}

/**
 * Resolves active social links to determine footer icon rendering
 */
export function resolveSocialLinks(siteSettings: unknown): ResolvedSocialLinks {
  if (!siteSettings || typeof siteSettings !== 'object') {
    return {
      hasFacebook: false,
      hasLinkedin: false,
      hasYoutube: false,
      hasWhatsApp: false,
      visibleCount: 0,
    };
  }

  const settings = siteSettings as SiteSettingsInput;
  const hasFacebook = Boolean(typeof settings.facebookUrl === 'string' && settings.facebookUrl.trim());
  const hasLinkedin = Boolean(typeof settings.linkedinUrl === 'string' && settings.linkedinUrl.trim());
  const hasYoutube = Boolean(typeof settings.youtubeUrl === 'string' && settings.youtubeUrl.trim());
  const hasWhatsApp = Boolean(
    settings.whatsappNumber && cleanWhatsAppNumber(settings.whatsappNumber).length > 0
  );

  let visibleCount = 0;
  if (hasFacebook) visibleCount++;
  if (hasLinkedin) visibleCount++;
  if (hasYoutube) visibleCount++;
  if (hasWhatsApp) visibleCount++;

  return {
    hasFacebook,
    hasLinkedin,
    hasYoutube,
    hasWhatsApp,
    visibleCount,
  };
}

/**
 * Normalizes external URLs to ensure an absolute protocol (https://) is present
 */
export function normalizeExternalUrl(url: unknown): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return '';
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  return `https://${trimmed}`;
}

/**
 * Prepares payload for Supabase upsert on public.settings
 */
export function prepareSettingsUpsertPayload(
  formData: SiteSettingsInput,
  userId?: string | null
): {
  key: 'site';
  value: Record<string, unknown>;
} {
  return {
    key: 'site',
    value: {
      ...formData,
      facebookUrl: normalizeExternalUrl(formData.facebookUrl),
      linkedinUrl: normalizeExternalUrl(formData.linkedinUrl),
      youtubeUrl: normalizeExternalUrl(formData.youtubeUrl),
      whatsappNumber: cleanWhatsAppNumber(formData.whatsappNumber),
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: userId || null,
    },
  };
}

/**
 * Adds a new property type to taxonomy with deduplication and alphabetical sorting
 */
export function addPropertyTypePure(newType: unknown, currentTypes: string[] = []): string[] {
  if (!newType || !String(newType).trim()) {
    return [...currentTypes].sort();
  }
  const trimmed = String(newType).trim();
  const set = new Set([...currentTypes, trimmed]);
  return Array.from(set).sort();
}

/**
 * Removes a property type from taxonomy preserving alphabetical sorting
 */
export function removePropertyTypePure(typeToRemove: unknown, currentTypes: string[] = []): string[] {
  if (!typeToRemove) return [...currentTypes].sort();
  return currentTypes.filter((t) => t !== typeToRemove).sort();
}

export interface SiteSettingsAccessResult {
  allowed: boolean;
  isReadOnly: boolean;
  canSave: boolean;
  status: 'redirect' | 'permission_denied' | 'granted';
  target?: string;
  warningMessage?: string;
}

/**
 * Evaluates route and edit access to Site Settings
 */
export function evaluateSiteSettingsAccess({
  isLoggedIn,
  userRole,
}: {
  isLoggedIn: boolean;
  userRole?: string | null;
}): SiteSettingsAccessResult {
  if (!isLoggedIn) {
    return {
      allowed: false,
      isReadOnly: true,
      canSave: false,
      status: 'redirect',
      target: '/admin',
    };
  }

  const isSuperAdmin = userRole === 'super_admin';

  if (!isSuperAdmin) {
    return {
      allowed: false,
      isReadOnly: true,
      canSave: false,
      status: 'permission_denied',
      warningMessage: 'You are viewing in read-only mode. Only Super Admins can modify these settings.',
    };
  }

  return {
    allowed: true,
    isReadOnly: false,
    canSave: true,
    status: 'granted',
  };
}

/**
 * Evaluates Database Row Level Security (RLS) on public.settings
 */
export function evaluateSettingsRLS(userRole: string | null | undefined, action: string): boolean {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);
  if (action === 'SELECT') {
    return true; // public read
  }

  // CREATE POLICY "settings_write" ON public.settings FOR ALL USING (is_admin());
  if (action === 'INSERT' || action === 'UPDATE' || action === 'DELETE') {
    return isAdmin;
  }

  return false;
}
