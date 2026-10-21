import { describe, it, expect } from 'vitest';
import {
  evaluateSuperAdminRouteAccess,
  evaluateProfilesRLS
} from '../helpers/userManagementLogic';
import { mockUsers } from '../helpers/mockData';

describe('Admin vs Super Admin Privilege Separation (TC-ADM)', () => {

  describe('TC-ADM-001: SuperAdminRoute Access Controls', () => {
    it('should deny access to regular operations admin and return permission denied status', () => {
      const access = evaluateSuperAdminRouteAccess({
        isLoggedIn: true,
        userRole: 'admin'
      });

      expect(access.allowed).toBe(false);
      expect(access.status).toBe('permission_denied');
      expect(access.errorMessage).toBe('You need Super Admin privileges to access this page.');
    });

    it('should deny access to standard client user', () => {
      const access = evaluateSuperAdminRouteAccess({
        isLoggedIn: true,
        userRole: 'user'
      });

      expect(access.allowed).toBe(false);
      expect(access.status).toBe('permission_denied');
    });

    it('should redirect unauthenticated visitors to /admin login route', () => {
      const access = evaluateSuperAdminRouteAccess({
        isLoggedIn: false,
        userRole: null
      });

      expect(access.allowed).toBe(false);
      expect(access.status).toBe('redirect');
      expect(access.target).toBe('/admin');
    });

    it('should grant access strictly to authenticated Super Admin users', () => {
      const access = evaluateSuperAdminRouteAccess({
        isLoggedIn: true,
        userRole: 'super_admin'
      });

      expect(access.allowed).toBe(true);
      expect(access.status).toBe('granted');
    });
  });

  describe('TC-ADM-002: Regular Admin RLS Update Denial', () => {
    it('should prevent operations admin from modifying another user profile in Supabase', () => {
      const adminUser = mockUsers.adminUser;
      const targetUser = mockUsers.clientUserA;

      // Under "profiles_update" policy: USING (auth.uid() = id OR is_super_admin())
      const adminCanUpdate = evaluateProfilesRLS('admin', 'UPDATE', targetUser.id, adminUser.id);
      expect(adminCanUpdate).toBe(false);
    });

    it('should prevent operations admin from deleting any user profile', () => {
      const adminUser = mockUsers.adminUser;
      const targetUser = mockUsers.clientUserA;

      // Under "profiles_delete" policy: USING (is_super_admin())
      const adminCanDelete = evaluateProfilesRLS('admin', 'DELETE', targetUser.id, adminUser.id);
      expect(adminCanDelete).toBe(false);
    });

    it('should allow regular admin to view user profiles (read-only)', () => {
      const adminUser = mockUsers.adminUser;
      const targetUser = mockUsers.clientUserA;

      // Under "profiles_select" policy: USING (auth.uid() = id OR is_admin())
      const adminCanSelect = evaluateProfilesRLS('admin', 'SELECT', targetUser.id, adminUser.id);
      expect(adminCanSelect).toBe(true);
    });
  });
});
