import { supabase } from '../supabase';
import type { Booking, BookingDBRow, BookingPayment, BookingPaymentDBRow } from '../types';
import { escapeHtml, sanitizeInvoiceFilename } from './invoiceBuilder';
import { mapBookingFromDB, mapPaymentFromDB } from './mappers';

let cachedLogoDataUrl: string | null = null;
let cachedBrochureBgDataUrl: string | null = null;

/**
 * Scales an image data URL proportionally to fit within `maxDim` so high-res
 * source assets embed quickly in print spoolers while staying >450 DPI in the 54px crest box.
 */
async function downscaleDataUrl(rawDataUrl: string, maxDim = 260): Promise<string> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') return rawDataUrl;

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode error'));
      el.src = rawDataUrl;
    });

    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    if (!w || !h || (w <= maxDim && h <= maxDim)) {
      return rawDataUrl;
    }

    const scale = maxDim / Math.max(w, h);
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return rawDataUrl;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const resized = canvas.toDataURL('image/png');
    return resized && resized.length < rawDataUrl.length ? resized : rawDataUrl;
  } catch {
    return rawDataUrl;
  }
}

/**
 * Loads /logo.png once and caches it as a compact high-DPI inline Base64 PNG
 * so html2canvas PDF capture and isolated print iframes paint fast and reliably.
 */
export async function loadInvoiceLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  if (typeof window === 'undefined') return '/logo.png';

  try {
    const response = await fetch('/logo.png');
    if (!response.ok) return '/logo.png';
    const blob = await response.blob();
    const rawDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Failed to read logo blob'));
      };
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
    const compactDataUrl = await downscaleDataUrl(rawDataUrl, 260);
    cachedLogoDataUrl = compactDataUrl;
    return compactDataUrl;
  } catch {
    return '/logo.png';
  }
}

/**
 * Pre-renders the opaque A4 brochure chartreuse corner-glow backdrop once into a cached PNG
 * data URL so foreground <img> printing preserves the signature wash even when browser print
 * settings disable CSS background graphics or when GDI/XPS print spoolers flatten alpha gradients.
 */
export function loadInvoiceBrochureBgDataUrl(): string {
  if (cachedBrochureBgDataUrl) return cachedBrochureBgDataUrl;
  if (typeof document === 'undefined') return '';

  try {
    const W = 530;
    const H = 750;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const drawEllipticalGlow = (
      cx: number,
      cy: number,
      rx: number,
      ry: number,
      stops: Array<[number, string]>
    ) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(rx, ry);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (const [offset, color] of stops) {
        grad.addColorStop(offset, color);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(-2, -2, 4, 4);
      ctx.restore();
    };

    // Paint back-to-front matching CSS layered radial-gradient order
    drawEllipticalGlow(W, H, W * 0.5, H * 0.3, [
      [0, 'rgba(242, 249, 188, 0.48)'],
      [1, 'rgba(255, 255, 255, 0)'],
    ]);
    drawEllipticalGlow(0, H, W * 0.64, H * 0.4, [
      [0, 'rgba(232, 243, 146, 0.68)'],
      [0.56, 'rgba(246, 251, 212, 0.32)'],
      [1, 'rgba(255, 255, 255, 0)'],
    ]);
    drawEllipticalGlow(0, 0, W * 0.68, H * 0.42, [
      [0, 'rgba(226, 240, 128, 0.72)'],
      [0.55, 'rgba(244, 250, 200, 0.35)'],
      [1, 'rgba(255, 255, 255, 0)'],
    ]);

    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      cachedBrochureBgDataUrl = dataUrl;
      return dataUrl;
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Generates a high-contrast QR code PNG data URL for invoice verification.
 */
export async function generateInvoiceQrDataUrl(payload: string): Promise<string> {
  try {
    const QRCode = await import('qrcode');
    return await QRCode.toDataURL(payload, {
      width: 480,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });
  } catch {
    return '';
  }
}

/**
 * Shared self-contained CSS for the A4 Brochure-Themed Corporate Invoice.
 * Used in both the live in-app preview modal and the isolated print iframe / PDF export.
 */
export const INVOICE_SHEET_STYLES = `
  .vn-invoice-pages-root {
    display: flex;
    flex-direction: column;
    gap: 24px;
    align-items: center;
  }

  .vn-invoice-page {
    width: 794px;
    height: 1123px;
    background-color: #ffffff;
    background-image:
      radial-gradient(ellipse 68% 42% at 0% 0%, rgba(226, 240, 128, 0.72) 0%, rgba(244, 250, 200, 0.35) 55%, rgba(255, 255, 255, 0) 100%),
      radial-gradient(ellipse 64% 40% at 0% 100%, rgba(232, 243, 146, 0.68) 0%, rgba(246, 251, 212, 0.32) 56%, rgba(255, 255, 255, 0) 100%),
      radial-gradient(ellipse 50% 30% at 100% 100%, rgba(242, 249, 188, 0.48) 0%, rgba(255, 255, 255, 0) 100%);
    color: #111827;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.25;
    -webkit-font-smoothing: antialiased;
    text-rendering: geometricPrecision;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    box-shadow: 0 12px 35px rgba(15, 23, 42, 0.14);
    border: 1px solid #e5e7eb;
    text-align: left;
  }

  .vn-invoice-page *,
  .vn-invoice-page *::before,
  .vn-invoice-page *::after {
    box-sizing: border-box;
  }

  .vn-invoice-page img {
    display: block;
  }

  .vn-inv-bg-img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    pointer-events: none;
    z-index: 0;
  }

  .vn-inv-body {
    position: relative;
    z-index: 1;
    flex: 1 1 auto;
    padding: 18px 32px 10px 32px;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  /* Top Enlistment Strip matching brochure theme */
  .vn-inv-enlist-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  .vn-split-badge {
    display: inline-block;
    border-radius: 2px;
    overflow: hidden;
    box-shadow: 0 1px 2px rgba(15, 30, 107, 0.14);
    font-size: 9px;
    line-height: 1.2;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  .vn-split-badge-left {
    display: inline-block;
    vertical-align: top;
    background-color: #0b1e6b;
    color: #ffffff;
    font-weight: 800;
    padding: 4px 8px;
    line-height: 1.2;
  }

  .vn-split-badge-right {
    display: inline-block;
    vertical-align: top;
    background-color: #d92027;
    color: #ffffff;
    font-weight: 700;
    padding: 4px 8px;
    line-height: 1.2;
  }

  .vn-inv-compliance-pill {
    display: inline-block;
    font-size: 9px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #164e3b;
    background: rgba(255, 255, 255, 0.85);
    border: 1px solid #c7d996;
    padding: 3px 10px;
    border-radius: 999px;
  }

  /* Letterhead Masthead */
  .vn-inv-masthead {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .vn-inv-brand-col {
    display: flex;
    align-items: center;
    gap: 14px;
    max-width: 430px;
  }

  .vn-inv-logo-box {
    width: 54px;
    height: 54px;
    border-radius: 8px;
    background: #ffffff;
    border: 1.5px solid #1f2937;
    padding: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .vn-inv-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .vn-inv-company-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 22px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.08;
    margin: 0;
  }

  .vn-inv-company-sub {
    font-size: 11px;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: 0.04em;
    margin-top: 2px;
  }

  .vn-inv-motto {
    font-family: 'Pinyon Script', 'Edwardian Script ITC', Georgia, serif;
    font-size: 18px;
    color: #1f2937;
    margin-top: 2px;
    line-height: 1.22;
    padding-bottom: 1px;
  }

  .vn-inv-doc-meta-col {
    text-align: right;
    flex: 1;
  }

  .vn-inv-doc-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 18px;
    font-weight: 700;
    color: #0b1e6b;
    letter-spacing: 0.03em;
    margin: 0;
    line-height: 1.15;
  }

  .vn-inv-doc-subtitle {
    font-size: 10px;
    color: #4b5563;
    margin-top: 2px;
    line-height: 1.25;
    font-weight: 500;
  }

  .vn-inv-status-badge {
    display: inline-block;
    margin-top: 5px;
    padding: 3px 10px;
    border-radius: 3px;
    font-size: 9px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: 0.09em;
    text-transform: uppercase;
  }

  .vn-tone-paid { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .vn-tone-partial { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .vn-tone-due { background: #e0e7ff; color: #1e3a8a; border: 1px solid #a5b4fc; }
  .vn-tone-overdue { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .vn-tone-credit { background: #f3e8ff; color: #6b21a8; border: 1px solid #d8b4fe; }
  .vn-tone-cancelled { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
  .vn-tone-voided { background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; text-decoration: line-through; }
  .vn-tone-refund { background: #ecfeff; color: #155e75; border: 1px solid #a5f3fc; }
  .vn-tone-neutral { background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; }

  .vn-inv-watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-32deg);
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 84px;
    font-weight: 800;
    letter-spacing: 0.14em;
    color: rgba(153, 27, 27, 0.065);
    border: 4px solid rgba(153, 27, 27, 0.065);
    padding: 10px 30px;
    border-radius: 10px;
    text-transform: uppercase;
    white-space: nowrap;
    pointer-events: none;
    user-select: none;
    z-index: 2;
  }

  /* Double Horizontal Rule from brochure theme */
  .vn-double-rule {
    border-top: 2px solid #52585e;
    border-bottom: 1px solid #52585e;
    height: 4px;
    margin: 9px 0 9px 0;
    box-sizing: border-box;
  }

  /* Corporate Directory + QR + Invoice Info Strip */
  .vn-inv-dir-grid {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 7px 11px;
    margin-bottom: 8px;
  }

  .vn-inv-contact-table {
    font-size: 9.5px;
    line-height: 1.45;
    color: #1f2937;
    border-collapse: collapse;
    flex: 1;
  }

  .vn-inv-contact-table td {
    padding: 0.5px 0;
    vertical-align: top;
  }

  .vn-inv-contact-label {
    font-weight: 700;
    color: #111827;
    width: 88px;
    white-space: nowrap;
  }

  .vn-inv-meta-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .vn-inv-meta-kv {
    font-size: 9.5px;
    line-height: 1.48;
    text-align: right;
    color: #1f2937;
  }

  .vn-inv-meta-kv strong {
    color: #0b1e6b;
  }

  .vn-inv-qr-box {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    border-radius: 4px;
    padding: 3px;
    text-align: center;
  }

  .vn-inv-qr-img {
    width: 52px;
    height: 52px;
    display: block;
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }

  .vn-inv-qr-caption {
    font-size: 7px;
    font-weight: 700;
    letter-spacing: 0.05em;
    color: #475569;
    text-transform: uppercase;
    margin-top: 2px;
  }

  /* Billed To & Property Allocation Grid */
  .vn-inv-party-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 9px;
  }

  .vn-inv-party-card {
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #d7dee6;
    border-top: 3px solid #0b1e6b;
    border-radius: 5px;
    padding: 7px 11px;
  }

  .vn-inv-party-card.vn-party-accent {
    border-top-color: #d92027;
  }

  .vn-inv-party-heading {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #0b1e6b;
    margin-bottom: 5px;
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 3px;
  }

  .vn-inv-party-card.vn-party-accent .vn-inv-party-heading {
    color: #991b1b;
  }

  .vn-inv-party-name {
    font-size: 12.5px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 3px;
  }

  .vn-inv-party-row {
    font-size: 9.5px;
    color: #334155;
    line-height: 1.42;
    display: flex;
    gap: 6px;
  }

  .vn-inv-party-key {
    font-weight: 600;
    color: #64748b;
    min-width: 74px;
    flex-shrink: 0;
  }

  /* Continuation Page Compact Header */
  .vn-inv-cont-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 7px;
    margin-bottom: 9px;
    border-bottom: 2px solid #0b1e6b;
  }

  .vn-inv-cont-brand {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .vn-inv-cont-logo {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    border: 1px solid #374151;
    padding: 1px;
    background: #fff;
  }

  .vn-inv-cont-title {
    font-family: 'Playfair Display', Georgia, serif;
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
  }

  .vn-inv-cont-sub {
    font-size: 9.5px;
    color: #475569;
  }

  .vn-inv-cont-right {
    text-align: right;
    font-size: 9.5px;
    color: #334155;
    line-height: 1.35;
  }

  /* Line Items Table */
  .vn-inv-table-wrap {
    flex: 0 0 auto;
    margin-bottom: 8px;
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.96);
  }

  .vn-inv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 9.6px;
  }

  .vn-inv-table thead {
    background-color: #0b1e6b;
    color: #ffffff;
  }

  .vn-inv-table th {
    padding: 6px 7px;
    font-size: 8.2px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    text-align: left;
    white-space: nowrap;
  }

  .vn-inv-table td {
    padding: 5px 7px;
    border-top: 1px solid #e2e8f0;
    vertical-align: top;
    color: #1e293b;
  }

  .vn-inv-table tbody tr:nth-child(even) {
    background-color: #fafdf2;
  }

  .vn-nowrap {
    white-space: nowrap;
  }

  .vn-num {
    text-align: right !important;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .vn-center {
    text-align: center !important;
  }

  .vn-row-title {
    font-weight: 700;
    color: #0f172a;
    font-size: 9.8px;
    line-height: 1.25;
  }

  .vn-row-note {
    font-size: 8.2px;
    color: #64748b;
    margin-top: 1px;
    line-height: 1.25;
  }

  /* Summary-only final continuation banner */
  .vn-inv-reconcile-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    border-radius: 5px;
    border: 1px solid #c7d996;
    border-left: 4px solid #0b1e6b;
    background: rgba(247, 252, 224, 0.72);
    font-size: 9.8px;
    color: #1e293b;
    margin-bottom: 12px;
  }

  .vn-inv-reconcile-tag {
    font-size: 8px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0b1e6b;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    padding: 3px 8px;
    white-space: nowrap;
  }

  .vn-pill-mini {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 3px;
    font-size: 8px;
    line-height: 1.2;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
  }

  /* Bottom Summary + Payment Instructions Grid */
  .vn-inv-summary-grid {
    display: grid;
    grid-template-columns: 1.25fr 0.95fr;
    gap: 12px;
    margin-top: auto;
    margin-bottom: 7px;
  }

  .vn-inv-summary-grid--flush {
    margin-top: 4px;
  }

  .vn-inv-words-box {
    background: rgba(247, 252, 224, 0.72);
    border: 1px solid #d5e39b;
    border-left: 3.5px solid #0b1e6b;
    border-radius: 4px;
    padding: 6px 10px;
    margin-bottom: 6px;
  }

  .vn-inv-words-label {
    font-size: 8px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #0b1e6b;
    margin-bottom: 2px;
  }

  .vn-inv-words-value {
    font-size: 10px;
    font-weight: 700;
    color: #0f172a;
  }

  .vn-inv-notes-box {
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 6px 10px;
    font-size: 8.4px;
    color: #475569;
    line-height: 1.35;
  }

  .vn-inv-notes-title {
    font-size: 8.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #1e293b;
    margin-bottom: 3px;
  }

  .vn-inv-notes-list {
    margin: 0;
    padding-left: 13px;
  }

  .vn-inv-totals-card {
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid #cbd5e1;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }

  .vn-inv-totals-rows {
    padding: 8px 11px;
    font-size: 9.5px;
  }

  .vn-inv-total-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 3px 0;
    border-bottom: 1px dashed #e2e8f0;
    color: #334155;
  }

  .vn-inv-total-line:last-child {
    border-bottom: none;
  }

  .vn-inv-grand-total {
    background-color: #0b1e6b;
    color: #ffffff;
    padding: 8px 11px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 11px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  /* Signatures Row */
  .vn-inv-sign-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    padding-top: 6px;
    margin-bottom: 3px;
  }

  .vn-inv-sign-col {
    text-align: center;
    font-size: 8.6px;
    color: #475569;
  }

  .vn-inv-sign-line {
    border-top: 1px solid #64748b;
    margin-top: 16px;
    padding-top: 3px;
    font-weight: 700;
    color: #0f172a;
  }

  /* Bottom Brochure Publication Footer matching attached image */
  .vn-inv-footer-wrap {
    position: relative;
    z-index: 1;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .vn-inv-disclaimer-block {
    padding: 5px 24px 6px 24px;
    text-align: center;
    border-top: 1px solid #d1d5db;
    margin: 0 32px;
  }

  .vn-inv-disclaimer-text {
    font-size: 8.3px;
    color: #374151;
    line-height: 1.35;
  }

  .vn-inv-rights-text {
    font-size: 8.5px;
    font-weight: 600;
    color: #1f2937;
    margin-top: 3px;
    letter-spacing: 0.03em;
  }

  .vn-inv-grey-bar {
    height: 4px;
    background-color: #d1d3d4;
    width: 100%;
  }

  .vn-inv-bottom-strip {
    height: 29px;
    background: linear-gradient(90deg, #e7f29d 0%, #f4f9ce 52%, #e9f3a3 100%);
    padding: 0 32px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .vn-inv-page-tag {
    font-size: 8.8px;
    font-weight: 600;
    color: #334155;
  }

  .vn-inv-bottom-wordmark {
    font-size: 13.5px;
    font-weight: 800;
    color: #0b1e6b;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }
    html,
    body {
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .vn-invoice-pages-root {
      gap: 0 !important;
      display: block !important;
    }
    .vn-invoice-page,
    .vn-invoice-page * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .vn-invoice-page {
      width: 210mm !important;
      height: 296.6mm !important;
      max-height: 296.6mm !important;
      background-image: none !important;
      border: none !important;
      box-shadow: none !important;
      margin: 0 !important;
      overflow: hidden !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: always !important;
      break-after: page !important;
    }
    .vn-split-badge {
      box-shadow: none !important;
    }
    .vn-inv-compliance-pill,
    .vn-inv-dir-grid,
    .vn-inv-party-card,
    .vn-inv-table-wrap,
    .vn-inv-notes-box,
    .vn-inv-totals-card {
      background: #ffffff !important;
    }
    .vn-inv-reconcile-banner,
    .vn-inv-words-box {
      background: #f4f9d4 !important;
    }
    .vn-inv-bottom-strip {
      background: #edf5b4 !important;
    }
    .vn-invoice-page:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
  }
`;

function collectFontStylesheetsHtml(): string {
  if (typeof document === 'undefined') return '';
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .filter((node) => {
      if (node.tagName === 'LINK') {
        const href = (node as HTMLLinkElement).href || '';
        return href.includes('fonts.googleapis.com');
      }
      return false;
    })
    .map((node) => `<link rel="stylesheet" href="${escapeHtml((node as HTMLLinkElement).href)}" />`);
  return links.join('\n');
}

const INVOICE_FONT_SPECS = [
  '400 10px "Inter"',
  '600 10px "Inter"',
  '700 10px "Inter"',
  '600 18px "Playfair Display"',
  '700 22px "Playfair Display"',
  '400 18px "Pinyon Script"',
];

/**
 * Waits for Google Fonts weights and embedded images inside a target container
 * to finish loading and decoding before high-resolution Print or PDF rasterization.
 */
async function waitForInvoiceAssets(targetDoc: Document, rootEl: HTMLElement): Promise<void> {
  try {
    if ('fonts' in targetDoc && targetDoc.fonts) {
      const fontLoads = INVOICE_FONT_SPECS.map((spec) =>
        targetDoc.fonts.load(spec).catch(() => [])
      );
      await Promise.race([
        Promise.all([targetDoc.fonts.ready, ...fontLoads]),
        new Promise((resolve) => setTimeout(resolve, 1800)),
      ]);
    }
    const imgs = Array.from(rootEl.querySelectorAll('img'));
    await Promise.all(
      imgs.map(async (img) => {
        if (!img.complete) {
          await new Promise<void>((resolve) => {
            img.addEventListener('load', () => resolve(), { once: true });
            img.addEventListener('error', () => resolve(), { once: true });
            setTimeout(() => resolve(), 1500);
          });
        }
        if (typeof img.decode === 'function') {
          await img.decode().catch(() => {});
        }
      })
    );
  } catch {
    // Proceed cleanly if font/image decode checks time out
  }
}

/**
 * Opens an isolated off-screen print iframe with exact A4 dimensions & brochure colors,
 * waits for embedded images and fonts to finish decoding, and triggers window.print().
 */
export async function printInvoiceElement(sourceElement: HTMLElement, documentTitle: string): Promise<void> {
  if (typeof document === 'undefined') return;

  const existing = document.getElementById('vn-invoice-print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'vn-invoice-print-iframe';
  iframe.title = documentTitle;
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc || !iframe.contentWindow) {
    iframe.remove();
    throw new Error('Unable to initialize print frame');
  }

  const fontLinks = collectFontStylesheetsHtml();
  const safeTitle = escapeHtml(documentTitle);

  iframeDoc.open();
  iframeDoc.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>${safeTitle}</title>
    ${fontLinks}
    <style>
      ${INVOICE_SHEET_STYLES}
    </style>
  </head>
  <body>
    ${sourceElement.innerHTML}
  </body>
</html>`);
  iframeDoc.close();

  await waitForInvoiceAssets(iframeDoc, iframeDoc.body);

  const win = iframe.contentWindow;
  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.remove();
    }, 1000);
  };

  win.addEventListener('afterprint', cleanup, { once: true });
  win.focus();
  win.print();

  // Fallback cleanup if afterprint doesn't fire in some browsers
  setTimeout(cleanup, 60000);
}

/**
 * Captures each A4 `.vn-invoice-page` element inside the unscaled export container
 * at commercial print resolution (384 DPI at scale 4, with automatic fallback) and saves a crisp portrait A4 PDF.
 */
export async function downloadInvoicePdf(sourceElement: HTMLElement, filenameBase: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);

  const pageNodes = Array.from(sourceElement.querySelectorAll<HTMLElement>('.vn-invoice-page'));
  if (pageNodes.length === 0) {
    throw new Error('No printable invoice pages found');
  }

  if (typeof document !== 'undefined') {
    await waitForInvoiceAssets(document, sourceElement);
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageWidthMm = 210;
  const pageHeightMm = 297;

  // Tailwind Preflight sets `img { display: block }`, which shifts html2canvas's
  // internal FontMetrics baseline probe img onto a new line and pushes every text
  // line downward inside badges, pills, and headings. Scope inline display ONLY to
  // html2canvas's transient body > div probe container for the duration of capture.
  let baselineFixStyle: HTMLStyleElement | null = null;
  if (typeof document !== 'undefined' && document.head) {
    baselineFixStyle = document.createElement('style');
    baselineFixStyle.id = 'vn-h2c-baseline-fix';
    baselineFixStyle.textContent = `
      body > div:not(#root) > img { display: inline !important; }
      .vn-invoice-page img { display: block !important; }
    `;
    document.head.appendChild(baselineFixStyle);
  }

  const renderPageCanvas = async (pageEl: HTMLElement): Promise<HTMLCanvasElement> => {
    const scalesToTry = [4, 3, 2];
    let lastError: unknown;
    for (const scale of scalesToTry) {
      try {
        const canvas = await html2canvas(pageEl, {
          scale,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          width: 794,
          height: 1123,
          windowWidth: 794,
          windowHeight: 1123,
          scrollX: 0,
          scrollY: 0,
          logging: false,
          onclone: (clonedDoc, clonedPage) => {
            const clonedHost = clonedDoc.querySelector<HTMLElement>('[data-vn-export-host="1"]');
            if (clonedHost) {
              clonedHost.style.position = 'absolute';
              clonedHost.style.left = '0';
              clonedHost.style.top = '0';
            }
            clonedPage.style.border = 'none';
            clonedPage.style.boxShadow = 'none';
          },
        });
        if (canvas.width > 0 && canvas.height > 0) {
          return canvas;
        }
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Failed to rasterize invoice page');
  };

  try {
    for (let i = 0; i < pageNodes.length; i++) {
      const pageEl = pageNodes[i];
      if (!pageEl) continue;

      const canvas = await renderPageCanvas(pageEl);
      const imgData = canvas.toDataURL('image/png', 1.0);
      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(imgData, 'PNG', 0, 0, pageWidthMm, pageHeightMm, undefined, 'MEDIUM');
    }

    pdf.save(`${sanitizeInvoiceFilename(filenameBase)}.pdf`);
  } finally {
    baselineFixStyle?.remove();
  }
}

/**
 * Fetches a full booking record and its chronological payment ledger for invoice rendering.
 * Optionally validates client ownership via linkedUserId when called from the client portal.
 */
export async function fetchBookingInvoiceData(
  bookingId: string,
  expectedLinkedUserId?: string
): Promise<{ booking: Booking; payments: BookingPayment[] } | null> {
  const { data: bookingRow, error: bookingError } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single();

  if (bookingError || !bookingRow) return null;
  const typedBooking = bookingRow as BookingDBRow;
  if (expectedLinkedUserId && typedBooking.linked_user_id !== expectedLinkedUserId) {
    return null;
  }

  const { data: paymentsData, error: paymentsError } = await supabase
    .from('booking_payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('due_date', { ascending: true })
    .order('installment_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });

  if (paymentsError) {
    console.error('Error fetching booking payments for invoice:', paymentsError);
  }

  return {
    booking: mapBookingFromDB(typedBooking),
    payments: ((paymentsData || []) as BookingPaymentDBRow[]).map((row) => mapPaymentFromDB(row)),
  };
}
