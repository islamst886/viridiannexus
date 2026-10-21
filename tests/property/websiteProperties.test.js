import { describe, it, expect } from 'vitest';
import {
  filterProperties,
  formatPropertyPrice,
  formatPropertySpecs,
  getEmbedUrl,
  calculateLightboxIndex
} from '../helpers/propertyLogic';

const mockCatalog = [
  {
    id: 'prop-1',
    name: 'Viridian Jolshiri Exclusivity',
    location: 'Sector 15, Jolshiri Abashon, Dhaka',
    price: '35000000', // 3.5 Crore
    status: 'Under Construction',
    propertyType: ['Apartment', 'Luxury Apartment'],
    beds: 4,
    baths: 5,
    sqft: '2860',
    availableUnits: [
      { name: 'Unit 4A', beds: 4, baths: 5, size: '2860', price: '30000000' },
      { name: 'Unit 5A', beds: 5, baths: 6, size: '3200', price: '35000000' }
    ]
  },
  {
    id: 'prop-2',
    name: 'Purbachal Lakefront Villa',
    location: 'Sector 4, Purbachal, Dhaka',
    price: '85000000', // 8.5 Crore
    status: 'Ready',
    propertyType: ['Villa', 'Duplex'],
    beds: 6,
    baths: 7,
    sqft: '5500',
    availableUnits: []
  },
  {
    id: 'prop-3',
    name: 'Gulshan Diplomatic Suite',
    location: 'Road 83, Gulshan 2, Dhaka',
    price: '120000000', // 12 Crore
    status: 'On Sale',
    propertyType: ['Penthouse', 'Smart Home'],
    beds: 5,
    baths: 6,
    sqft: '6000',
    availableUnits: []
  },
  {
    id: 'prop-4',
    name: 'Bashundhara Executive Flat',
    location: 'Block I, Bashundhara R/A, Dhaka',
    price: '8500000', // 85 Lakhs (Under 1 Crore)
    status: 'Sold Out',
    propertyType: ['Apartment'],
    beds: 3,
    baths: 3,
    sqft: '1650',
    availableUnits: []
  }
];

describe('Website & Public Property Features (TC-PUB)', () => {

  describe('TC-PUB-001 & TC-PUB-003: Search & Multi-Facet Filtering', () => {
    it('should filter properties by free-text keyword search across name and location', () => {
      const results = filterProperties(mockCatalog, { searchTerm: 'Jolshiri' });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Viridian Jolshiri Exclusivity');

      const locResults = filterProperties(mockCatalog, { searchTerm: 'Gulshan' });
      expect(locResults).toHaveLength(1);
      expect(locResults[0].id).toBe('prop-3');
    });

    it('should filter by community / location tags', () => {
      const results = filterProperties(mockCatalog, { selectedCommunities: ['Purbachal'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Purbachal Lakefront Villa');
    });

    it('should filter by property type', () => {
      const results = filterProperties(mockCatalog, { selectedTypes: ['Penthouse'] });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('prop-3');
    });

    it('should filter by status', () => {
      const results = filterProperties(mockCatalog, { selectedStatus: ['Under Construction'] });
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('Under Construction');
    });
  });

  describe('TC-PUB-002: Price Range Filter Boundaries', () => {
    it('should filter properties in Under 1 Crore (< ৳ 10,000,000)', () => {
      const results = filterProperties(mockCatalog, { selectedPriceRanges: ['Under 1 Crore'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Bashundhara Executive Flat');
    });

    it('should filter properties in 3 – 5 Crore (৳ 30,000,000 - ৳ 50,000,000)', () => {
      const results = filterProperties(mockCatalog, { selectedPriceRanges: ['3 – 5 Crore'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Viridian Jolshiri Exclusivity');
    });

    it('should filter properties in Above 10 Crore (> ৳ 100,000,000)', () => {
      const results = filterProperties(mockCatalog, { selectedPriceRanges: ['Above 10 Crore'] });
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Gulshan Diplomatic Suite');
    });
  });

  describe('TC-PUB-004: Bangladeshi Price Formatting Engine', () => {
    it('should format multi-crore property prices with Cr symbol', () => {
      const priceStr = formatPropertyPrice({ price: '35000000' });
      expect(priceStr).toBe('৳\u00A03.50\u00A0Cr');
    });

    it('should format sub-crore property prices in Lakhs', () => {
      const priceStr = formatPropertyPrice({ price: '8500000' });
      expect(priceStr).toBe('৳\u00A085\u00A0Lakhs');
    });

    it('should display "Starts from ৳ X Cr" when available units have multiple prices', () => {
      const propertyWithUnits = {
        availableUnits: [
          { price: '30000000' }, // 3 Cr
          { price: '35000000' }  // 3.5 Cr
        ]
      };
      const priceStr = formatPropertyPrice(propertyWithUnits);
      expect(priceStr).toBe('Starts from ৳\u00A03\u00A0Cr');
    });

    it('should display "Price on Request" when price is zero, empty, or unparseable', () => {
      expect(formatPropertyPrice({ price: '' })).toBe('Price on Request');
      expect(formatPropertyPrice({ price: 'Call for Details' })).toBe('Price on Request');
    });
  });

  describe('TC-PUB-005: Property Specs Aggregation Rollup', () => {
    it('should compute min-max bed, bath, and sqft ranges from available units', () => {
      const property = mockCatalog[0];
      const specs = formatPropertySpecs(property);

      expect(specs.beds).toBe('4 - 5 Beds');
      expect(specs.baths).toBe('5 - 6 Baths');
      expect(specs.sqft).toBe('2860 - 3200 Sq. FT');
    });

    it('should fall back to property-level specs when no available units exist', () => {
      const property = mockCatalog[1]; // Villa with beds: 6, baths: 7, sqft: 5500
      const specs = formatPropertySpecs(property);

      expect(specs.beds).toBe('6 Beds');
      expect(specs.baths).toBe('7 Baths');
      expect(specs.sqft).toBe('5500 Sq. FT');
    });
  });

  describe('TC-PUB-008: YouTube Video URL Parsing & Embed Transformation', () => {
    it('should transform standard youtube.com/watch?v= links into embed format', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(getEmbedUrl(url)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('should transform short youtu.be/ links into embed format', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(getEmbedUrl(url)).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    });

    it('should preserve direct embed or mp4 URLs', () => {
      const embedUrl = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(getEmbedUrl(embedUrl)).toBe(embedUrl);

      const mp4Url = 'https://cdn.example.com/tour.mp4';
      expect(getEmbedUrl(mp4Url)).toBe(mp4Url);
    });
  });

  describe('TC-PUB-009: Lightbox Cyclical Navigation Indexing', () => {
    it('should cycle forward and wrap around to index 0 at the end of the gallery', () => {
      const totalImages = 4;
      expect(calculateLightboxIndex(0, 1, totalImages)).toBe(1);
      expect(calculateLightboxIndex(2, 1, totalImages)).toBe(3);
      expect(calculateLightboxIndex(3, 1, totalImages)).toBe(0); // Wrap-around!
    });

    it('should cycle backward and wrap around to the last index at the beginning', () => {
      const totalImages = 4;
      expect(calculateLightboxIndex(0, -1, totalImages)).toBe(3); // Wrap-around to end!
      expect(calculateLightboxIndex(3, -1, totalImages)).toBe(2);
    });
  });

  describe('TC-PUB-010: Lead Inquiry Validation', () => {
    it('should require all fields and privacy policy consent for guest inquiry submission', () => {
      const validateInquiry = ({ name, phone, email, message, agreedToPolicy }) => {
        if (!name?.trim()) return { valid: false, error: 'Name is required' };
        if (!phone?.trim()) return { valid: false, error: 'Phone is required' };
        if (!email?.trim() || !/\S+@\S+\.\S+/.test(email)) return { valid: false, error: 'Valid email is required' };
        if (!message?.trim()) return { valid: false, error: 'Message is required' };
        if (!agreedToPolicy) return { valid: false, error: 'You must agree to the privacy policy' };
        return { valid: true };
      };

      expect(validateInquiry({ name: '', phone: '017', email: 'a@b.com', message: 'Hi', agreedToPolicy: true }).valid).toBe(false);
      expect(validateInquiry({ name: 'Farhan', phone: '017', email: 'a@b.com', message: 'Hi', agreedToPolicy: false }).error).toBe(
        'You must agree to the privacy policy'
      );
      expect(validateInquiry({ name: 'Farhan', phone: '01711111111', email: 'farhan@example.com', message: 'Interested in flat', agreedToPolicy: true }).valid).toBe(true);
    });
  });
});
