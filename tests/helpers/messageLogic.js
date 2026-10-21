/**
 * Core Domain Business Logic for Viridian Nexus Messaging & Communications Subsystem
 * Extracted for clean unit testing and enterprise test suite architecture.
 */

export function validateInquiryForm({ name, phone, email, message, agreedToPolicy }) {
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

export function formatContactPropertyName(id) {
  if (!id) return '';
  return id
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function toggleInquiryStatus(currentStatus) {
  return currentStatus === 'Unread' ? 'Read' : 'Unread';
}

export function filterInquiries(inquiries = [], { searchTerm = '', status = 'All', topic = 'All' } = {}) {
  return inquiries.filter(msg => {
    if (searchTerm?.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const nameMatch = msg.name?.toLowerCase().includes(term);
      const emailMatch = msg.email?.toLowerCase().includes(term);
      const phoneMatch = msg.phone?.toLowerCase().includes(term);
      const msgMatch = msg.message?.toLowerCase().includes(term);
      const propMatch = msg.propertyName?.toLowerCase().includes(term) || msg.property_name?.toLowerCase().includes(term);
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

export function calculateUnreadInquiriesCount(inquiries = []) {
  return inquiries.filter(i => i.status === 'Unread').length;
}

export function calculateUnreadNotificationsCount(notifications = []) {
  return notifications.filter(n => !n.read).length;
}

export function batchMarkNotificationsRead(notifications = [], idsToMark = []) {
  const targetIds = new Set(idsToMark.length ? idsToMark : notifications.map(n => n.id));
  return notifications.map(n => 
    targetIds.has(n.id) ? { ...n, read: true } : n
  );
}

export function parseInquiryDate(createdAt) {
  if (!createdAt) return 'N/A';
  // Check for Firestore legacy timestamp object
  if (typeof createdAt === 'object' && createdAt.seconds) {
    return new Date(createdAt.seconds * 1000).toISOString();
  }
  // Standard ISO string or timestamp
  const dateObj = new Date(createdAt);
  return isNaN(dateObj.getTime()) ? 'N/A' : dateObj.toISOString();
}

export function cleansePhoneNumber(phone) {
  if (!phone) return '';
  // Remove spaces, hyphens, and parentheses, retain leading +
  const cleaned = String(phone).replace(/[^\d+]/g, '');
  return cleaned;
}
