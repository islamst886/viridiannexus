/**
 * Core Domain Business Logic for Viridian Nexus Property Subsystem
 * Extracted for clean unit testing and enterprise test suite architecture.
 */

export const PRICE_RANGES = [
  { label: 'Under 1 Crore', min: 0, max: 10000000 },
  { label: '1 – 3 Crore', min: 10000000, max: 30000000 },
  { label: '3 – 5 Crore', min: 30000000, max: 50000000 },
  { label: '5 – 10 Crore', min: 50000000, max: 100000000 },
  { label: 'Above 10 Crore', min: 100000000, max: Infinity },
];

export function parsePriceTk(str) {
  if (!str) return null;
  const cleaned = String(str).replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

export function formatPriceBangladeshi(val) {
  if (val === null || val === undefined) return '';
  if (val >= 10000000) {
    const cr = val / 10000000;
    return `${Number.isInteger(cr) ? cr : cr.toFixed(2)}\u00A0Cr`;
  } else if (val >= 100000) {
    const lacks = val / 100000;
    return `${Number.isInteger(lacks) ? lacks : lacks.toFixed(2)}\u00A0Lakhs`;
  } else {
    return val.toLocaleString('en-IN');
  }
}

export function formatPropertyPrice(project) {
  if (!project) return '';

  const prices = [];
  
  if (project.price) {
    const p = parsePriceTk(project.price);
    if (p !== null) prices.push(p);
  }

  if (project.availableUnits && Array.isArray(project.availableUnits)) {
    project.availableUnits.forEach(unit => {
      if (unit.price) {
        const p = parsePriceTk(unit.price);
        if (p !== null) prices.push(p);
      }
    });
  }

  if (prices.length === 0) return 'Price on Request';

  const uniquePrices = [...new Set(prices)];

  if (uniquePrices.length === 1) {
    return `৳\u00A0${formatPriceBangladeshi(uniquePrices[0])}`;
  }

  const minPrice = Math.min(...uniquePrices);
  return `Starts from ৳\u00A0${formatPriceBangladeshi(minPrice)}`;
}

export function formatPropertySpecs(project) {
  if (!project) return { beds: '', baths: '', sqft: '' };

  let minBeds = Infinity, maxBeds = -Infinity;
  let minBaths = Infinity, maxBaths = -Infinity;
  let minSqft = Infinity, maxSqft = -Infinity;

  if (project.availableUnits && project.availableUnits.length > 0) {
    project.availableUnits.forEach(unit => {
      const beds = Number(unit.beds);
      if (!isNaN(beds) && beds > 0) {
        minBeds = Math.min(minBeds, beds);
        maxBeds = Math.max(maxBeds, beds);
      }

      const baths = Number(unit.baths);
      if (!isNaN(baths) && baths > 0) {
        minBaths = Math.min(minBaths, baths);
        maxBaths = Math.max(maxBaths, baths);
      }

      const sizeStr = unit.size ? String(unit.size).replace(/[^\d.]/g, '') : '';
      const size = Number(sizeStr);
      if (!isNaN(size) && size > 0 && sizeStr !== '') {
        minSqft = Math.min(minSqft, size);
        maxSqft = Math.max(maxSqft, size);
      }
    });
  }

  // Fallback to global property specs
  if (minBeds === Infinity) {
    const b = Number(project.beds);
    if (!isNaN(b) && b > 0) { minBeds = b; maxBeds = b; }
  }
  if (minBaths === Infinity) {
    const b = Number(project.baths);
    if (!isNaN(b) && b > 0) { minBaths = b; maxBaths = b; }
  }
  if (minSqft === Infinity) {
    const sizeStr = project.sqft ? String(project.sqft).replace(/[^\d.]/g, '') : '';
    const s = Number(sizeStr);
    if (!isNaN(s) && s > 0 && sizeStr !== '') { minSqft = s; maxSqft = s; }
  }

  const bedsDisplay = minBeds === Infinity ? '' : minBeds === maxBeds ? `${minBeds} Beds` : `${minBeds} - ${maxBeds} Beds`;
  const bathsDisplay = minBaths === Infinity ? '' : minBaths === maxBaths ? `${minBaths} Baths` : `${minBaths} - ${maxBaths} Baths`;
  const sqftDisplay = minSqft === Infinity ? '' : minSqft === maxSqft ? `${minSqft} Sq. FT` : `${minSqft} - ${maxSqft} Sq. FT`;

  return { beds: bedsDisplay, baths: bathsDisplay, sqft: sqftDisplay };
}

export function formatWithUnit(value, defaultUnit) {
  if (!value) return '';
  const strVal = String(value).trim();
  if (/[a-zA-Z]/.test(strVal)) {
    return strVal;
  }
  return `${strVal} ${defaultUnit}`;
}

export function getEmbedUrl(url) {
  if (!url) return '';
  if (url.includes('youtube.com/watch?v=')) {
    const videoId = new URL(url).searchParams.get('v');
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
}

export function calculateLightboxIndex(currentIndex, delta, totalImages) {
  if (!totalImages || totalImages <= 0) return 0;
  return (currentIndex + delta + totalImages) % totalImages;
}

export function filterProperties(properties, {
  searchTerm = '',
  selectedCommunities = [],
  selectedTypes = [],
  selectedStatus = [],
  selectedPriceRanges = []
} = {}) {
  return properties.filter(prop => {
    // 1. Search Term
    if (searchTerm?.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const nameMatch = prop.name?.toLowerCase().includes(term);
      const locMatch = prop.location?.toLowerCase().includes(term);
      if (!nameMatch && !locMatch) return false;
    }

    // 2. Communities
    if (selectedCommunities.length > 0) {
      const matchesCommunity = selectedCommunities.some(c => 
        prop.location?.toLowerCase().includes(c.toLowerCase())
      );
      if (!matchesCommunity) return false;
    }

    // 3. Property Types
    if (selectedTypes.length > 0) {
      const propTypes = prop.propertyType || prop.property_type || [];
      const matchesType = selectedTypes.some(t => propTypes.includes(t));
      if (!matchesType) return false;
    }

    // 4. Status
    if (selectedStatus.length > 0) {
      if (!selectedStatus.includes(prop.status)) return false;
    }

    // 5. Price Ranges
    if (selectedPriceRanges.length > 0) {
      const priceVal = parsePriceTk(prop.price);
      if (priceVal === null) return false;
      const matchesRange = selectedPriceRanges.some(label => {
        const range = PRICE_RANGES.find(r => r.label === label);
        if (!range) return false;
        return priceVal >= range.min && priceVal <= range.max;
      });
      if (!matchesRange) return false;
    }

    return true;
  });
}

export function generatePropertySlug(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function generateParkingId(seed = Math.random().toString(36).substr(2, 6)) {
  return `PKG-${seed.toUpperCase()}`;
}

export function validatePropertyInventory(inventory = []) {
  const seen = new Set();
  const errors = [];

  inventory.forEach((unit, idx) => {
    const key = `${unit.floor || ''}__${unit.unitName || ''}`.trim().toLowerCase();
    if (unit.floor && unit.unitName) {
      if (seen.has(key)) {
        errors.push(`Duplicate unit detected: Unit "${unit.unitName}" on Floor "${unit.floor}".`);
      }
      seen.add(key);
    }
  });

  return { valid: errors.length === 0, errors };
}

export function calculateMilestoneCompletion(milestones = []) {
  if (!milestones.length) return 0;
  const total = milestones.reduce((sum, m) => sum + (Number(m.percentage) || 0), 0);
  const avg = Math.round(total / milestones.length);
  return Math.min(100, Math.max(0, avg));
}

export function aggregatePropertyMediaUrls(property) {
  const urls = [];
  if (!property) return urls;

  if (property.images) {
    Object.values(property.images).forEach(val => {
      if (Array.isArray(val)) {
        val.forEach(url => { if (url && typeof url === 'string') urls.push(url); });
      } else if (val && typeof val === 'string') {
        urls.push(val);
      }
    });
  }

  if (property.brochureUrl) urls.push(property.brochureUrl);

  if (property.milestones && Array.isArray(property.milestones)) {
    property.milestones.forEach(m => {
      if (m.images && Array.isArray(m.images)) {
        m.images.forEach(url => { if (url) urls.push(url); });
      }
      if (m.imageUrl) urls.push(m.imageUrl);
    });
  }

  return urls;
}

export function toggleWishlistLogic(currentWishlist = [], property) {
  const exists = currentWishlist.some(p => p.id === property.id || p.propertyId === property.id);
  if (exists) {
    return {
      updatedWishlist: currentWishlist.filter(p => p.id !== property.id && p.propertyId !== property.id),
      action: 'removed'
    };
  } else {
    return {
      updatedWishlist: [...currentWishlist, {
        id: property.id,
        propertyId: property.id,
        name: property.name,
        price: property.price,
        location: property.location
      }],
      action: 'added'
    };
  }
}
