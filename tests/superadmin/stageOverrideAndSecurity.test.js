import { describe, it, expect } from 'vitest';
import { evaluateStagePrerequisites } from '../../src/utils/bookingStageGates';
import { createMockBooking, mockUsers } from '../helpers/mockData';
import {
  evaluateCanAdvanceStage,
  buildStageTransitionPayload
} from '../helpers/bookingLogic';

describe('Super Admin Governance, Executive Overrides & Security (TC-SAD)', () => {

  describe('TC-SAD-001: Stage Gate Executive Override (Successful Authorization)', () => {
    it('should authorize Super Admin to advance stage even when prerequisites fail', () => {
      const booking = createMockBooking({
        stage: 'Installments Running',
        totalPrice: 30000000,
        totalPaid: 20000000,
        balanceDue: 10000000
      });

      const evaluation = evaluateStagePrerequisites('Handover', booking, []);
      expect(evaluation.allowed).toBe(false);

      const justification = "Executive Board Resolution #EB-2026-99 under corporate guarantee.";
      const canAdvance = evaluateCanAdvanceStage({
        evaluation,
        isSuperAdmin: true,
        overrideAuthorized: true,
        overrideReason: justification,
        isSameStage: false
      });

      expect(canAdvance).toBe(true);

      const payload = buildStageTransitionPayload({
        booking,
        targetStage: 'Handover',
        evaluation,
        isSuperAdmin: true,
        overrideAuthorized: true,
        overrideReason: justification,
        adminName: mockUsers.superAdminUser.displayName,
        adminUid: mockUsers.superAdminUser.uid
      });

      expect(payload.activityLog.type).toBe("Stage Override (Super Admin)");
      expect(payload.activityLog.metadata.isOverride).toBe(true);
      expect(payload.activityLog.metadata.overrideReason).toBe(justification);
      expect(payload.activityLog.message).toContain("Stage forcibly set from \"Installments Running\" to \"Handover\"");
    });
  });

  describe('TC-SAD-002: Override Rejections & Validation Boundaries', () => {
    it('should strictly reject override if operator is standard admin', () => {
      const evaluation = { allowed: false, isRollback: false };

      const canAdvance = evaluateCanAdvanceStage({
        evaluation,
        isSuperAdmin: false,
        overrideAuthorized: true,
        overrideReason: "Emergency bypass needed",
        isSameStage: false
      });

      expect(canAdvance).toBe(false);
    });

    it('should reject override if justification length is less than 8 characters', () => {
      const evaluation = { allowed: false, isRollback: false };

      const canAdvanceShort = evaluateCanAdvanceStage({
        evaluation,
        isSuperAdmin: true,
        overrideAuthorized: true,
        overrideReason: "urgent",
        isSameStage: false
      });

      expect(canAdvanceShort).toBe(false);
    });

    it('should reject override if overrideAuthorized toggle is false', () => {
      const evaluation = { allowed: false, isRollback: false };

      const canAdvanceNotChecked = evaluateCanAdvanceStage({
        evaluation,
        isSuperAdmin: true,
        overrideAuthorized: false,
        overrideReason: "Executive Board Resolution #EB-2026-99",
        isSameStage: false
      });

      expect(canAdvanceNotChecked).toBe(false);
    });
  });

  describe('TC-SAD-004: Role Matrix & Privileges Hierarchy', () => {
    it('should enforce proper role hierarchy', () => {
      const isSuperAdmin = (role) => role === 'super_admin';
      const isAdmin = (role) => role === 'admin' || role === 'super_admin';
      const isClient = (role) => role === 'user';

      expect(isClient(mockUsers.clientUserA.role)).toBe(true);
      expect(isAdmin(mockUsers.clientUserA.role)).toBe(false);

      expect(isAdmin(mockUsers.adminUser.role)).toBe(true);
      expect(isSuperAdmin(mockUsers.adminUser.role)).toBe(false);

      expect(isAdmin(mockUsers.superAdminUser.role)).toBe(true);
      expect(isSuperAdmin(mockUsers.superAdminUser.role)).toBe(true);
    });
  });
});
