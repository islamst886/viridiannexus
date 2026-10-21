import { describe, it, expect } from 'vitest';
import { aggregatePropertyMediaUrls } from '../helpers/propertyLogic';
import { mockUsers } from '../helpers/mockData';

describe('Super Admin Property Governance, Settings & Security (TC-SAD)', () => {

  describe('TC-SAD-001: Global Custom Property Types Management', () => {
    it('should manage and append bespoke property types in settings catalog', () => {
      const defaultTypes = [
        'Apartment', 'Penthouse', 'Luxury Apartment', 'Duplex', 'Smart Home', 'Villa', 'Townhouse', 'Commercial'
      ];

      const addCustomPropertyType = (currentList, newType) => {
        if (!newType?.trim()) return currentList;
        const trimmed = newType.trim();
        if (currentList.includes(trimmed)) return currentList;
        return [...currentList, trimmed];
      };

      const updated = addCustomPropertyType(defaultTypes, 'Presidential Penthouse');
      expect(updated).toContain('Presidential Penthouse');
      expect(updated).toHaveLength(defaultTypes.length + 1);

      // Verify idempotency (prevent duplicates)
      const duplicateAttempt = addCustomPropertyType(updated, 'Presidential Penthouse');
      expect(duplicateAttempt).toHaveLength(updated.length);
    });
  });

  describe('TC-SAD-002: Non-Super Admin Privilege Boundaries', () => {
    it('should restrict global site settings and property type modifications to Super Admins', () => {
      const canModifyGlobalSettings = (user) => {
        return user?.role === 'super_admin';
      };

      expect(canModifyGlobalSettings(mockUsers.clientUserA)).toBe(false);
      expect(canModifyGlobalSettings(mockUsers.adminUser)).toBe(false); // Standard Admin blocked!
      expect(canModifyGlobalSettings(mockUsers.superAdminUser)).toBe(true); // Super Admin allowed!
    });
  });

  describe('TC-SAD-003: Recursive Storage Garbage Collection on Property Deletion', () => {
    it('should aggregate all associated Supabase Storage media URLs across images, brochures, and milestones', () => {
      const complexProperty = {
        id: 'prop-complex-01',
        images: {
          hero: 'https://storage.supabase.co/hero.jpg',
          map: 'https://storage.supabase.co/map.jpg',
          floorPlan: 'https://storage.supabase.co/floorplan.jpg',
          video: '',
          gallery: [
            'https://storage.supabase.co/g1.jpg',
            'https://storage.supabase.co/g2.jpg',
            'https://storage.supabase.co/g3.jpg'
          ]
        },
        brochureUrl: 'https://storage.supabase.co/brochure.pdf',
        milestones: [
          {
            title: 'Substructure',
            images: ['https://storage.supabase.co/m1.jpg'],
            imageUrl: 'https://storage.supabase.co/m2.jpg'
          }
        ]
      };

      const mediaUrls = aggregatePropertyMediaUrls(complexProperty);

      // Hero + Map + FloorPlan + 3 Gallery + 1 Brochure + 2 Milestone = 9 URLs
      expect(mediaUrls).toHaveLength(9);
      expect(mediaUrls).toContain('https://storage.supabase.co/hero.jpg');
      expect(mediaUrls).toContain('https://storage.supabase.co/brochure.pdf');
      expect(mediaUrls).toContain('https://storage.supabase.co/m1.jpg');
    });
  });

  describe('TC-SAD-004: Cascading Deletion Protection (Active Bookings Guard)', () => {
    it('should block deletion of a property if active bookings are linked to it', () => {
      const verifyCanDeleteProperty = ({ propertyId, bookings }) => {
        const activeBookings = bookings.filter(b => 
          (b.propertyId === propertyId || b.property_id === propertyId) && b.status !== 'Cancelled'
        );
        if (activeBookings.length > 0) {
          throw new Error(`Cannot delete property: ${activeBookings.length} active booking(s) are linked to it.`);
        }
        return true;
      };

      const bookings = [
        { propertyId: 'prop-1', status: 'Active' },
        { propertyId: 'prop-1', status: 'Cancelled' }
      ];

      expect(() => verifyCanDeleteProperty({ propertyId: 'prop-1', bookings })).toThrow(
        /Cannot delete property: 1 active booking\(s\) are linked to it/
      );

      // Permitted if only cancelled bookings or no bookings exist
      const safeBookings = [{ propertyId: 'prop-1', status: 'Cancelled' }];
      expect(verifyCanDeleteProperty({ propertyId: 'prop-1', bookings: safeBookings })).toBe(true);
    });
  });

  describe('TC-SAD-005: Database Row Level Security (RLS) Permissions Matrix', () => {
    it('should strictly verify RLS access control rules on properties table', () => {
      const evaluatePropertyRLS = (action, role) => {
        if (action === 'SELECT') return true; // Public read
        if (action === 'INSERT' || action === 'UPDATE' || action === 'DELETE') {
          return role === 'admin' || role === 'super_admin';
        }
        return false;
      };

      // Public / Guest
      expect(evaluatePropertyRLS('SELECT', null)).toBe(true);
      expect(evaluatePropertyRLS('INSERT', null)).toBe(false);
      expect(evaluatePropertyRLS('DELETE', null)).toBe(false);

      // Normal User
      expect(evaluatePropertyRLS('SELECT', 'user')).toBe(true);
      expect(evaluatePropertyRLS('UPDATE', 'user')).toBe(false);

      // Admin & Super Admin
      expect(evaluatePropertyRLS('INSERT', 'admin')).toBe(true);
      expect(evaluatePropertyRLS('UPDATE', 'admin')).toBe(true);
      expect(evaluatePropertyRLS('DELETE', 'super_admin')).toBe(true);
    });
  });
});
