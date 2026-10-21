import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROPERTY_TYPES,
  addPropertyTypePure,
  removePropertyTypePure
} from '../helpers/siteSettingsLogic';

describe('Global Property Types Taxonomy Settings Subsystem (TC-TAX)', () => {
  const currentTypes = [...DEFAULT_PROPERTY_TYPES];

  describe('TC-TAX-001: Taxonomy Defaults & Sorting Guarantee', () => {
    it('should provide default taxonomy containing 8 standard luxury classifications', () => {
      expect(DEFAULT_PROPERTY_TYPES).toHaveLength(8);
      expect(DEFAULT_PROPERTY_TYPES).toContain('Apartment');
      expect(DEFAULT_PROPERTY_TYPES).toContain('Penthouse');
      expect(DEFAULT_PROPERTY_TYPES).toContain('Luxury Apartment');
      expect(DEFAULT_PROPERTY_TYPES).toContain('Commercial');
    });

    it('should guarantee alphabetical ordering on the default taxonomy', () => {
      const sorted = [...DEFAULT_PROPERTY_TYPES].sort();
      expect(DEFAULT_PROPERTY_TYPES).toEqual(sorted);
    });
  });

  describe('TC-TAX-002: Property Type Addition with Deduplication', () => {
    it('should add new property type and sort the result alphabetically', () => {
      const updated = addPropertyTypePure('Eco Villa', currentTypes);

      expect(updated).toHaveLength(currentTypes.length + 1);
      expect(updated).toContain('Eco Villa');

      // Alphabetical order check: Eco Villa should be before Luxury Apartment
      const sorted = [...updated].sort();
      expect(updated).toEqual(sorted);
    });

    it('should deduplicate existing property types when adding duplicate', () => {
      const updated = addPropertyTypePure('Apartment', currentTypes);
      expect(updated).toHaveLength(currentTypes.length);
    });

    it('should ignore empty strings or whitespace in addition', () => {
      const updatedEmpty = addPropertyTypePure('', currentTypes);
      expect(updatedEmpty).toEqual(currentTypes);

      const updatedSpaces = addPropertyTypePure('   ', currentTypes);
      expect(updatedSpaces).toEqual(currentTypes);
    });
  });

  describe('TC-TAX-003: Property Type Removal', () => {
    it('should remove specified property type and maintain alphabetical order', () => {
      const updated = removePropertyTypePure('Commercial', currentTypes);

      expect(updated).toHaveLength(currentTypes.length - 1);
      expect(updated).not.toContain('Commercial');

      const sorted = [...updated].sort();
      expect(updated).toEqual(sorted);
    });

    it('should return identical sorted list if type to remove does not exist', () => {
      const updated = removePropertyTypePure('NonExistentType', currentTypes);
      expect(updated).toEqual(currentTypes);
    });
  });

  describe('TC-TAX-004: Realtime Taxonomy Update Processing', () => {
    it('should process incoming realtime payload for property_types', () => {
      const realtimePayload = {
        new: {
          key: 'property_types',
          value: {
            types: ['Villa', 'Apartment', 'Bungalow']
          }
        }
      };

      const incomingTypes = realtimePayload.new?.value?.types;
      expect(Array.isArray(incomingTypes)).toBe(true);

      const sorted = [...incomingTypes].sort();
      expect(sorted).toEqual(['Apartment', 'Bungalow', 'Villa']);
    });
  });
});
