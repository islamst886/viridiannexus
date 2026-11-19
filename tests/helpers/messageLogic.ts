/**
 * Core Domain Business Logic for Viridian Nexus Messaging & Communications Subsystem
 * Extracted for clean unit testing and enterprise test suite architecture.
 */

export interface InquiryFormInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  message?: string | null;
  agreedToPolicy?: boolean | null;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface InquiryItem {
  id?: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  message?: string | null;
  propertyName?: string | null;
  property_name?: string | null;
  status?: string | null;
  inquiryType?: string | null;
  inquiry_type?: string | null;
  createdAt?: unknown;
  [key: string]: unknown;
}

export interface NotificationRecord {
  id: string;
  read?: boolean;
  [key: string]: unknown;
}

export function validateInquiryForm({
  name,
  phone,
  email,
  message,
  agreedToPolicy,
}: InquiryFormInput): ValidationResult {
  if (!name?.trim() || !phone?.trim() || !email?.trim() || !message?.trim()) {
    return { valid: false, error: 'Please fill out all fields.' };
  }
  if (!/\S+@\S+\.\S+/.test(email)) {
    return { valid: false, error: 'Valid email is required.' };
  }
  if (!agreedToPolicy) {
    return { valid: false, error: 'You must agree to the Privacy Policy to submit.' };
  }
  return { valid: true };
}

export function formatContactPropertyName(id: string | null | undefined): string {
  if (!id) return '';
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function toggleInquiryStatus(currentStatus: string): 'Read' | 'Unread' {
  return currentStatus === 'Unread' ? 'Read' : 'Unread';
}

export function filterInquiries<T extends InquiryItem>(
  inquiries: T[] = [],
  { searchTerm = '', status = 'All', topic = 'All' }: { searchTerm?: string; status?: string; topic?: string } = {}
): T[] {
  return inquiries.filter((msg) => {
    if (searchTerm?.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const nameMatch = msg.name?.toLowerCase().includes(term);
      const emailMatch = msg.email?.toLowerCase().includes(term);
      const phoneMatch = msg.phone?.toLowerCase().includes(term);
      const msgMatch = msg.message?.toLowerCase().includes(term);
      const propMatch =
        msg.propertyName?.toLowerCase().includes(term) ||
        msg.property_name?.toLowerCase().includes(term);
      if (!nameMatch && !emailMatch && !phoneMatch && !msgMatch && !propMatch) return false;
    }

    if (status !== 'All') {
      if (msg.status !== status) return false;
    }

    if (topic !== 'All') {
      const msgTopic = msg.inquiryType || msg.inquiry_type || 'General';
      if (msgTopic !== topic) return false;
    }

    return true;
  });
}

export function calculateUnreadInquiriesCount(inquiries: Array<{ status?: string | null }> = []): number {
  return inquiries.filter((i) => i.status === 'Unread').length;
}

export function calculateUnreadNotificationsCount(notifications: Array<{ read?: boolean }> = []): number {
  return notifications.filter((n) => !n.read).length;
}

export function batchMarkNotificationsRead<T extends NotificationRecord>(
  notifications: T[] = [],
  idsToMark: string[] = []
): T[] {
  const targetIds = new Set(idsToMark.length ? idsToMark : notifications.map((n) => n.id));
  return notifications.map((n) => (targetIds.has(n.id) ? { ...n, read: true } : n));
}

export function parseInquiryDate(createdAt: unknown): string {
  if (!createdAt) return 'N/A';
  // Check for Firestore legacy timestamp object
  if (typeof createdAt === 'object' && createdAt !== null && 'seconds' in createdAt) {
    const seconds = (createdAt as { seconds?: unknown }).seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      return new Date(seconds * 1000).toISOString();
    }
  }
  // Standard ISO string or timestamp
  if (typeof createdAt === 'string' || typeof createdAt === 'number' || createdAt instanceof Date) {
    const dateObj = new Date(createdAt);
    return Number.isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toISOString();
  }
  return 'N/A';
}

export function cleansePhoneNumber(phone: unknown): string {
  if (!phone) return '';
  // Remove spaces, hyphens, and parentheses, retain leading +
  return String(phone).replace(/[^\d+]/g, '');
}
