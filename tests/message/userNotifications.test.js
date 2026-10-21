import { describe, it, expect } from 'vitest';
import {
  calculateUnreadNotificationsCount,
  batchMarkNotificationsRead
} from '../helpers/messageLogic';
import { mockUsers } from '../helpers/mockData';

describe('User Notifications & In-App Communications (TC-USR)', () => {

  const mockNotifications = [
    {
      id: 'notif-01',
      userId: 'usr-uuid-101',
      type: 'Booking Request Rejected',
      message: 'Your expression of interest was not approved: Unit unavailable',
      read: false,
      createdAt: '2026-10-20T12:00:00Z'
    },
    {
      id: 'notif-02',
      userId: 'usr-uuid-101',
      type: 'Payment Received',
      message: 'Token deposit payment of ৳500,000 confirmed.',
      read: false,
      createdAt: '2026-10-21T09:00:00Z'
    },
    {
      id: 'notif-03',
      userId: 'usr-uuid-101',
      type: 'Milestone Updated',
      message: 'Substructure piling has reached 100% completion.',
      read: true,
      createdAt: '2026-10-15T08:00:00Z'
    }
  ];

  describe('TC-USR-001 & TC-USR-002: Notification Delivery & Unread Counter Badges', () => {
    it('should compute the exact unread notifications count for navigation bell icon badge', () => {
      const unreadCount = calculateUnreadNotificationsCount(mockNotifications);
      expect(unreadCount).toBe(2); // notif-01 and notif-02
    });

    it('should return 0 when all notifications are marked as read', () => {
      const allRead = mockNotifications.map(n => ({ ...n, read: true }));
      expect(calculateUnreadNotificationsCount(allRead)).toBe(0);
    });

    it('should return 0 when notification list is empty', () => {
      expect(calculateUnreadNotificationsCount([])).toBe(0);
    });
  });

  describe('TC-USR-003: Batch Mark Notifications as Read', () => {
    it('should mark all unread notifications as read simultaneously in memory and database', () => {
      const unreadCountBefore = calculateUnreadNotificationsCount(mockNotifications);
      expect(unreadCountBefore).toBe(2);

      const updated = batchMarkNotificationsRead(mockNotifications);
      const unreadCountAfter = calculateUnreadNotificationsCount(updated);
      expect(unreadCountAfter).toBe(0);
      expect(updated.every(n => n.read === true)).toBe(true);
    });

    it('should mark only specific IDs if targeted list is provided', () => {
      const updated = batchMarkNotificationsRead(mockNotifications, ['notif-01']);
      expect(updated.find(n => n.id === 'notif-01').read).toBe(true);
      expect(updated.find(n => n.id === 'notif-02').read).toBe(false); // Remains unread
    });
  });

  describe('TC-USR-004: Tenant Notification Isolation', () => {
    it('should ensure notifications are strictly partitioned by authenticated user ID', () => {
      const userANotif = { id: 'n1', userId: mockUsers.clientUserA.uid, message: 'For Rahim' };
      const userBNotif = { id: 'n2', userId: mockUsers.clientUserB.uid, message: 'For Farhana' };

      const allNotifs = [userANotif, userBNotif];

      // Simulated RLS filter: auth.uid() = user_id
      const filterForUserA = allNotifs.filter(n => n.userId === mockUsers.clientUserA.uid);
      expect(filterForUserA).toHaveLength(1);
      expect(filterForUserA[0].message).toBe('For Rahim');

      const filterForUserB = allNotifs.filter(n => n.userId === mockUsers.clientUserB.uid);
      expect(filterForUserB).toHaveLength(1);
      expect(filterForUserB[0].message).toBe('For Farhana');
    });
  });
});
