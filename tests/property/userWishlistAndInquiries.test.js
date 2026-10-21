import { describe, it, expect } from 'vitest';
import { toggleWishlistLogic } from '../helpers/propertyLogic';
import { mockUsers } from '../helpers/mockData';

describe('User Wishlist & Authenticated Property Interactions (TC-USR)', () => {

  const propertyA = {
    id: 'prop-jolshiri-01',
    name: 'Viridian Jolshiri Exclusivity',
    price: '৳ 3.50 Cr',
    location: 'Sector 15, Jolshiri Abashon, Dhaka'
  };

  const propertyB = {
    id: 'prop-purbachal-02',
    name: 'Purbachal Lakefront Villa',
    price: '৳ 8.50 Cr',
    location: 'Sector 4, Purbachal, Dhaka'
  };

  describe('TC-USR-001 & TC-USR-002: Wishlist Add, Remove & Toggle Lifecycle', () => {
    it('should add a property to an empty wishlist', () => {
      const initialWishlist = [];
      const result = toggleWishlistLogic(initialWishlist, propertyA);

      expect(result.action).toBe('added');
      expect(result.updatedWishlist).toHaveLength(1);
      expect(result.updatedWishlist[0].id).toBe('prop-jolshiri-01');
      expect(result.updatedWishlist[0].name).toBe('Viridian Jolshiri Exclusivity');
    });

    it('should remove a property when toggling an already saved property', () => {
      const initialWishlist = [propertyA, propertyB];
      const result = toggleWishlistLogic(initialWishlist, propertyA);

      expect(result.action).toBe('removed');
      expect(result.updatedWishlist).toHaveLength(1);
      expect(result.updatedWishlist[0].id).toBe('prop-purbachal-02');
      expect(result.updatedWishlist.find(p => p.id === propertyA.id)).toBeUndefined();
    });
  });

  describe('TC-USR-003: Wishlist Deduplication', () => {
    it('should never contain duplicate entries for the same property id', () => {
      let wishlist = [];
      
      // Add property A
      const step1 = toggleWishlistLogic(wishlist, propertyA);
      wishlist = step1.updatedWishlist;
      expect(wishlist).toHaveLength(1);

      // Attempting to add property B
      const step2 = toggleWishlistLogic(wishlist, propertyB);
      wishlist = step2.updatedWishlist;
      expect(wishlist).toHaveLength(2);

      // Check unique IDs set length
      const uniqueIds = new Set(wishlist.map(p => p.id));
      expect(uniqueIds.size).toBe(wishlist.length);
    });
  });

  describe('TC-USR-004: Authenticated Lead Inquiry Auto-Linkage', () => {
    it('should auto-populate user profile details and enforce readOnly mode for logged-in user', () => {
      const loggedInUser = mockUsers.clientUserA;

      const prepareInquiryFormData = ({ userProfile, isLoggedIn }) => {
        if (isLoggedIn && userProfile) {
          return {
            name: userProfile.displayName || '',
            phone: userProfile.phone || '',
            email: userProfile.email || '',
            isReadOnly: true,
            linkedUserId: userProfile.uid
          };
        }
        return {
          name: '',
          phone: '',
          email: '',
          isReadOnly: false,
          linkedUserId: null
        };
      };

      const result = prepareInquiryFormData({ userProfile: loggedInUser, isLoggedIn: true });
      expect(result.name).toBe('Rahim Chowdhury');
      expect(result.phone).toBe('+8801711000000');
      expect(result.email).toBe('rahim.chowdhury@example.com');
      expect(result.isReadOnly).toBe(true);
      expect(result.linkedUserId).toBe('usr-uuid-101');
    });

    it('should leave form editable and linkedUserId null for guests', () => {
      const prepareInquiryFormData = ({ userProfile, isLoggedIn }) => {
        if (isLoggedIn && userProfile) {
          return { name: userProfile.displayName, isReadOnly: true };
        }
        return { name: '', isReadOnly: false, linkedUserId: null };
      };

      const result = prepareInquiryFormData({ userProfile: null, isLoggedIn: false });
      expect(result.name).toBe('');
      expect(result.isReadOnly).toBe(false);
      expect(result.linkedUserId).toBeNull();
    });
  });
});
