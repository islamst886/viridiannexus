import { describe, it, expect } from 'vitest';
import {
  validateMilestoneForm,
  calculateOverallProjectProgress,
  resolveCurrentPhaseMilestone,
  resolveMilestoneImages,
  sortMilestoneImages,
  calculateMilestoneNodeState,
  manageMediaGarbageCollection
} from '../helpers/progressLogic';

describe('Progress & Milestone Edge Cases & Failure Modes (TC-EDG)', () => {

  describe('TC-EDG-001: Percentage Boundary Clamping & Extreme Values', () => {
    it('should clamp negative percentages to 0', () => {
      const form = {
        title: 'Excavation',
        date: 'Jan 2025',
        description: 'Digging',
        status: 'current',
        percentage: -50
      };
      const result = validateMilestoneForm(form);
      expect(result.valid).toBe(true);
      expect(result.sanitized.percentage).toBe(0);
    });

    it('should clamp percentages exceeding 100 to 100', () => {
      const form = {
        title: 'Roof Slab',
        date: 'Jul 2025',
        description: 'Casting',
        status: 'current',
        percentage: 350
      };
      const result = validateMilestoneForm(form);
      expect(result.valid).toBe(true);
      expect(result.sanitized.percentage).toBe(100);
    });

    it('should convert string numeric inputs and round floats to integers', () => {
      const form = {
        title: 'Facade',
        date: 'Aug 2025',
        description: 'Glass panels',
        status: 'current',
        percentage: '72.6'
      };
      const result = validateMilestoneForm(form);
      expect(result.valid).toBe(true);
      expect(result.sanitized.percentage).toBe(73);
    });

    it('should default non-numeric NaN values to 0', () => {
      const form = {
        title: 'Facade',
        date: 'Aug 2025',
        description: 'Glass panels',
        status: 'current',
        percentage: 'not-a-number'
      };
      const result = validateMilestoneForm(form);
      expect(result.valid).toBe(true);
      expect(result.sanitized.percentage).toBe(0);
    });
  });

  describe('TC-EDG-002: Zero Milestones Graceful Handling', () => {
    it('should return 0 overall progress for property with 0 milestones without division by zero', () => {
      expect(calculateOverallProjectProgress([])).toBe(0);
      expect(calculateOverallProjectProgress(null)).toBe(0);
    });

    it('should return null for current phase milestone when list is empty', () => {
      expect(resolveCurrentPhaseMilestone([])).toBeNull();
      expect(resolveCurrentPhaseMilestone(null)).toBeNull();
    });

    it('should return empty image list for null milestone', () => {
      expect(resolveMilestoneImages(null)).toEqual([]);
      expect(resolveMilestoneImages({})).toEqual([]);
    });
  });

  describe('TC-EDG-003: Boundary Milestone Status Sets', () => {
    it('should calculate exactly 100% when all milestones are completed', () => {
      const allCompleted = [
        { status: 'completed', percentage: 100 },
        { status: 'completed', percentage: 100 },
        { status: 'completed', percentage: 100 }
      ];
      expect(calculateOverallProjectProgress(allCompleted)).toBe(100);
    });

    it('should calculate exactly 0% when all milestones are upcoming', () => {
      const allUpcoming = [
        { status: 'upcoming', percentage: 0 },
        { status: 'upcoming', percentage: 0 }
      ];
      expect(calculateOverallProjectProgress(allUpcoming)).toBe(0);
    });
  });

  describe('TC-EDG-004: Legacy Schema & External URL Interoperability', () => {
    it('should prioritize modern images array over legacy imageUrl when both are present', () => {
      const hybridMilestone = {
        title: 'Hybrid Milestone',
        images: ['https://storage.com/modern1.jpg', 'https://storage.com/modern2.jpg'],
        imageUrl: 'https://storage.com/legacy_single.jpg'
      };
      const images = resolveMilestoneImages(hybridMilestone);

      expect(images).toHaveLength(2);
      expect(images).toEqual([
        'https://storage.com/modern1.jpg',
        'https://storage.com/modern2.jpg'
      ]);
    });

    it('should fall back to legacy imageUrl when images array is empty or undefined', () => {
      const legacyOnly = {
        title: 'Legacy Milestone',
        images: [],
        imageUrl: 'https://storage.com/legacy_single.jpg'
      };
      const images = resolveMilestoneImages(legacyOnly);

      expect(images).toEqual(['https://storage.com/legacy_single.jpg']);
    });
  });

  describe('TC-EDG-005: Multiple Concurrently Active Milestones Conflict Resolution', () => {
    it('should safely resolve the first current milestone and calculate progress consistently', () => {
      const conflictingMilestones = [
        { id: 'm1', status: 'completed', percentage: 100 },
        { id: 'm2', status: 'current', percentage: 40, title: 'Phase A' },
        { id: 'm3', status: 'current', percentage: 80, title: 'Phase B' },
        { id: 'm4', status: 'upcoming', percentage: 0 }
      ];

      // Waterfall selects the first milestone with status === 'current'
      const active = resolveCurrentPhaseMilestone(conflictingMilestones);
      expect(active.id).toBe('m2');
      expect(active.title).toBe('Phase A');

      // Calculation does not crash or double-count
      // total = 4, completed = 1 (25%), current = 40% of 25% = 10% -> 35%
      const overall = calculateOverallProjectProgress(conflictingMilestones);
      expect(overall).toBe(35);
    });
  });

  describe('TC-EDG-006: Drag-and-Drop Sorting Boundary Conditions', () => {
    it('should return empty or single-item array unchanged', () => {
      expect(sortMilestoneImages([], 0, 1)).toEqual([]);
      expect(sortMilestoneImages(['only.jpg'], 0, 0)).toEqual(['only.jpg']);
      expect(sortMilestoneImages(null, 0, 1)).toEqual(null);
    });

    it('should handle negative or out-of-range fromIndex safely', () => {
      const images = ['a.jpg', 'b.jpg', 'c.jpg'];
      expect(sortMilestoneImages(images, -1, 1)).toEqual(images);
      expect(sortMilestoneImages(images, 10, 1)).toEqual(images);
    });

    it('should clamp out-of-range toIndex to boundary position', () => {
      const images = ['a.jpg', 'b.jpg', 'c.jpg'];
      // Drag 'a.jpg' (index 0) beyond end of array (toIndex 99)
      const reordered = sortMilestoneImages(images, 0, 99);
      expect(reordered).toEqual(['b.jpg', 'c.jpg', 'a.jpg']);
    });
  });

  describe('TC-EDG-007: XSS and Multiline Content Preservation', () => {
    it('should trim surrounding whitespace but preserve intentional internal multiline text and quotes', () => {
      const form = {
        title: '  Steel Structure Framework  ',
        date: '  December 2025  ',
        description: '  Line 1: High tensile steel.\nLine 2: "Grade 60" rebar used.\n<script>alert(1)</script>  ',
        status: 'current',
        percentage: 50
      };

      const result = validateMilestoneForm(form);
      expect(result.valid).toBe(true);
      expect(result.sanitized.title).toBe('Steel Structure Framework');
      expect(result.sanitized.date).toBe('December 2025');
      expect(result.sanitized.description).toContain('Line 1: High tensile steel.');
      expect(result.sanitized.description).toContain('Line 2: "Grade 60" rebar used.');
      expect(result.sanitized.description).toContain('<script>alert(1)</script>');
    });
  });

  describe('TC-EDG-008: Unrecognized Lifecycle Status Defaults & Resets', () => {
    it('should reject unrecognized status in form validation', () => {
      const form = {
        title: 'Roofing',
        date: '2025',
        description: 'Tiles',
        status: 'in_progress' // invalid enum value
      };
      const result = validateMilestoneForm(form);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Status must be one of: upcoming, current, completed');
    });

    it('should default unrecognized status safely to upcoming in calculateMilestoneNodeState', () => {
      const corruptedMilestone = { status: 'unknown_status' };
      const nodeState = calculateMilestoneNodeState(corruptedMilestone);
      expect(nodeState.isUpcoming).toBe(true);
      expect(nodeState.icon).toBe('Calendar');
      expect(nodeState.showProgressBar).toBe(false);
    });
  });
});
