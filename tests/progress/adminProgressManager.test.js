import { describe, it, expect, vi } from 'vitest';
import {
  validateMilestoneForm,
  sortMilestoneImages,
  manageMediaGarbageCollection,
  evaluateUnsavedChangesGuard
} from '../helpers/progressLogic';
import { createMockMilestone, createMockPropertiesForProgress } from '../helpers/mockData';

describe('Admin Progress Manager Operations (TC-ADM)', () => {
  const properties = createMockPropertiesForProgress();
  const targetProperty = properties[0];

  describe('TC-ADM-001: Project Selection & Status Integration', () => {
    it('should display property name and lifecycle status for admin identification', () => {
      expect(targetProperty.name).toBe('Viridian Sky Heights');
      expect(targetProperty.status).toBe('Under Construction');
      expect(targetProperty.milestones).toHaveLength(4);
    });
  });

  describe('TC-ADM-002: Unsaved Changes Guard (adminUnsavedChanges)', () => {
    it('should permit seamless navigation when form is clean (not dirty)', () => {
      const guard = evaluateUnsavedChangesGuard({ isDirty: false, userConfirmed: false });
      expect(guard.canProceed).toBe(true);
      expect(guard.action).toBe('proceed_clean');
    });

    it('should block navigation when form has unsaved edits and user declines confirmation', () => {
      const guard = evaluateUnsavedChangesGuard({ isDirty: true, userConfirmed: false });
      expect(guard.canProceed).toBe(false);
      expect(guard.action).toBe('stay_blocked');
    });

    it('should permit navigation and discard changes when user confirms prompt', () => {
      const guard = evaluateUnsavedChangesGuard({ isDirty: true, userConfirmed: true });
      expect(guard.canProceed).toBe(true);
      expect(guard.action).toBe('proceed_discarded');
    });
  });

  describe('TC-ADM-003: Milestone Input Form Validation', () => {
    it('should reject submission if title is missing or empty whitespace', () => {
      const invalidForm = {
        title: '   ',
        date: 'November 2025',
        description: 'Pouring columns'
      };
      const result = validateMilestoneForm(invalidForm);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required');
    });

    it('should reject submission if date is missing', () => {
      const invalidForm = {
        title: 'Level 14 Slab',
        date: '',
        description: 'Pouring columns'
      };
      const result = validateMilestoneForm(invalidForm);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Date is required');
    });

    it('should reject submission if description is missing', () => {
      const invalidForm = {
        title: 'Level 14 Slab',
        date: 'November 2025',
        description: '  '
      };
      const result = validateMilestoneForm(invalidForm);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Description is required');
    });

    it('should accept valid submission when all required fields are populated', () => {
      const validForm = {
        title: 'Elevator Core Shear Walls',
        date: 'November 2025',
        description: 'Slipform casting of high-speed elevator shafts.',
        status: 'current',
        percentage: 45
      };
      const result = validateMilestoneForm(validForm);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized.percentage).toBe(45);
    });
  });

  describe('TC-ADM-004: Milestone Lifecycle Status Selection & Percentage Toggle', () => {
    it('should force percentage to 100 when status is completed', () => {
      const completedForm = {
        title: 'Piling Completed',
        date: 'January 2025',
        description: 'All 120 piles cast',
        status: 'completed',
        percentage: 80 // dirty or incomplete input from user
      };
      const result = validateMilestoneForm(completedForm);
      expect(result.valid).toBe(true);
      expect(result.sanitized.percentage).toBe(100);
    });

    it('should force percentage to 0 when status is upcoming', () => {
      const upcomingForm = {
        title: 'Interior Handover',
        date: 'December 2026',
        description: 'Keys handover',
        status: 'upcoming',
        percentage: 50 // user typed by accident
      };
      const result = validateMilestoneForm(upcomingForm);
      expect(result.valid).toBe(true);
      expect(result.sanitized.percentage).toBe(0);
    });

    it('should clamp current milestone percentage between 0 and 100', () => {
      const currentHigh = {
        title: 'Floor Slab',
        date: 'May 2025',
        description: 'Slab in progress',
        status: 'current',
        percentage: 125
      };
      expect(validateMilestoneForm(currentHigh).sanitized.percentage).toBe(100);

      const currentNegative = {
        title: 'Floor Slab',
        date: 'May 2025',
        description: 'Slab in progress',
        status: 'current',
        percentage: -20
      };
      expect(validateMilestoneForm(currentNegative).sanitized.percentage).toBe(0);
    });
  });

  describe('TC-ADM-005: Milestone Create & Edit In-Place Update', () => {
    it('should append new milestone to property milestones array on create', () => {
      const existingMilestones = [...targetProperty.milestones];
      const newMilestone = createMockMilestone({
        id: 'ms-new-99',
        title: 'Rooftop Helipad Construction'
      });

      const updatedMilestones = [...existingMilestones, newMilestone];
      expect(updatedMilestones).toHaveLength(existingMilestones.length + 1);
      expect(updatedMilestones[updatedMilestones.length - 1].id).toBe('ms-new-99');
    });

    it('should update milestone in place by ID without mutating other milestones', () => {
      const existingMilestones = [...targetProperty.milestones];
      const targetId = 'ms-02';

      const editedMilestone = {
        id: targetId,
        title: 'Double Basement RCC Casting & Waterproofing (Certified)',
        date: 'June 2025',
        description: 'Updated with German waterproofing membrane warranty.',
        status: 'completed',
        percentage: 100,
        images: ['https://storage.com/b1.jpg']
      };

      const updatedList = existingMilestones.map(m =>
        m.id === targetId ? { ...editedMilestone } : m
      );

      expect(updatedList).toHaveLength(existingMilestones.length);
      const updatedItem = updatedList.find(m => m.id === targetId);
      expect(updatedItem.title).toContain('(Certified)');
      expect(updatedItem.description).toContain('German waterproofing');

      // Other milestones remain intact
      expect(updatedList.find(m => m.id === 'ms-01').title).toBe('Deep Foundation & Soil Stabilization');
    });
  });

  describe('TC-ADM-006: Drag-and-Drop Image Gallery Sorting (@dnd-kit)', () => {
    it('should move image to new target position in array using arrayMove logic', () => {
      const images = ['img-1.jpg', 'img-2.jpg', 'img-3.jpg', 'img-4.jpg'];
      // Drag img-3 (index 2) to first position (index 0)
      const reordered = sortMilestoneImages(images, 2, 0);

      expect(reordered).toEqual(['img-3.jpg', 'img-1.jpg', 'img-2.jpg', 'img-4.jpg']);
    });

    it('should handle dragging from start to end position', () => {
      const images = ['first.jpg', 'second.jpg', 'third.jpg'];
      const reordered = sortMilestoneImages(images, 0, 2);

      expect(reordered).toEqual(['second.jpg', 'third.jpg', 'first.jpg']);
    });

    it('should return identical array if old and new indices match', () => {
      const images = ['a.jpg', 'b.jpg'];
      const reordered = sortMilestoneImages(images, 1, 1);
      expect(reordered).toEqual(['a.jpg', 'b.jpg']);
    });
  });

  describe('TC-ADM-007: Image Removal & Garbage Collection Queue (imagesToDelete)', () => {
    it('should queue removed image for storage deletion', () => {
      const initialQueue = [];
      const imageToRemove = 'https://supabase.co/storage/v1/object/public/milestones/old-photo.jpg';

      const gcState = manageMediaGarbageCollection({
        imagesToDelete: initialQueue,
        action: 'remove_image',
        url: imageToRemove
      });

      expect(gcState.imagesToDelete).toContain(imageToRemove);
    });

    it('should return queued images to purge upon successful save and empty queue', () => {
      const queuedImages = [
        'https://supabase.co/storage/v1/object/public/milestones/old1.jpg',
        'https://supabase.co/storage/v1/object/public/milestones/old2.jpg'
      ];

      const gcState = manageMediaGarbageCollection({
        imagesToDelete: queuedImages,
        action: 'save_success'
      });

      expect(gcState.toPurge).toEqual(queuedImages);
      expect(gcState.imagesToDelete).toHaveLength(0);
      expect(gcState.newlyUploadedImages).toHaveLength(0);
    });
  });

  describe('TC-ADM-008: Cancel Edit Rollback & Newly Uploaded Images Purge', () => {
    it('should purge uncommitted new uploads and discard deletion queue on cancel', () => {
      const uncommittedUploads = ['https://storage.com/temp1.jpg', 'https://storage.com/temp2.jpg'];
      const queuedToDelete = ['https://storage.com/existing_photo.jpg'];

      const gcState = manageMediaGarbageCollection({
        newlyUploadedImages: uncommittedUploads,
        imagesToDelete: queuedToDelete,
        action: 'cancel_edit'
      });

      // The newly uploaded uncommitted files must be purged
      expect(gcState.toPurge).toEqual(uncommittedUploads);
      // Both queues must be reset
      expect(gcState.newlyUploadedImages).toHaveLength(0);
      expect(gcState.imagesToDelete).toHaveLength(0);
    });
  });
});
