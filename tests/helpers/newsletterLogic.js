// tests/helpers/newsletterLogic.js
// Pure domain logic for public newsletter subscription, user investor handling, admin newsletter manager, and super admin governance

/**
 * Validates email address according to production RFC 5322 regex and security constraints
 */
export function validateNewsletterEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  // RFC 5321 length constraint (max 254 chars)
  if (trimmed.length > 254) {
    return { valid: false, error: 'Email exceeds maximum allowable length of 254 characters.' };
  }

  // Security check: reject explicit script tags or SQL quotes
  if (/[<>'";]/.test(trimmed)) {
    return { valid: false, error: 'Email contains invalid or unsafe characters.' };
  }

  // Production regex from Layout.jsx: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }

  return {
    valid: true,
    normalizedEmail: trimmed.toLowerCase()
  };
}

/**
 * Normalizes email address by trimming whitespace and folding to lowercase
 */
export function normalizeNewsletterEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Formats subscribed_at timestamp safely into a localized date string
 */
export function formatSubscriberDate(dateString) {
  if (!dateString) return 'Unknown Date';
  const dateObj = new Date(dateString);
  if (isNaN(dateObj.getTime())) {
    return 'Unknown Date';
  }
  return dateObj.toLocaleDateString();
}

/**
 * Formats subscriber lifecycle status into display text and CSS classes
 */
export function formatSubscriberStatus(status) {
  const normalized = (status || 'Active').toLowerCase();

  switch (normalized) {
    case 'active':
      return {
        text: 'Active',
        badgeClass: 'bg-green-100 text-green-800'
      };
    case 'unsubscribed':
      return {
        text: 'Unsubscribed',
        badgeClass: 'bg-gray-100 text-gray-800'
      };
    case 'bounced':
      return {
        text: 'Bounced',
        badgeClass: 'bg-red-100 text-red-800'
      };
    default:
      return {
        text: status || 'Active',
        badgeClass: 'bg-green-100 text-green-800'
      };
  }
}

/**
 * Filters subscriber list by case-insensitive email query
 */
export function filterSubscribers(subscribers, searchQuery) {
  if (!Array.isArray(subscribers)) return [];
  if (!searchQuery || !String(searchQuery).trim()) return subscribers;

  const query = String(searchQuery).trim().toLowerCase();
  return subscribers.filter(sub => sub && sub.email && sub.email.toLowerCase().includes(query));
}

/**
 * Exports subscribers to standard CSV format
 */
export function exportSubscribersToCSV(subscribers) {
  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return 'Email,Status,SubscribedDate\n';
  }

  const rows = subscribers.map(sub => {
    const email = sub.email || '';
    const status = sub.status || 'Active';
    const date = sub.subscribed_at ? new Date(sub.subscribed_at).toISOString() : '';
    return `"${email}","${status}","${date}"`;
  });

  return ['Email,Status,SubscribedDate', ...rows].join('\n');
}

/**
 * Simulates subscriber removal with confirmation dialog check
 */
export function handleSubscriberDeletion(subscribers, idToDelete, userConfirmed) {
  if (!Array.isArray(subscribers)) {
    return { updatedSubscribers: [], deleted: false };
  }

  if (!userConfirmed) {
    return { updatedSubscribers: [...subscribers], deleted: false };
  }

  const exists = subscribers.some(s => s.id === idToDelete);
  if (!exists) {
    return { updatedSubscribers: [...subscribers], deleted: false };
  }

  return {
    updatedSubscribers: subscribers.filter(s => s.id !== idToDelete),
    deleted: true
  };
}

/**
 * Evaluates Supabase Row Level Security (RLS) for newsletter_subscribers table
 */
export function evaluateNewsletterRLS(userRole, action) {
  const isAdmin = userRole === 'admin' || userRole === 'super_admin';

  // "newsletter_insert" ON public.newsletter_subscribers FOR INSERT WITH CHECK (true);
  if (action === 'INSERT') {
    return true; // Anyone can subscribe
  }

  // "newsletter_admin" ON public.newsletter_subscribers FOR ALL USING (is_admin());
  if (action === 'SELECT' || action === 'UPDATE' || action === 'DELETE') {
    return isAdmin;
  }

  return false;
}
