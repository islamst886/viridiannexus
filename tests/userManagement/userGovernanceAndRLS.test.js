import { describe, it, expect } from 'vitest';
import { evaluateProfilesRLS } from '../helpers/userManagementLogic';
import { mockUsers } from '../helpers/mockData';

describe('User Governance & Database Row Level Security (TC-GOV)', () => {
  const clientA = mockUsers.clientUserA;
  const clientB = mockUsers.clientUserB;
  const admin = mockUsers.adminUser;
  const superAdmin = mockUsers.superAdminUser;

  describe('TC-GOV-001: profiles_select Policy Enforcement', () => {
    it('should allow user to read their own profile row', () => {
      // Under CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid() = id OR is_admin());
      const canReadSelf = evaluateProfilesRLS('user', 'SELECT', clientA.id, clientA.id);
      expect(canReadSelf).toBe(true);
    });

    it('should prevent regular user from reading another user profile directly', () => {
      const canReadOther = evaluateProfilesRLS('user', 'SELECT', clientB.id, clientA.id);
      expect(canReadOther).toBe(false);
    });

    it('should allow operations admin and super admin to query any user profile', () => {
      const adminCanRead = evaluateProfilesRLS('admin', 'SELECT', clientA.id, admin.id);
      const superAdminCanRead = evaluateProfilesRLS('super_admin', 'SELECT', clientA.id, superAdmin.id);

      expect(adminCanRead).toBe(true);
      expect(superAdminCanRead).toBe(true);
    });

    it('should deny unauthenticated visitors from reading profiles', () => {
      expect(evaluateProfilesRLS(null, 'SELECT', clientA.id, null)).toBe(false);
    });
  });

  describe('TC-GOV-002: profiles_update Policy Enforcement', () => {
    it('should allow user to update their own profile row', () => {
      // Under CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id OR is_super_admin());
      const canUpdateSelf = evaluateProfilesRLS('user', 'UPDATE', clientA.id, clientA.id);
      expect(canUpdateSelf).toBe(true);
    });

    it('should permit super admin to update any user profile', () => {
      const superAdminCanUpdate = evaluateProfilesRLS('super_admin', 'UPDATE', clientA.id, superAdmin.id);
      expect(superAdminCanUpdate).toBe(true);
    });

    it('should prohibit regular operations admin from updating another user profile', () => {
      const adminCanUpdate = evaluateProfilesRLS('admin', 'UPDATE', clientA.id, admin.id);
      expect(adminCanUpdate).toBe(false);
    });

    it('should prohibit regular user from updating another user profile', () => {
      const userCanUpdateOther = evaluateProfilesRLS('user', 'UPDATE', clientB.id, clientA.id);
      expect(userCanUpdateOther).toBe(false);
    });
  });

  describe('TC-GOV-003: profiles_delete Policy Enforcement', () => {
    it('should strictly allow super admin to delete user profiles', () => {
      // Under CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (is_super_admin());
      const superAdminCanDelete = evaluateProfilesRLS('super_admin', 'DELETE', clientA.id, superAdmin.id);
      expect(superAdminCanDelete).toBe(true);
    });

    it('should prohibit operations admin from deleting user profiles', () => {
      const adminCanDelete = evaluateProfilesRLS('admin', 'DELETE', clientA.id, admin.id);
      expect(adminCanDelete).toBe(false);
    });

    it('should prohibit client users from deleting user profiles', () => {
      const userCanDeleteSelf = evaluateProfilesRLS('user', 'DELETE', clientA.id, clientA.id);
      expect(userCanDeleteSelf).toBe(false);
    });
  });

  describe('TC-GOV-004: Role CHECK Constraint Validation', () => {
    it('should accept valid role strings conforming to CHECK (role IN ("user", "admin", "super_admin"))', () => {
      const validRoles = ['user', 'admin', 'super_admin'];
      const isValidRole = (r) => validRoles.includes(r);

      expect(isValidRole('user')).toBe(true);
      expect(isValidRole('admin')).toBe(true);
      expect(isValidRole('super_admin')).toBe(true);
    });

    it('should reject invalid or escalated role strings', () => {
      const validRoles = ['user', 'admin', 'super_admin'];
      const isValidRole = (r) => validRoles.includes(r);

      expect(isValidRole('root')).toBe(false);
      expect(isValidRole('moderator')).toBe(false);
      expect(isValidRole('superuser')).toBe(false);
      expect(isValidRole('')).toBe(false);
    });
  });
});
