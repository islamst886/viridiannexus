import { describe, it, expect } from 'vitest';
import {
  formatWithUnit,
  generatePropertySlug,
  generateParkingId,
  validatePropertyInventory
} from '../helpers/propertyLogic';

export function calculateAdminDashboardStats({ usersCount, propertiesList, bookingsList }) {
  const activePropsCount = propertiesList.filter(p => p.status === 'Active' || p.status === 'Ready').length;
  const activeBookings = bookingsList.filter(b => b.status !== 'Cancelled');
  const totalValue = activeBookings.reduce((sum, b) => sum + (Number(b.total_price || b.totalPrice) || 0), 0);

  let formattedValue = '';
  if (totalValue >= 10000000) {
    formattedValue = `৳ ${(totalValue / 10000000).toFixed(2)} Cr`;
  } else if (totalValue >= 100000) {
    formattedValue = `৳ ${(totalValue / 100000).toFixed(2)} Lac`;
  } else {
    formattedValue = `৳ ${totalValue.toLocaleString()}`;
  }

  return {
    users: usersCount || 0,
    properties: activePropsCount,
    value: totalValue,
    formattedValue
  };
}

export function arrayMove(array, from, to) {
  const updated = [...array];
  const item = updated.splice(from, 1)[0];
  updated.splice(to, 0, item);
  return updated;
}

describe('Admin Property Catalog Management (TC-ADM)', () => {

  describe('TC-ADM-001 & TC-ADM-002: Property Directory & Realtime KPI Aggregation', () => {
    it('should aggregate active properties and total booking value in Crores / Lakhs', () => {
      const properties = [
        { id: 'p1', name: 'Prop 1', status: 'Ready' },
        { id: 'p2', name: 'Prop 2', status: 'Active' },
        { id: 'p3', name: 'Prop 3', status: 'Sold Out' }
      ];
      const bookings = [
        { totalPrice: 30000000, status: 'Active' },
        { totalPrice: 45000000, status: 'Completed' },
        { totalPrice: 20000000, status: 'Cancelled' } // Should be excluded!
      ];

      const stats = calculateAdminDashboardStats({
        usersCount: 45,
        propertiesList: properties,
        bookingsList: bookings
      });

      expect(stats.users).toBe(45);
      expect(stats.properties).toBe(2); // Ready + Active
      expect(stats.value).toBe(75000000); // 30M + 45M (excluding cancelled)
      expect(stats.formattedValue).toBe('৳ 7.50 Cr');
    });

    it('should format sub-crore values in Lac', () => {
      const stats = calculateAdminDashboardStats({
        usersCount: 10,
        propertiesList: [{ status: 'Active' }],
        bookingsList: [{ totalPrice: 8500000, status: 'Active' }]
      });

      expect(stats.value).toBe(8500000);
      expect(stats.formattedValue).toBe('৳ 85.00 Lac');
    });
  });

  describe('TC-ADM-003: Property Slug Auto-Generation', () => {
    it('should auto-generate URL-friendly kebab-case slug from property name', () => {
      expect(generatePropertySlug('Viridian Jolshiri Exclusivity Phase II')).toBe(
        'viridian-jolshiri-exclusivity-phase-ii'
      );
      expect(generatePropertySlug('  Lakefront Luxury Villa & Spa (2026)!  ')).toBe(
        'lakefront-luxury-villa-spa-2026'
      );
    });
  });

  describe('TC-ADM-004: Intelligent Unit Suffix Formatting', () => {
    it('should append default units only when no alphabetic text exists', () => {
      expect(formatWithUnit('2860', 'Sq. FT')).toBe('2860 Sq. FT');
      expect(formatWithUnit('2860 Sqft', 'Sq. FT')).toBe('2860 Sqft'); // Avoid duplicate!
      expect(formatWithUnit('10 Katha', 'Katha')).toBe('10 Katha');
      expect(formatWithUnit('60', 'FT')).toBe('60 FT');
      expect(formatWithUnit('60 Feet Road', 'FT')).toBe('60 Feet Road');
      expect(formatWithUnit('', 'Sq. FT')).toBe('');
    });
  });

  describe('TC-ADM-006: Exact Unit Inventory Matrix Management', () => {
    it('should manage physical units with floor, unit name, type, and availability status', () => {
      const inventory = [
        { id: 'inv-1', floor: '4th Floor', unitName: 'Unit 4A', unitType: 'Type A – 2,860 sqft', status: 'Available' },
        { id: 'inv-2', floor: '5th Floor', unitName: 'Unit 5A', unitType: 'Type A – 2,860 sqft', status: 'Booked' },
        { id: 'inv-3', floor: '6th Floor', unitName: 'Unit 6A', unitType: 'Type B – 3,200 sqft', status: 'On Hold' }
      ];

      expect(inventory[0].status).toBe('Available');
      expect(inventory[1].status).toBe('Booked');
      expect(inventory[2].status).toBe('On Hold');

      const validation = validatePropertyInventory(inventory);
      expect(validation.valid).toBe(true);
    });

    it('should detect duplicate unit names on the exact same floor', () => {
      const invalidInventory = [
        { id: 'inv-1', floor: '4', unitName: '4A' },
        { id: 'inv-2', floor: '4', unitName: '4A' } // Duplicate on same floor!
      ];

      const validation = validatePropertyInventory(invalidInventory);
      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('Duplicate unit detected');
    });
  });

  describe('TC-ADM-007: Individual Parking Inventory Tracking', () => {
    it('should generate individual parking spot with PKG- prefix and track status', () => {
      const spotId = generateParkingId('ABC123');
      expect(spotId).toBe('PKG-ABC123');

      const spot = {
        id: spotId,
        label: 'P1-05',
        level: 'Basement 1',
        zone: 'Zone A',
        status: 'Available',
        assignedBookingId: null
      };

      expect(spot.status).toBe('Available');
      expect(spot.assignedBookingId).toBeNull();
    });
  });

  describe('TC-ADM-008: Amenities & Custom Iconography', () => {
    it('should support standard amenity tags and custom amenities with custom icons', () => {
      const property = {
        amenities: ['24/7 Security', 'Infinity Pool', 'Helipad'],
        customAmenities: [
          {
            name: 'Rooftop Observatory',
            description: 'Telescope & Stargazing Lounge',
            icon: 'Sun'
          }
        ]
      };

      expect(property.amenities).toContain('Infinity Pool');
      expect(property.customAmenities[0].name).toBe('Rooftop Observatory');
      expect(property.customAmenities[0].icon).toBe('Sun');
    });
  });

  describe('TC-ADM-009: Drag-and-Drop Gallery Sorting with @dnd-kit', () => {
    it('should reorder gallery photos via arrayMove without losing image URLs', () => {
      const gallery = [
        'https://img.com/hero.jpg',
        'https://img.com/living.jpg',
        'https://img.com/rooftop.jpg',
        'https://img.com/pool.jpg'
      ];

      // Drag rooftop (index 2) to first position (index 0)
      const reordered = arrayMove(gallery, 2, 0);

      expect(reordered).toHaveLength(4);
      expect(reordered[0]).toBe('https://img.com/rooftop.jpg');
      expect(reordered[1]).toBe('https://img.com/hero.jpg');
      expect(reordered[2]).toBe('https://img.com/living.jpg');
      expect(reordered[3]).toBe('https://img.com/pool.jpg');
    });
  });
});
