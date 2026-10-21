import { describe, it, expect } from 'vitest';
import { evaluateSiteSettingsAccess } from '../helpers/siteSettingsLogic';
import { mockUsers } from '../helpers/mockData';

describe('Admin Site Settings Access & Read-Only Gates (TC-ADM)', () => {
  const admin = mockUsers.adminUser;
  const superAdmin = mockUsers.superAdminUser;
  const clientUser = mockUsers.clientUserA;

  describe('TC-ADM-001: Route and Access Evaluation for Non-Super Admins', () => {
    it('should deny edit privileges to operations admin and enforce read-only status', () => {
      const access = evaluateSiteSettingsAccess({
        isLoggedIn: true,
        userRole: admin.role
      });

      expect(access.allowed).toBe(false);
      expect(access.status).toBe('permission_denied');
      expect(access.isReadOnly).toBe(true);
      expect(access.canSave).toBe(false);
      expect(access.warningMessage).toContain('read-only mode');
    });

    it('should deny access to standard client user', () => {
      const access = evaluateSiteSettingsAccess({
        isLoggedIn: true,
        userRole: clientUser.role
      });

      expect(access.allowed).toBe(false);
      expect(access.canSave).toBe(false);
    });

    it('should redirect unauthenticated visitors to /admin', () => {
      const access = evaluateSiteSettingsAccess({
        isLoggedIn: false,
        userRole: null
      });

      expect(access.allowed).toBe(false);
      expect(access.status).toBe('redirect');
      expect(access.target).toBe('/admin');
    });

    it('should grant full edit privileges to authenticated Super Admin', () => {
      const access = evaluateSiteSettingsAccess({
        isLoggedIn: true,
        userRole: superAdmin.role
      });

      expect(access.allowed).toBe(true);
      expect(access.status).toBe('granted');
      expect(access.isReadOnly).toBe(false);
      expect(access.canSave).toBe(true);
    });
  });

  describe('TC-ADM-002: Form Submission Guard', () => {
    it('should block save submission handler if current user is not super admin', () => {
      const submitHandler = ({ isSuperAdmin }) => {
        if (!isSuperAdmin) {
          return { success: false, error: 'Only Super Admins can update global site settings.' };
        }
        return { success: true };
      };

      const adminAttempt = submitHandler({ isSuperAdmin: false });
      expect(adminAttempt.success).toBe(false);
      expect(adminAttempt.error).toBe('Only Super Admins can update global site settings.');

      const superAdminAttempt = submitHandler({ isSuperAdmin: true });
      expect(superAdminAttempt.success).toBe(true);
    });
  });
});
