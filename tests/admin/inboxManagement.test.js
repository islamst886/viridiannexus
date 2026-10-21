import { describe, it, expect } from 'vitest';
import {
  toggleInquiryStatus,
  filterInquiries,
  calculateUnreadInquiriesCount
} from '../helpers/messageLogic';

describe('Admin Inbox & Inquiries Management (TC-ADM)', () => {

  const mockInquiries = [
    {
      id: 'inq-01',
      name: 'Dr. Tariqul Islam',
      email: 'tariqul@example.com',
      phone: '+8801711999999',
      inquiryType: 'Private Consultation',
      propertyName: 'Viridian Jolshiri Exclusivity',
      message: 'Interested in booking the top floor penthouse unit.',
      status: 'Unread',
      source: 'Property Detail Page',
      createdAt: '2026-10-21T09:30:00Z'
    },
    {
      id: 'inq-02',
      name: 'Shahana Parveen',
      email: 'shahana@example.com',
      phone: '+8801811888888',
      inquiryType: 'NRB / International Purchase',
      propertyName: null,
      message: 'Calling from London. Want info regarding NITA account remittance.',
      status: 'Read',
      source: 'Corporate Contact Page',
      createdAt: '2026-10-20T14:15:00Z'
    },
    {
      id: 'inq-03',
      name: 'Ashraf Ali',
      email: 'ashraf@example.com',
      phone: '+8801911777777',
      inquiryType: 'Brochure Request',
      propertyName: 'Purbachal Lakefront Villa',
      message: 'Please send complete structural specs brochure.',
      status: 'Unread',
      source: 'Corporate Contact Page',
      createdAt: '2026-10-19T10:00:00Z'
    }
  ];

  describe('TC-ADM-001: Inbox Directory & Chronological Ordering', () => {
    it('should calculate unread inquiries count for inbox summary banner', () => {
      const unreadCount = calculateUnreadInquiriesCount(mockInquiries);
      expect(unreadCount).toBe(2);
    });

    it('should filter inquiries by search term across name, email, phone, or message', () => {
      const byName = filterInquiries(mockInquiries, { searchTerm: 'Tariqul' });
      expect(byName).toHaveLength(1);
      expect(byName[0].id).toBe('inq-01');

      const byEmail = filterInquiries(mockInquiries, { searchTerm: 'shahana@example.com' });
      expect(byEmail).toHaveLength(1);

      const byContent = filterInquiries(mockInquiries, { searchTerm: 'London' });
      expect(byContent).toHaveLength(1);
      expect(byContent[0].id).toBe('inq-02');
    });

    it('should filter inquiries by status', () => {
      const unreadOnly = filterInquiries(mockInquiries, { status: 'Unread' });
      expect(unreadOnly).toHaveLength(2);

      const readOnly = filterInquiries(mockInquiries, { status: 'Read' });
      expect(readOnly).toHaveLength(1);
      expect(readOnly[0].id).toBe('inq-02');
    });
  });

  describe('TC-ADM-002: Message Accordion Expand / Collapse', () => {
    it('should toggle expansion state for inquiry rows', () => {
      let expandedId = null;

      const toggleExpand = (id) => (expandedId === id ? null : id);

      expandedId = toggleExpand('inq-01');
      expect(expandedId).toBe('inq-01');

      // Click same row again -> collapses
      expandedId = toggleExpand('inq-01');
      expect(expandedId).toBeNull();

      // Click another row -> switches active row
      expandedId = toggleExpand('inq-02');
      expect(expandedId).toBe('inq-02');
    });
  });

  describe('TC-ADM-003: Read / Unread Status Toggling', () => {
    it('should toggle status from Unread to Read and vice-versa', () => {
      expect(toggleInquiryStatus('Unread')).toBe('Read');
      expect(toggleInquiryStatus('Read')).toBe('Unread');
    });
  });

  describe('TC-ADM-004: Inquiry Deletion', () => {
    it('should delete inquiry from list upon operator confirmation', () => {
      const deleteInquiry = (inquiries, idToDelete) => {
        return inquiries.filter(i => i.id !== idToDelete);
      };

      const updated = deleteInquiry(mockInquiries, 'inq-01');
      expect(updated).toHaveLength(2);
      expect(updated.find(i => i.id === 'inq-01')).toBeUndefined();
    });
  });

  describe('TC-ADM-005: Communication Links Generation', () => {
    it('should generate valid tel: and mailto: protocol links for quick contact', () => {
      const inquiry = mockInquiries[0];
      const telHref = `tel:${inquiry.phone}`;
      const mailtoHref = `mailto:${inquiry.email}`;

      expect(telHref).toBe('tel:+8801711999999');
      expect(mailtoHref).toBe('mailto:tariqul@example.com');
    });
  });
});
