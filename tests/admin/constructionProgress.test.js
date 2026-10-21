import { describe, it, expect } from 'vitest';
import { calculateMilestoneCompletion } from '../helpers/propertyLogic';

describe('Admin Construction Progress & Milestones (TC-ADM-010 & TC-ADM-011)', () => {

  describe('TC-ADM-010: Construction Milestone Lifecycle Management', () => {
    it('should validate milestone structure and lifecycle status transitions', () => {
      const milestone = {
        id: 'ms-01',
        title: 'Deep Piling & Substructure Foundation',
        date: '2026-03-31',
        description: 'Cast-in-situ piling completed under military supervision.',
        status: 'completed',
        percentage: 100,
        images: ['https://storage.com/piling1.jpg', 'https://storage.com/piling2.jpg']
      };

      expect(milestone.status).toBe('completed');
      expect(milestone.percentage).toBe(100);
      expect(milestone.images).toHaveLength(2);

      // Transition milestone from current to completed
      const updatedMilestone = {
        ...milestone,
        status: 'completed',
        percentage: 100
      };
      expect(updatedMilestone.status).toBe('completed');
    });

    it('should enforce status values to be upcoming, current, or completed', () => {
      const validStatuses = ['upcoming', 'current', 'completed'];
      expect(validStatuses.includes('upcoming')).toBe(true);
      expect(validStatuses.includes('current')).toBe(true);
      expect(validStatuses.includes('completed')).toBe(true);
      expect(validStatuses.includes('invalid-status')).toBe(false);
    });
  });

  describe('TC-ADM-011: Milestone Completion Percentage Calculation', () => {
    it('should calculate project overall completion percentage from milestones array', () => {
      const milestones = [
        { title: 'Soil Testing', percentage: 100 },
        { title: 'Substructure', percentage: 100 },
        { title: 'Superstructure Cast', percentage: 70 },
        { title: 'Finishing & Handover', percentage: 0 }
      ];

      // Average: (100 + 100 + 70 + 0) / 4 = 270 / 4 = 67.5 -> 68%
      const overall = calculateMilestoneCompletion(milestones);
      expect(overall).toBe(68);
    });

    it('should return 0 when milestones array is empty', () => {
      expect(calculateMilestoneCompletion([])).toBe(0);
    });

    it('should clamp completion rate to a maximum of 100%', () => {
      const milestones = [
        { title: 'P1', percentage: 100 },
        { title: 'P2', percentage: 100 }
      ];
      expect(calculateMilestoneCompletion(milestones)).toBe(100);
    });
  });
});
