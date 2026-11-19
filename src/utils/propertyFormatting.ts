import type { Property } from '../types';

export type FormattableProperty = Partial<
  Pick<Property, 'price' | 'beds' | 'baths' | 'sqft' | 'availableUnits'>
>;

export interface FormattedPropertySpecs {
  beds: string;
  baths: string;
  sqft: string;
}

export function parsePriceTk(str: string | number | null | undefined): number | null {
  if (str === null || str === undefined || str === '') return null;
  const cleaned = String(str).replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : num;
}

export function formatPriceBangladeshi(val: number | null | undefined): string {
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

export function formatPropertyPrice(project: FormattableProperty | null | undefined): string {
  if (!project) return '';

  const prices: number[] = [];

  if (project.price !== undefined && project.price !== null && project.price !== '') {
    const p = parsePriceTk(project.price);
    if (p !== null) prices.push(p);
  }

  if (project.availableUnits && Array.isArray(project.availableUnits)) {
    project.availableUnits.forEach((unit) => {
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

export function formatPropertySpecs(
  project: FormattableProperty | null | undefined
): FormattedPropertySpecs {
  if (!project) return { beds: '', baths: '', sqft: '' };

  let minBeds = Infinity;
  let maxBeds = -Infinity;
  let minBaths = Infinity;
  let maxBaths = -Infinity;
  let minSqft = Infinity;
  let maxSqft = -Infinity;

  if (project.availableUnits && project.availableUnits.length > 0) {
    project.availableUnits.forEach((unit) => {
      const beds = Number(unit.beds);
      if (!Number.isNaN(beds) && beds > 0) {
        minBeds = Math.min(minBeds, beds);
        maxBeds = Math.max(maxBeds, beds);
      }

      const baths = Number(unit.baths);
      if (!Number.isNaN(baths) && baths > 0) {
        minBaths = Math.min(minBaths, baths);
        maxBaths = Math.max(maxBaths, baths);
      }

      const sizeStr = unit.size ? String(unit.size).replace(/[^\d.]/g, '') : '';
      const size = Number(sizeStr);
      if (!Number.isNaN(size) && size > 0 && sizeStr !== '') {
        minSqft = Math.min(minSqft, size);
        maxSqft = Math.max(maxSqft, size);
      }
    });
  }

  // Fallback to top-level property specs if unit ranges did not populate
  if (minBeds === Infinity) {
    const b = Number(project.beds);
    if (!Number.isNaN(b) && b > 0) {
      minBeds = b;
      maxBeds = b;
    }
  }
  if (minBaths === Infinity) {
    const b = Number(project.baths);
    if (!Number.isNaN(b) && b > 0) {
      minBaths = b;
      maxBaths = b;
    }
  }
  if (minSqft === Infinity) {
    const sizeStr = project.sqft ? String(project.sqft).replace(/[^\d.]/g, '') : '';
    const s = Number(sizeStr);
    if (!Number.isNaN(s) && s > 0 && sizeStr !== '') {
      minSqft = s;
      maxSqft = s;
    }
  }

  const formatRange = (min: number, max: number): string | null => {
    if (min === Infinity || max === -Infinity) return null;
    if (min === max) return `${min}`;
    return `${min} - ${max}`;
  };

  return {
    beds: formatRange(minBeds, maxBeds) || String(project.beds || '0'),
    baths: formatRange(minBaths, maxBaths) || String(project.baths || '0'),
    sqft: formatRange(minSqft, maxSqft) || String(project.sqft || '0'),
  };
}
