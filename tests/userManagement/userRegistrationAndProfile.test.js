import { describe, it, expect } from 'vitest';
import {
  validateUserRegistration,
  generateReferralCode,
  evaluateBannedUserSession,
  evaluateProfilesRLS
} from '../helpers/userManagementLogic';
import { mockUsers } from '../helpers/mockData';

describe('Website Visitor & Client User Subsystem (TC-PUB & TC-USR)', () => {

  describe('TC-PUB-001: Automatic Profile Creation Defaults', () => {
    it('should validate registration input and construct default unprivileged user profile', () => {
      const input = {
        email: 'Zubair.Ahmed@Domain.COM',
        password: 'securePassword123!',
        displayName: 'Zubair Ahmed',
        phone: '+8801700112233'
      };

      const result = validateUserRegistration(input);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.defaultProfile.email).toBe('zubair.ahmed@domain.com');
      expect(result.defaultProfile.displayName).toBe('Zubair Ahmed');
      expect(result.defaultProfile.role).toBe('user');
      expect(result.defaultProfile.is_banned).toBe(false);
      expect(result.defaultProfile.referral_code).toMatch(/^VN-[A-Z0-9]{6}$/);
    });

    it('should reject registration with invalid email or short password', () => {
      const invalid = {
        email: 'invalid-email-address',
        password: '123',
        displayName: ''
      };

      const result = validateUserRegistration(invalid);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Valid email address is required.');
      expect(result.errors).toContain('Password must be at least 6 characters.');
      expect(result.errors).toContain('Display name is required.');
    });
  });

  describe('TC-PUB-002: Unique Referral Code Formatting', () => {
    it('should generate referral codes adhering strictly to VN-XXXXXX corporate format', () => {
      const code1 = generateReferralCode();
      const code2 = generateReferralCode();

      expect(code1).toMatch(/^VN-[A-Z0-9]{6}$/);
      expect(code2).toMatch(/^VN-[A-Z0-9]{6}$/);
      expect(code1).toHaveLength(9);
    });

    it('should support verified custom seed suffixes', () => {
      const custom = generateReferralCode('LUXURY');
      expect(custom).toBe('VN-LUXURY');
    });
  });

  describe('TC-USR-001: Client Self-Service Profile Updates', () => {
    it('should allow user to update their own contact and identity fields', () => {
      const client = mockUsers.clientUserA;
      const canUpdateSelf = evaluateProfilesRLS('user', 'UPDATE', client.id, client.id);

      expect(canUpdateSelf).toBe(true);

      const updatedProfile = {
        ...client,
        emergencyPhone: '+8801711223344',
        address: 'House 45, Road 7, Dhanmondi, Dhaka',
        nidType: 'NID',
        nid: '19852691234567890',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb'
      };

      expect(updatedProfile.emergencyPhone).toBe('+8801711223344');
      expect(updatedProfile.nid).toBe('19852691234567890');
    });

    it('should prohibit client user from modifying another client profile', () => {
      const clientA = mockUsers.clientUserA;
      const clientB = mockUsers.clientUserB;

      const canUpdateOther = evaluateProfilesRLS('user', 'UPDATE', clientB.id, clientA.id);
      expect(canUpdateOther).toBe(false);
    });
  });

  describe('TC-SEC-001: Banned User Authentication Lockout', () => {
    it('should reject session and force sign-out when profile is_banned is true', () => {
      const bannedProfile = {
        id: 'banned-usr-01',
        email: 'spammer@shady.com',
        is_banned: true
      };

      const sessionEval = evaluateBannedUserSession(bannedProfile);

      expect(sessionEval.allowed).toBe(false);
      expect(sessionEval.action).toBe('force_sign_out');
      expect(sessionEval.errorMessage).toBe('Your account has been suspended.');
    });

    it('should permit session continuation when profile is active', () => {
      const activeProfile = {
        id: 'active-usr-01',
        email: 'rahim@example.com',
        is_banned: false
      };

      const sessionEval = evaluateBannedUserSession(activeProfile);

      expect(sessionEval.allowed).toBe(true);
      expect(sessionEval.action).toBe('continue_session');
    });
  });
});
