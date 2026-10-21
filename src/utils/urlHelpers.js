/**
 * src/utils/urlHelpers.js
 * Utilities for URL validation, sanitization, and normalization.
 */

/**
 * Normalizes external social/website URLs to ensure an absolute protocol (https://)
 * is present. Prevents relative path resolution (e.g. href="youtube.com" resolving to localhost:5173/youtube.com)
 *
 * @param {string} url - Raw URL string entered by user or returned from database
 * @returns {string} - Fully qualified absolute URL with protocol or empty string
 */
export function normalizeExternalUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Block dangerous script protocols
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return '';
  }

  // Already has http:// or https://
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Protocol-relative //youtube.com
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }

  // Prepend default https://
  return `https://${trimmed}`;
}
