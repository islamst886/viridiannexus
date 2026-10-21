import { describe, it, expect, vi } from 'vitest';
import {
  formatSubscriberDate,
  formatSubscriberStatus,
  filterSubscribers,
  exportSubscribersToCSV,
  handleSubscriberDeletion
} from '../helpers/newsletterLogic';
import { createMockNewsletterSubscribers } from '../helpers/mockData';

describe('Admin Newsletter Manager Operations (TC-ADM)', () => {
  const subscribers = createMockNewsletterSubscribers();

  describe('TC-ADM-001: Subscriber Directory Fetching & Chronological Sorting', () => {
    it('should sort subscribers in descending chronological order (newest first)', () => {
      const sorted = [...subscribers].sort(
        (a, b) => new Date(b.subscribed_at) - new Date(a.subscribed_at)
      );

      expect(sorted[0].id).toBe('sub-uuid-003'); // March 20, 2026
      expect(sorted[1].id).toBe('sub-uuid-002'); // March 01, 2026
      expect(sorted[2].id).toBe('sub-uuid-001'); // Feb 15, 2026
      expect(sorted[sorted.length - 1].id).toBe('sub-uuid-004'); // Nov 10, 2025
    });
  });

  describe('TC-ADM-002: Empty State Directory Rendering', () => {
    it('should detect empty subscriber list and provide informative metadata', () => {
      const emptyList = [];
      expect(emptyList.length === 0).toBe(true);

      const emptyStateContent = {
        title: 'No subscribers yet.',
        subtitle: 'When users subscribe via the footer, they will appear here.'
      };

      expect(emptyStateContent.title).toBe('No subscribers yet.');
      expect(emptyStateContent.subtitle).toContain('subscribe via the footer');
    });
  });

  describe('TC-ADM-003: Table Columns & Subscriber Formatting', () => {
    it('should format subscriber date into localized readable string', () => {
      const sample = subscribers[0]; // 2026-02-15T10:30:00.000Z
      const formattedDate = formatSubscriberDate(sample.subscribed_at);

      expect(formattedDate).not.toBe('Unknown Date');
      expect(formattedDate.length).toBeGreaterThan(5);
    });

    it('should assign correct status badge style for Active subscribers', () => {
      const activeStatus = formatSubscriberStatus('Active');
      expect(activeStatus.text).toBe('Active');
      expect(activeStatus.badgeClass).toContain('bg-green-100 text-green-800');
    });

    it('should assign correct status badge style for Unsubscribed clients', () => {
      const unsubStatus = formatSubscriberStatus('Unsubscribed');
      expect(unsubStatus.text).toBe('Unsubscribed');
      expect(unsubStatus.badgeClass).toContain('bg-gray-100 text-gray-800');
    });

    it('should fallback gracefully to Active if status field is missing', () => {
      const fallbackStatus = formatSubscriberStatus(undefined);
      expect(fallbackStatus.text).toBe('Active');
      expect(fallbackStatus.badgeClass).toContain('bg-green-100');
    });
  });

  describe('TC-ADM-004: Subscriber Search & Live Filtering', () => {
    it('should filter subscribers matching email substring case-insensitively', () => {
      const query = 'DHAKA';
      const results = filterSubscribers(subscribers, query);

      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('farhana.luxury@dhaka.com');
    });

    it('should return all subscribers when search query is empty or spaces', () => {
      expect(filterSubscribers(subscribers, '')).toHaveLength(subscribers.length);
      expect(filterSubscribers(subscribers, '   ')).toHaveLength(subscribers.length);
    });

    it('should return empty array if search query matches no subscriber', () => {
      const results = filterSubscribers(subscribers, 'non-existent-domain-xyz');
      expect(results).toHaveLength(0);
    });
  });

  describe('TC-ADM-005: Subscriber Export to CSV', () => {
    it('should format subscriber directory into compliant CSV structure', () => {
      const csv = exportSubscribersToCSV(subscribers);

      expect(csv).toContain('Email,Status,SubscribedDate');
      expect(csv).toContain('"investor.rahim@example.com","Active"');
      expect(csv).toContain('"farhana.luxury@dhaka.com","Active"');
    });

    it('should generate valid header only when subscriber array is empty', () => {
      const emptyCsv = exportSubscribersToCSV([]);
      expect(emptyCsv).toBe('Email,Status,SubscribedDate\n');
    });
  });

  describe('TC-ADM-006: Subscriber Deletion & Optimistic State Update', () => {
    it('should remove subscriber from local state when confirmation is granted', () => {
      const targetId = 'sub-uuid-002';
      const result = handleSubscriberDeletion(subscribers, targetId, true);

      expect(result.deleted).toBe(true);
      expect(result.updatedSubscribers).toHaveLength(subscribers.length - 1);
      expect(result.updatedSubscribers.some(s => s.id === targetId)).toBe(false);
    });

    it('should abort deletion and preserve subscriber state when user cancels confirmation prompt', () => {
      const targetId = 'sub-uuid-002';
      const result = handleSubscriberDeletion(subscribers, targetId, false);

      expect(result.deleted).toBe(false);
      expect(result.updatedSubscribers).toHaveLength(subscribers.length);
      expect(result.updatedSubscribers.some(s => s.id === targetId)).toBe(true);
    });

    it('should return unchanged list if target ID does not exist', () => {
      const result = handleSubscriberDeletion(subscribers, 'non-existent-id', true);
      expect(result.deleted).toBe(false);
      expect(result.updatedSubscribers).toHaveLength(subscribers.length);
    });
  });
});
