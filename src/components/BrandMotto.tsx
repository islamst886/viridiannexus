import { cn } from '../lib/utils';

export type BrandMottoSize = 'hero' | 'section' | 'footer';
export type BrandMottoTone = 'gold' | 'emerald' | 'dark';

export interface BrandMottoProps {
  size?: BrandMottoSize;
  tone?: BrandMottoTone;
  className?: string;
}

const SIZE_CLASSES: Record<BrandMottoSize, string> = {
  hero: 'text-[34px] sm:text-[58px] md:text-[74px] lg:text-[86px] leading-[1.25] px-2',
  section: 'text-[34px] sm:text-[42px] lg:text-[48px] leading-[1.3] pr-2',
  footer: 'text-[28px] sm:text-[32px] md:text-[26px] lg:text-[32px] leading-[1.3] pr-2',
};

const TONE_CLASSES: Record<BrandMottoTone, string> = {
  gold: 'text-brand-accent',
  emerald: 'text-brand-primary',
  dark: 'text-brand-dark',
};

let cachedIsEdwardianAvailable: boolean | null = null;

/** Checks once if Edwardian Script ITC is installed locally so kerning only adjusts when needed. */
function isEdwardianScriptAvailable(): boolean {
  if (cachedIsEdwardianAvailable !== null) return cachedIsEdwardianAvailable;
  if (typeof document === 'undefined') return false;

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      cachedIsEdwardianAvailable = false;
      return false;
    }

    const probe = '."Homes Woven in Nature."';
    ctx.font = '72px monospace';
    const fallbackWidth = ctx.measureText(probe).width;
    ctx.font = '72px "Edwardian Script ITC", monospace';
    const edwardianWidth = ctx.measureText(probe).width;

    cachedIsEdwardianAvailable = Math.abs(edwardianWidth - fallbackWidth) > 1;
  } catch {
    cachedIsEdwardianAvailable = false;
  }

  return cachedIsEdwardianAvailable;
}

/** Renders the signature corporate motto in formal calligraphic script harmonized with brand tones. */
export default function BrandMotto({
  size = 'section',
  tone = 'emerald',
  className,
}: BrandMottoProps) {
  // Edwardian Script ITC gives `.` and straight `"` wide side-bearings on top of its steep slant,
  // leaving a large visual gap between `Nature.` and `"` unless pulled tighter.
  const closingQuoteClass = isEdwardianScriptAvailable() ? '-ml-[0.44em]' : '-ml-[0.06em]';

  return (
    <span
      className={cn(
        'inline-block max-w-full font-motto not-italic font-normal tracking-[0.01em]',
        SIZE_CLASSES[size],
        TONE_CLASSES[tone],
        className
      )}
    >
      "Homes Woven in Nature. <span className={closingQuoteClass}>"</span>
    </span>
  );
}
