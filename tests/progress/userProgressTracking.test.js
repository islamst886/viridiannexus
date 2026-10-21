import { describe, it, expect } from 'vitest';
import {
  calculateOverallProjectProgress,
  resolveCurrentPhaseMilestone,
  resolveMilestoneImages
} from '../helpers/progressLogic';
import { createMockPropertiesForProgress, createMockBooking } from '../helpers/mockData';

describe('User & Investor Progress Tracking Subsystem (TC-USR)', () => {
  const properties = createMockPropertiesForProgress();
  const skyHeights = properties[0]; // 4 milestones: 2 completed, 1 current at 65%, 1 upcoming

  describe('TC-USR-001: Investor Project Overall Progress Calculation Formula', () => {
    it('should compute weighted overall progress factoring completed count and current phase partial completion', () => {
      // 4 milestones:
      // total = 4
      // completed = 2 (Foundation, Basement) -> base = (2 / 4) * 100 = 50%
      // current = 1 (12th Floor Slab at 65%) -> partial = (65 / 100) * (100 / 4) = 16.25%
      // overall = round(50 + 16.25) = round(66.25) = 66%
      const overall = calculateOverallProjectProgress(skyHeights.milestones);
      expect(overall).toBe(66);
    });

    it('should calculate 100% when all milestones are completed', () => {
      const serenityResidences = properties[1]; // 2 milestones, both completed
      const overall = calculateOverallProjectProgress(serenityResidences.milestones);
      expect(overall).toBe(100);
    });

    it('should calculate 0% when all milestones are upcoming', () => {
      const vistaBoulevard = properties[2]; // 1 milestone, upcoming
      const overall = calculateOverallProjectProgress(vistaBoulevard.milestones);
      expect(overall).toBe(0);
    });

    it('should return 0% safely if milestones array is empty or undefined', () => {
      expect(calculateOverallProjectProgress([])).toBe(0);
      expect(calculateOverallProjectProgress(null)).toBe(0);
      expect(calculateOverallProjectProgress(undefined)).toBe(0);
    });

    it('should clamp overall progress so it never exceeds 100%', () => {
      const edgeMilestones = [
        { status: 'completed', percentage: 100 },
        { status: 'current', percentage: 150 } // out-of-range bug in raw data
      ];
      // base = 50%, partial = 100/100 * 50% = 50% -> total 100%
      expect(calculateOverallProjectProgress(edgeMilestones)).toBe(100);
    });
  });

  describe('TC-USR-002: Active Milestone Waterfall Resolution', () => {
    it('should prioritize milestone with status === "current"', () => {
      const current = resolveCurrentPhaseMilestone(skyHeights.milestones);
      expect(current).toBeDefined();
      expect(current.id).toBe('ms-03');
      expect(current.status).toBe('current');
      expect(current.title).toBe('Superstructure 12th Floor Slab Cast');
    });

    it('should fallback to latest completed milestone if no current milestone exists', () => {
      const allDone = [
        { id: 'm1', status: 'completed', title: 'Phase 1' },
        { id: 'm2', status: 'completed', title: 'Phase 2' },
        { id: 'm3', status: 'upcoming', title: 'Phase 3' }
      ];
      const active = resolveCurrentPhaseMilestone(allDone);
      expect(active.id).toBe('m2');
      expect(active.title).toBe('Phase 2');
    });

    it('should fallback to the first milestone if all are upcoming', () => {
      const allUpcoming = [
        { id: 'u1', status: 'upcoming', title: 'Planning' },
        { id: 'u2', status: 'upcoming', title: 'Permits' }
      ];
      const active = resolveCurrentPhaseMilestone(allUpcoming);
      expect(active.id).toBe('u1');
      expect(active.title).toBe('Planning');
    });

    it('should return null when milestones list is empty', () => {
      expect(resolveCurrentPhaseMilestone([])).toBeNull();
    });
  });

  describe('TC-USR-003: Property Detail Progress Widget Display Asset Resolution', () => {
    it('should select first image from images array for the active phase widget card', () => {
      const active = resolveCurrentPhaseMilestone(skyHeights.milestones);
      const images = resolveMilestoneImages(active);

      expect(images).toHaveLength(3);
      expect(images[0]).toContain('floor12a.jpg');
    });

    it('should link booked property to public construction progress updates', () => {
      const booking = createMockBooking({ propertyId: skyHeights.id });
      expect(booking.propertyId).toBe('prop-heights-01');

      // Matching property in catalog contains live construction milestones
      const matchingProperty = properties.find(p => p.id === booking.propertyId);
      expect(matchingProperty).toBeDefined();
      expect(matchingProperty.milestones.length).toBeGreaterThan(0);

      const overall = calculateOverallProjectProgress(matchingProperty.milestones);
      expect(overall).toBe(66);
    });
  });
});
