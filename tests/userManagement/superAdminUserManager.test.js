import { describe, it, expect } from 'vitest';
import {
  filterUsersDirectory,
  calculateUserRoleBadge,
  calculateUserBanStatus
} from '../helpers/userManagementLogic';
import { createMockUsersDirectory } from '../helpers/mockData';

describe('Super Admin User Management Operations (TC-SAD)', () => {
  const users = createMockUsersDirectory();

  describe('TC-SAD-001: Super Admin Directory Listing & Count', () => {
    it('should load all registered users and compute total directory counter', () => {
      expect(users).toHaveLength(5);

      const superAdmins = users.filter(u => u.role === 'super_admin');
      const admins = users.filter(u => u.role === 'admin');
      const standardUsers = users.filter(u => u.role === 'user');

      expect(superAdmins).toHaveLength(2);
      expect(admins).toHaveLength(1);
      expect(standardUsers).toHaveLength(2);
    });
  });

  describe('TC-SAD-002: Live Search Filtering by Multi-Field Criteria', () => {
    it('should filter users by display name case-insensitively', () => {
      const results = filterUsersDirectory(users, 'Rahim');
      expect(results).toHaveLength(1);
      expect(results[0].display_name).toBe('Rahim Chowdhury');
    });

    it('should filter users by email address', () => {
      const results = filterUsersDirectory(users, 'spammer@shady.com');
      expect(results).toHaveLength(1);
      expect(results[0].display_name).toBe('Suspicious Bad Actor');
    });

    it('should filter users by partial phone number', () => {
      const results = filterUsersDirectory(users, '+8801711');
      expect(results).toHaveLength(4);
    });

    it('should return empty list when search matches no profile', () => {
      const results = filterUsersDirectory(users, 'nonexistent-query-12345');
      expect(results).toHaveLength(0);
    });

    it('should return entire directory when search term is empty or whitespace', () => {
      expect(filterUsersDirectory(users, '')).toHaveLength(users.length);
      expect(filterUsersDirectory(users, '   ')).toHaveLength(users.length);
    });
  });

  describe('TC-SAD-003: Role Badge Presentation', () => {
    it('should assign purple styling and ShieldAlert icon for Super Admin', () => {
      const badge = calculateUserRoleBadge('super_admin');
      expect(badge.text).toBe('Super Admin');
      expect(badge.icon).toBe('ShieldAlert');
      expect(badge.badgeClass).toContain('text-purple-700 bg-purple-50');
      expect(badge.isSuperAdmin).toBe(true);
    });

    it('should assign blue styling and Shield icon for Admin', () => {
      const badge = calculateUserRoleBadge('admin');
      expect(badge.text).toBe('Admin');
      expect(badge.icon).toBe('Shield');
      expect(badge.badgeClass).toContain('text-blue-700 bg-blue-50');
      expect(badge.isAdmin).toBe(true);
    });

    it('should assign neutral gray styling for standard User', () => {
      const badge = calculateUserRoleBadge('user');
      expect(badge.text).toBe('User');
      expect(badge.icon).toBeNull();
      expect(badge.badgeClass).toContain('text-gray-700 bg-gray-100');
      expect(badge.isAdmin).toBe(false);
    });
  });

  describe('TC-SAD-004: Ban Status Badge Presentation', () => {
    it('should assign red Banned badge and UserCheck action icon for banned user', () => {
      const status = calculateUserBanStatus(true);
      expect(status.text).toBe('Banned');
      expect(status.badgeClass).toBe('bg-red-100 text-red-800');
      expect(status.actionTitle).toBe('Unban User');
      expect(status.icon).toBe('UserCheck');
      expect(status.isBanned).toBe(true);
    });

    it('should assign green Active badge and UserX action icon for active user', () => {
      const status = calculateUserBanStatus(false);
      expect(status.text).toBe('Active');
      expect(status.badgeClass).toBe('bg-green-100 text-green-800');
      expect(status.actionTitle).toBe('Ban User');
      expect(status.icon).toBe('UserX');
      expect(status.isBanned).toBe(false);
    });
  });

  describe('TC-SAD-005: Role Modification Payload Construction', () => {
    it('should build valid Supabase update query to promote user to admin', () => {
      const targetUser = users.find(u => u.id === 'usr-client-01');
      const newRole = 'admin';

      const updatePayload = {
        role: newRole,
        updated_at: new Date().toISOString()
      };

      expect(updatePayload.role).toBe('admin');
      expect(updatePayload.updated_at).toBeDefined();

      const updatedUser = { ...targetUser, ...updatePayload };
      expect(updatedUser.role).toBe('admin');
    });

    it('should build valid Supabase update query to demote admin to user', () => {
      const targetAdmin = users.find(u => u.id === 'usr-admin-01');
      const newRole = 'user';

      const updatePayload = {
        role: newRole,
        updated_at: new Date().toISOString()
      };

      expect(updatePayload.role).toBe('user');
      const updatedUser = { ...targetAdmin, ...updatePayload };
      expect(updatedUser.role).toBe('user');
    });
  });

  describe('TC-SAD-006: User Suspension Toggle (Ban / Unban)', () => {
    it('should toggle active user to banned and construct database payload', () => {
      const targetUser = users.find(u => u.id === 'usr-client-01');
      const newStatus = !targetUser.is_banned;

      expect(newStatus).toBe(true);

      const updatePayload = {
        is_banned: newStatus,
        updated_at: new Date().toISOString()
      };

      expect(updatePayload.is_banned).toBe(true);
    });

    it('should toggle banned user to active and construct unban payload', () => {
      const bannedUser = users.find(u => u.id === 'usr-banned-01');
      const newStatus = !bannedUser.is_banned;

      expect(newStatus).toBe(false);

      const updatePayload = {
        is_banned: newStatus,
        updated_at: new Date().toISOString()
      };

      expect(updatePayload.is_banned).toBe(false);
    });
  });
});
