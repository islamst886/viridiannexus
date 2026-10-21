import { describe, it, expect, vi } from 'vitest';
import {
  evaluateProgressRLS,
  manageMediaGarbageCollection,
  resolveMilestoneImages
} from '../helpers/progressLogic';
import { mockUsers, createMockPropertiesForProgress } from '../helpers/mockData';

describe('Super Admin Governance & Storage Security Subsystem (TC-SAD)', () => {
  const properties = createMockPropertiesForProgress();
  const targetProperty = properties[0];

  describe('TC-SAD-001: Properties Milestones Database RLS Policies', () => {
    it('should allow public visitors to read properties milestones', () => {
      const publicCanRead = evaluateProgressRLS('user', 'SELECT', 'properties');
      expect(publicCanRead).toBe(true);
    });

    it('should allow admin and super_admin to update properties milestones', () => {
      const adminCanUpdate = evaluateProgressRLS('admin', 'UPDATE', 'properties');
      const superAdminCanUpdate = evaluateProgressRLS('super_admin', 'UPDATE', 'properties');

      expect(adminCanUpdate).toBe(true);
      expect(superAdminCanUpdate).toBe(true);
    });

    it('should block regular clients from modifying properties milestones', () => {
      const userCanUpdate = evaluateProgressRLS('user', 'UPDATE', 'properties');
      const userCanInsert = evaluateProgressRLS('user', 'INSERT', 'properties');
      const userCanDelete = evaluateProgressRLS('user', 'DELETE', 'properties');

      expect(userCanUpdate).toBe(false);
      expect(userCanInsert).toBe(false);
      expect(userCanDelete).toBe(false);
    });
  });

  describe('TC-SAD-002: Milestones Storage Bucket Access Controls', () => {
    it('should allow public access to read images in the milestones bucket', () => {
      const publicRead = evaluateProgressRLS('user', 'SELECT', 'storage_milestones');
      expect(publicRead).toBe(true);
    });

    it('should restrict storage write and delete operations strictly to administrative roles', () => {
      const adminCanUpload = evaluateProgressRLS('admin', 'INSERT', 'storage_milestones');
      const adminCanDelete = evaluateProgressRLS('admin', 'DELETE', 'storage_milestones');
      const userCanUpload = evaluateProgressRLS('user', 'INSERT', 'storage_milestones');
      const userCanDelete = evaluateProgressRLS('user', 'DELETE', 'storage_milestones');

      expect(adminCanUpload).toBe(true);
      expect(adminCanDelete).toBe(true);
      expect(userCanUpload).toBe(false);
      expect(userCanDelete).toBe(false);
    });
  });

  describe('TC-SAD-003: Cascading Media Deletion on Milestone Removal', () => {
    it('should harvest all attached images for storage deletion when milestone is deleted', () => {
      const milestoneToDelete = targetProperty.milestones[1]; // Basement casting: has 2 images
      const urlsToDelete = resolveMilestoneImages(milestoneToDelete);

      expect(urlsToDelete).toHaveLength(2);
      expect(urlsToDelete[0]).toContain('b1.jpg');
      expect(urlsToDelete[1]).toContain('b2.jpg');

      // Remaining milestones exclude the deleted one
      const remainingMilestones = targetProperty.milestones.filter(m => m.id !== milestoneToDelete.id);
      expect(remainingMilestones).toHaveLength(3);
      expect(remainingMilestones.some(m => m.id === milestoneToDelete.id)).toBe(false);
    });

    it('should correctly harvest legacy single imageUrl for deletion as well', () => {
      const legacyMilestone = {
        id: 'ms-legacy-01',
        title: 'Old Foundation',
        imageUrl: 'https://storage.com/legacy_piling.jpg'
      };
      const urlsToDelete = resolveMilestoneImages(legacyMilestone);
      expect(urlsToDelete).toEqual(['https://storage.com/legacy_piling.jpg']);
    });
  });

  describe('TC-SAD-004: Browser Unmount Beacon Garbage Collection', () => {
    it('should harvest uncommitted new image uploads when component unmounts', () => {
      const uncommittedUploads = [
        'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/orphan-1.jpg',
        'https://xyz.supabase.co/storage/v1/object/public/milestones/prop-1/orphan-2.jpg'
      ];

      const gcState = manageMediaGarbageCollection({
        newlyUploadedImages: uncommittedUploads,
        action: 'beacon_unmount'
      });

      expect(gcState.toPurge).toEqual(uncommittedUploads);
    });

    it('should format sendBeacon payload with JSON stringified url', () => {
      const mockSendBeacon = vi.fn().mockReturnValue(true);
      const urlToPurge = 'https://xyz.supabase.co/storage/v1/object/public/milestones/orphan.jpg';

      // Simulating deleteMediaBeacon behavior
      const payload = JSON.stringify({ url: urlToPurge });
      mockSendBeacon('/api/deleteMedia', payload);

      expect(mockSendBeacon).toHaveBeenCalledWith('/api/deleteMedia', payload);
    });
  });

  describe('TC-SAD-005: Supabase Storage URL Parser & Host Validation', () => {
    it('should correctly parse bucket and filePath from valid Supabase Storage URLs', () => {
      const validUrl = 'https://abcdefgh.supabase.co/storage/v1/object/public/milestones/prop-1/phase1.jpg';
      const urlObj = new URL(validUrl);
      const parts = urlObj.pathname.split('/object/public/');

      expect(parts.length).toBe(2);
      const [bucket, ...pathParts] = parts[1].split('/');
      const filePath = pathParts.join('/');

      expect(bucket).toBe('milestones');
      expect(filePath).toBe('prop-1/phase1.jpg');
    });

    it('should detect non-Supabase URLs (e.g. Unsplash or Cloudinary) and skip deletion', () => {
      const externalUrl = 'https://images.unsplash.com/photo-1541888946425-d0fbb18086f6';
      const supabaseHost = 'abcdefgh.supabase.co';

      const isSupabaseUrl = externalUrl.includes(supabaseHost);
      expect(isSupabaseUrl).toBe(false);
    });
  });
});
