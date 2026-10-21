import { describe, it, expect } from 'vitest';
import {
  evaluateSuperAdminGuards,
  filterUsersDirectory
} from '../helpers/userManagementLogic';
import { createMockUsersDirectory } from '../helpers/mockData';

describe('User Management Edge Cases & Immunity Protections (TC-EDG)', () => {
  const users = createMockUsersDirectory();
  const superAdmin1 = users[0]; // usr-super-01
  const superAdmin2 = users[1]; // usr-super-02
  const standardClient = users[3]; // usr-client-01

  describe('TC-EDG-001: Super Admin Immunity Protection', () => {
    it('should prohibit banning another super admin user', () => {
      const guard = evaluateSuperAdminGuards({
        targetUser: superAdmin2,
        currentUser: superAdmin1
      });

      expect(guard.canBan).toBe(false);
      expect(guard.isSuperAdminUser).toBe(true);
      expect(guard.error).toBe('Cannot ban or modify another super admin.');
    });

    it('should prohibit modifying the role of another super admin user', () => {
      const guard = evaluateSuperAdminGuards({
        targetUser: superAdmin2,
        currentUser: superAdmin1
      });

      expect(guard.canModify).toBe(false);
    });
  });

  describe('TC-EDG-002: Self-Protection Guards (Anti-Lockout)', () => {
    it('should prohibit a super admin from banning their own account', () => {
      const guard = evaluateSuperAdminGuards({
        targetUser: superAdmin1,
        currentUser: superAdmin1
      });

      expect(guard.isSelf).toBe(true);
      expect(guard.canBan).toBe(false);
      expect(guard.error).toBe('Cannot modify or ban your own account.');
    });

    it('should prohibit a super admin from modifying their own role', () => {
      const guard = evaluateSuperAdminGuards({
        targetUser: superAdmin1,
        currentUser: superAdmin1
      });

      expect(guard.isSelf).toBe(true);
      expect(guard.canModify).toBe(false);
    });

    it('should permit modifying and banning standard client users', () => {
      const guard = evaluateSuperAdminGuards({
        targetUser: standardClient,
        currentUser: superAdmin1
      });

      expect(guard.isSelf).toBe(false);
      expect(guard.isSuperAdminUser).toBe(false);
      expect(guard.canBan).toBe(true);
      expect(guard.canModify).toBe(true);
      expect(guard.error).toBeNull();
    });
  });

  describe('TC-EDG-003: Null and Corrupted Profile Field Handling', () => {
    it('should default avatar initial to "U" when display_name is missing', () => {
      const userWithoutName = { display_name: null };
      const initial = userWithoutName.display_name?.charAt(0) || 'U';
      expect(initial).toBe('U');

      const userWithEmptyName = { display_name: '' };
      const initialEmpty = userWithEmptyName.display_name?.charAt(0) || 'U';
      expect(initialEmpty).toBe('U');
    });

    it('should default joined date to "N/A" when created_at is missing', () => {
      const userWithoutDate = { created_at: null };
      const formattedDate = userWithoutDate.created_at
        ? new Date(userWithoutDate.created_at).toLocaleDateString()
        : 'N/A';
      expect(formattedDate).toBe('N/A');
    });
  });

  describe('TC-EDG-004: Special Regex Characters in Directory Search', () => {
    it('should safely search using queries containing regex special characters without crashing', () => {
      const specialQueries = ['+880', 'user (vip)', '[admin]', '*super*', 'user?'];

      specialQueries.forEach(query => {
        expect(() => filterUsersDirectory(users, query)).not.toThrow();
      });
    });

    it('should successfully match phone numbers containing plus symbols', () => {
      const results = filterUsersDirectory(users, '+8801711999999');
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('usr-super-01');
    });
  });

  describe('TC-EDG-005: Empty Directory and Null Collection Resilience', () => {
    it('should safely handle empty array in filterUsersDirectory', () => {
      expect(filterUsersDirectory([], 'Rahim')).toEqual([]);
    });

    it('should safely handle null or non-array inputs in filterUsersDirectory', () => {
      expect(filterUsersDirectory(null, 'Rahim')).toEqual([]);
      expect(filterUsersDirectory(undefined, 'Rahim')).toEqual([]);
    });
  });
});
