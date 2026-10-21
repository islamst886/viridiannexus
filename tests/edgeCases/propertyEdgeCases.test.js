import { describe, it, expect } from 'vitest';
import {
  parsePriceTk,
  formatPriceBangladeshi,
  formatPropertyPrice,
  getEmbedUrl,
  validatePropertyInventory
} from '../helpers/propertyLogic';
import { mapPropertyFromDB, mapPropertyToDB } from '../../src/utils/mappers';

describe('Property Edge Cases, Boundary Conditions & Schema Integrity (TC-EDG)', () => {

  describe('TC-EDG-001: Malformed, Extreme & Zero Price Strings', () => {
    it('should strip special characters, currencies, slashes and extract raw numeric value', () => {
      expect(parsePriceTk("৳ 3,50,00,000 /=")).toBe(35000000);
      expect(parsePriceTk("BDT 8,500,000")).toBe(8500000);
      expect(parsePriceTk("15.75 Lakhs")).toBe(15.75);
      expect(parsePriceTk("Price: 45000000")).toBe(45000000);
    });

    it('should safely return null for non-numeric words or empty strings', () => {
      expect(parsePriceTk("Call for Price")).toBeNull();
      expect(parsePriceTk("Price on Request")).toBeNull();
      expect(parsePriceTk("")).toBeNull();
      expect(parsePriceTk(null)).toBeNull();
      expect(parsePriceTk(undefined)).toBeNull();
    });

    it('should format zero or unparseable prices as Price on Request', () => {
      expect(formatPropertyPrice({ price: 'Call us' })).toBe('Price on Request');
      expect(formatPropertyPrice(null)).toBe('');
    });
  });

  describe('TC-EDG-002: Exact Inventory Duplication Collision', () => {
    it('should identify duplicate unit names on the same floor irrespective of casing', () => {
      const inventory = [
        { floor: '10', unitName: 'Suite A' },
        { floor: '10', unitName: 'suite a' } // Duplicate!
      ];

      const validation = validatePropertyInventory(inventory);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('Duplicate unit detected');
    });

    it('should allow identical unit names on DIFFERENT floors', () => {
      const inventory = [
        { floor: '10', unitName: 'Suite A' },
        { floor: '11', unitName: 'Suite A' } // Allowed (different floor)
      ];

      const validation = validatePropertyInventory(inventory);
      expect(validation.valid).toBe(true);
    });
  });

  describe('TC-EDG-003: Video URL Parsing Boundary Conditions', () => {
    it('should safely parse YouTube URLs with timestamp and tracking parameters', () => {
      const urlWithParams = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=45s&feature=shared';
      expect(getEmbedUrl(urlWithParams)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');

      const shortWithParams = 'https://youtu.be/dQw4w9WgXcQ?si=abcdef12345';
      expect(getEmbedUrl(shortWithParams)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('should handle empty or null video URLs without throwing exceptions', () => {
      expect(getEmbedUrl('')).toBe('');
      expect(getEmbedUrl(null)).toBe('');
      expect(getEmbedUrl(undefined)).toBe('');
    });
  });

  describe('TC-EDG-004: DB snake_case vs JS camelCase Round-Trip Fidelity', () => {
    it('should maintain complete schema and nested data integrity across mapPropertyToDB and mapPropertyFromDB', () => {
      const clientFormData = {
        id: 'prop-test-01',
        name: 'Viridian Test Residence',
        location: 'Jolshiri Sector 15',
        price: '30000000',
        status: 'Ready',
        propertyType: ['Apartment', 'Penthouse'],
        beds: 4,
        baths: 5,
        sqft: '2860',
        buildingType: 'Residential High-Rise',
        unitsPerFloor: '1',
        totalUnits: '12',
        landArea: '10',
        architect: 'Renowned International Architects',
        parkingAvailable: 'Yes',
        parkingPrice: '500000',
        passengerLifts: '2',
        frontRoadSize: '60',
        totalShare: '100%',
        landmarks: 'Near Central Park',
        googleMapLink: 'https://maps.google.com/?q=test',
        completionDate: '2026-12-31',
        overview: 'Sprawling luxury apartment with panoramic views.',
        brochureUrl: 'https://storage.com/brochure.pdf',
        amenities: ['24/7 Security', 'Infinity Pool'],
        customAmenities: [{ name: 'Spa', icon: 'Smile' }],
        availableUnits: [{ name: 'Unit 4A', price: '30000000', size: '2860' }],
        inventory: [{ id: 'inv-1', floor: '4', unitName: '4A', status: 'Available' }],
        parkingInventory: [{ id: 'PKG-01', label: 'P1-01', status: 'Available' }],
        milestones: [{ title: 'Foundation', percentage: 100 }],
        images: {
          hero: 'https://img.com/hero.jpg',
          map: '',
          floorPlan: '',
          video: '',
          gallery: ['https://img.com/g1.jpg']
        }
      };

      // 1. Convert to Database format
      const dbRow = mapPropertyToDB(clientFormData);

      expect(dbRow.id).toBe('prop-test-01');
      expect(dbRow.property_type).toEqual(['Apartment', 'Penthouse']);
      expect(dbRow.building_type).toBe('Residential High-Rise');
      expect(dbRow.sqft).toBe('2860 Sq. FT'); // Formatted with unit
      expect(dbRow.land_area).toBe('10 Katha'); // Formatted with unit
      expect(dbRow.front_road_size).toBe('60 FT'); // Formatted with unit
      expect(dbRow.available_units).toHaveLength(1);
      expect(dbRow.parking_inventory).toHaveLength(1);

      // 2. Convert back to Client format
      const clientMapped = mapPropertyFromDB(dbRow);

      expect(clientMapped.id).toBe('prop-test-01');
      expect(clientMapped.name).toBe('Viridian Test Residence');
      expect(clientMapped.propertyType).toEqual(['Apartment', 'Penthouse']);
      expect(clientMapped.buildingType).toBe('Residential High-Rise');
      expect(clientMapped.availableUnits).toEqual(clientFormData.availableUnits);
      expect(clientMapped.inventory).toEqual(clientFormData.inventory);
      expect(clientMapped.parkingInventory).toEqual(clientFormData.parkingInventory);
      expect(clientMapped.images.hero).toBe('https://img.com/hero.jpg');
      expect(clientMapped.images.gallery).toEqual(['https://img.com/g1.jpg']);
    });
  });
});
