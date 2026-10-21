// tests/helpers/siteSettingsLogic.js
// Pure domain logic for Site Settings, Floating WhatsApp, Social Links, Property Taxonomy, and RLS

export const DEFAULT_PROPERTY_TYPES = [
  'Apartment',
  'Commercial',
  'Duplex',
  'Luxury Apartment',
  'Penthouse',
  'Smart Home',
  'Townhouse',
  'Villa'
].sort();

/**
 * Validates site settings form inputs and sanitizes URLs & phone numbers
 */
export function validateSiteSettingsForm(formData) {
  const errors = [];
  if (!formData || typeof formData !== 'object') {
    return { valid: false, errors: ['Form data is required.'], sanitized: {} };
  }

  const urlFields = ['facebookUrl', 'linkedinUrl', 'youtubeUrl'];
  const sanitized = { ...formData };

  urlFields.forEach(field => {
    const val = formData[field];
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

  const rawPhone = formData.whatsappNumber;
  if (rawPhone && typeof rawPhone === 'string') {
    sanitized.whatsappNumber = rawPhone.replace(/\D/g, '');
  } else {
    sanitized.whatsappNumber = '';
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized
  };
}

/**
 * Cleans phone number to digits only for wa.me URL
 */
export function cleanWhatsAppNumber(number) {
  if (!number || typeof number !== 'string') return '';
  return number.replace(/\D/g, '');
}

/**
 * Generates direct chat link for WhatsApp widget
 */
export function generateWhatsAppLink(rawNumber) {
  const cleanNumber = cleanWhatsAppNumber(rawNumber);
  if (!cleanNumber) return null;
  return `https://wa.me/${cleanNumber}`;
}

/**
 * Resolves active social links to determine footer icon rendering
 */
export function resolveSocialLinks(siteSettings) {
  if (!siteSettings || typeof siteSettings !== 'object') {
    return {
      hasFacebook: false,
      hasLinkedin: false,
      hasYoutube: false,
      hasWhatsApp: false,
      visibleCount: 0
    };
  }

  const hasFacebook = Boolean(siteSettings.facebookUrl && siteSettings.facebookUrl.trim());
  const hasLinkedin = Boolean(siteSettings.linkedinUrl && siteSettings.linkedinUrl.trim());
  const hasYoutube = Boolean(siteSettings.youtubeUrl && siteSettings.youtubeUrl.trim());
  const hasWhatsApp = Boolean(siteSettings.whatsappNumber && cleanWhatsAppNumber(siteSettings.whatsappNumber).length > 0);

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
    visibleCount
  };
}

/**
 * Normalizes external URLs to ensure an absolute protocol (https://) is present
 */
export function normalizeExternalUrl(url) {
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
export function prepareSettingsUpsertPayload(formData, userId) {
  return {
    key: 'site',
    value: {
      ...formData,
      facebookUrl: normalizeExternalUrl(formData.facebookUrl),
      linkedinUrl: normalizeExternalUrl(formData.linkedinUrl),
      youtubeUrl: normalizeExternalUrl(formData.youtubeUrl),
      whatsappNumber: cleanWhatsAppNumber(formData.whatsappNumber),
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedBy: userId || null
    }
  };
}

/**
 * Adds a new property type to taxonomy with deduplication and alphabetical sorting
 */
export function addPropertyTypePure(newType, currentTypes = []) {
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
export function removePropertyTypePure(typeToRemove, currentTypes = []) {
  if (!typeToRemove) return [...currentTypes].sort();
  return currentTypes.filter(t => t !== typeToRemove).sort();
}

/**
 * Evaluates route and edit access to Site Settings
 */
export function evaluateSiteSettingsAccess({ isLoggedIn, userRole }) {
  if (!isLoggedIn) {
    return {
      allowed: false,
      isReadOnly: true,
      canSave: false,
      status: 'redirect',
      target: '/admin'
    };
  }

  const isSuperAdmin = userRole === 'super_admin';

  if (!isSuperAdmin) {
    return {
      allowed: false,
      isReadOnly: true,
      canSave: false,
      status: 'permission_denied',
      warningMessage: 'You are viewing in read-only mode. Only Super Admins can modify these settings.'
    };
  }

  return {
    allowed: true,
    isReadOnly: false,
    canSave: true,
    status: 'granted'
  };
}

/**
 * Evaluates Database Row Level Security (RLS) on public.settings
 */
export function evaluateSettingsRLS(userRole, action) {
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
