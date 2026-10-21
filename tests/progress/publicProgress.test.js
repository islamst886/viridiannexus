import { describe, it, expect } from 'vitest';
import {
  filterPropertiesWithMilestones,
  resolveDefaultProject,
  calculateMilestoneNodeState,
  resolveMilestoneImages,
  calculateMilestoneGridLayout
} from '../helpers/progressLogic';
import { createMockPropertiesForProgress } from '../helpers/mockData';

describe('Public & Website Visitor Progress System (TC-PUB)', () => {
  const allProperties = createMockPropertiesForProgress();

  describe('TC-PUB-001: Project Filtering for Properties with Milestones', () => {
    it('should filter out properties that have empty or null milestones array', () => {
      const filtered = filterPropertiesWithMilestones(allProperties);

      expect(filtered).toHaveLength(3);
      expect(filtered.map(p => p.id)).toEqual([
        'prop-heights-01',
        'prop-serenity-02',
        'prop-vista-03'
      ]);

      // 'prop-oasis-04' with empty milestones must be excluded
      expect(filtered.some(p => p.id === 'prop-oasis-04')).toBe(false);
    });

    it('should return empty array if properties list is empty or malformed', () => {
      expect(filterPropertiesWithMilestones([])).toEqual([]);
      expect(filterPropertiesWithMilestones(null)).toEqual([]);
      expect(filterPropertiesWithMilestones(undefined)).toEqual([]);
      expect(filterPropertiesWithMilestones([{ id: 'no-ms' }])).toEqual([]);
    });
  });

  describe('TC-PUB-002: Default Project Selection & Dropdown Switching', () => {
    it('should automatically default to the first property with milestones if no ID is pre-selected', () => {
      const filtered = filterPropertiesWithMilestones(allProperties);
      const defaultId = resolveDefaultProject(filtered, '');

      expect(defaultId).toBe('prop-heights-01');
    });

    it('should preserve an existing selectedProjectId when properties load', () => {
      const filtered = filterPropertiesWithMilestones(allProperties);
      const chosenId = resolveDefaultProject(filtered, 'prop-serenity-02');

      expect(chosenId).toBe('prop-serenity-02');
    });

    it('should return empty string if no properties have milestones', () => {
      expect(resolveDefaultProject([], '')).toBe('');
    });
  });

  describe('TC-PUB-003: Public Empty State Display', () => {
    it('should identify when no construction updates are available across the portfolio', () => {
      const emptyProps = [
        { id: 'p1', name: 'Villa 1', milestones: [] },
        { id: 'p2', name: 'Villa 2', milestones: null }
      ];
      const filtered = filterPropertiesWithMilestones(emptyProps);
      expect(filtered).toHaveLength(0);
      expect(filtered.length === 0).toBe(true);
    });
  });

  describe('TC-PUB-004: Timeline Node Icons & Color Mapping', () => {
    it('should assign CheckCircle and viridian green for completed milestones', () => {
      const milestone = { status: 'completed', title: 'Piling' };
      const node = calculateMilestoneNodeState(milestone);

      expect(node.isCompleted).toBe(true);
      expect(node.icon).toBe('CheckCircle');
      expect(node.badgeText).toBe('Completed');
      expect(node.badgeClass).toContain('bg-viridian-100');
      expect(node.nodeClass).toContain('bg-viridian-600');
      expect(node.hasPulse).toBe(false);
    });

    it('should assign Activity and blue styling with pulse animation for current milestones', () => {
      const milestone = { status: 'current', title: '12th Floor Slab', percentage: 65 };
      const node = calculateMilestoneNodeState(milestone);

      expect(node.isCurrent).toBe(true);
      expect(node.icon).toBe('Activity');
      expect(node.badgeText).toBe('In Progress');
      expect(node.badgeClass).toContain('bg-blue-100');
      expect(node.nodeClass).toContain('bg-blue-600');
      expect(node.nodeClass).toContain('animate-pulse');
      expect(node.hasPulse).toBe(true);
    });

    it('should assign Calendar and neutral gray styling for upcoming milestones', () => {
      const milestone = { status: 'upcoming', title: 'Façade Glazing' };
      const node = calculateMilestoneNodeState(milestone);

      expect(node.isUpcoming).toBe(true);
      expect(node.icon).toBe('Calendar');
      expect(node.badgeText).toBe('Upcoming');
      expect(node.badgeClass).toContain('bg-gray-100');
      expect(node.nodeClass).toContain('bg-gray-200');
      expect(node.hasPulse).toBe(false);
    });
  });

  describe('TC-PUB-005: Phase Completion Percentage Bar Rendering', () => {
    it('should enable progress bar strictly when milestone is current', () => {
      const currentMilestone = { status: 'current', percentage: 75 };
      const completedMilestone = { status: 'completed', percentage: 100 };
      const upcomingMilestone = { status: 'upcoming', percentage: 0 };

      expect(calculateMilestoneNodeState(currentMilestone).showProgressBar).toBe(true);
      expect(calculateMilestoneNodeState(completedMilestone).showProgressBar).toBe(false);
      expect(calculateMilestoneNodeState(upcomingMilestone).showProgressBar).toBe(false);
    });
  });

  describe('TC-PUB-006: Responsive Image Grid Layout', () => {
    it('should assign single-column layout for a single attached image', () => {
      const singleImage = ['https://storage.com/floor.jpg'];
      const layout = calculateMilestoneGridLayout(singleImage);

      expect(layout.cols).toBe(1);
      expect(layout.gridClass).toBe('grid-cols-1');
      expect(layout.imageClass).toBe('max-h-[400px]');
    });

    it('should assign multi-column responsive grid for 2 or more attached images', () => {
      const twoImages = ['https://storage.com/1.jpg', 'https://storage.com/2.jpg'];
      const layoutTwo = calculateMilestoneGridLayout(twoImages);
      expect(layoutTwo.cols).toBe(2);
      expect(layoutTwo.gridClass).toBe('grid-cols-2 md:grid-cols-3');
      expect(layoutTwo.imageClass).toBe('h-48');

      const threeImages = ['1.jpg', '2.jpg', '3.jpg'];
      const layoutThree = calculateMilestoneGridLayout(threeImages);
      expect(layoutThree.cols).toBe(3);
      expect(layoutThree.gridClass).toBe('grid-cols-2 md:grid-cols-3');
    });

    it('should support legacy single imageUrl fallback seamlessly', () => {
      const legacyMilestone = {
        title: 'Groundbreaking',
        imageUrl: 'https://storage.com/ground.jpg'
      };
      const images = resolveMilestoneImages(legacyMilestone);

      expect(images).toEqual(['https://storage.com/ground.jpg']);
      const layout = calculateMilestoneGridLayout(images);
      expect(layout.cols).toBe(1);
    });
  });
});
