export const NEWSLETTER_MESSAGES = {
  INVALID_EMAIL: 'Please enter a valid email address.',
  SUCCESS: 'Welcome to Viridian Nexus Development Ltd. Exclusive Updates.',
  ALREADY_SUBSCRIBED: 'You are already subscribed to our exclusive updates.',
  GENERIC_ERROR: 'An error occurred. Please try again later.',
} as const;

export interface NewsletterErrorOutcome {
  status: 'already_subscribed' | 'error';
  message: string;
}

const NEWSLETTER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNSAFE_EMAIL_CHARS_REGEX = /[<>'";]/;
const MAX_EMAIL_LENGTH = 254;

/**
 * Normalizes a newsletter email address by trimming surrounding whitespace and folding to lowercase.
 */
export function normalizeNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates a newsletter email address for syntax, RFC 5321 length limits, and unsafe characters.
 */
export function isValidNewsletterEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) {
    return false;
  }
  if (UNSAFE_EMAIL_CHARS_REGEX.test(trimmed)) {
    return false;
  }
  return NEWSLETTER_EMAIL_REGEX.test(trimmed);
}

/**
 * Checks whether an error returned by Supabase/PostgREST represents a duplicate subscriber conflict.
 */
export function isDuplicateNewsletterError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as Record<string, unknown>;

  if (record.code === '23505') {
    return true;
  }

  if (record.status === 409 || record.statusCode === 409 || record.statusCode === '409') {
    return true;
  }

  if (typeof record.message === 'string') {
    const msg = record.message;
    if (
      msg.includes('newsletter_subscribers_email_key') ||
      msg.toLowerCase().includes('duplicate key')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Classifies a newsletter subscription error into a user-facing status and message.
 */
export function classifyNewsletterSubscribeError(error: unknown): NewsletterErrorOutcome {
  if (isDuplicateNewsletterError(error)) {
    return {
      status: 'already_subscribed',
      message: NEWSLETTER_MESSAGES.ALREADY_SUBSCRIBED,
    };
  }

  return {
    status: 'error',
    message: NEWSLETTER_MESSAGES.GENERIC_ERROR,
  };
}
