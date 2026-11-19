import { COMPANY_INFO } from '../data/companyInfo';
import type { Booking, BookingPayment } from '../types';

export type InvoiceCategory =
  | 'booking-summary'
  | 'account-statement'
  | 'outstanding-bundle'
  | 'receipts-summary'
  | 'payment-receipt'
  | 'demand-invoice'
  | 'credit-note';

export interface InvoiceLineItem {
  id: string;
  sl: number;
  title: string;
  subtitle?: string;
  dueDate?: string | null;
  paidDate?: string | null;
  paymentMode?: string;
  reference?: string;
  status: string;
  scheduledAmount: number;
  receivedAmount: number;
  netPayableOrCredit: number;
  isCredit?: boolean;
  isWaived?: boolean;
  isOverdue?: boolean;
}

export interface InvoiceDocument {
  category: InvoiceCategory;
  documentTitle: string;
  documentSubtitle: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string | null;
  statusLabel: string;
  statusTone: 'paid' | 'partial' | 'due' | 'overdue' | 'credit' | 'neutral' | 'cancelled';
  bookingRef: string;
  qrPayload: string;
  company: typeof COMPANY_INFO;
  billedTo: {
    name: string;
    email: string;
    phone: string;
    nid: string;
    address: string;
    clientCode: string;
  };
  propertySummary: {
    propertyName: string;
    location: string;
    unitType: string;
    unitNumber: string;
    parking: string;
    stage: string;
    bookingStatus: string;
    installmentPlan: string;
    bookingCreatedAt: string;
  };
  items: InvoiceLineItem[];
  financialSummary: {
    totalAgreedPrice: number;
    totalBilledInDoc: number;
    totalPaidInDoc: number;
    documentNetAmount: number;
    overallTotalPaid: number;
    overallBalanceDue: number;
    overallWaivedAmount: number;
    completionPercentage: number;
  };
  amountInWordsLabel: string;
  amountInWordsValue: string;
  remarks: string[];
  paymentInstructions: string[];
}

export function formatInvoiceMoney(amount: number | string | null | undefined, includeNegativeSign = true): string {
  const num = Number(amount);
  if (!Number.isFinite(num) || num === 0) return '৳ 0';
  const absRounded = Math.round(Math.abs(num)).toLocaleString('en-IN');
  if (num < 0 && includeNegativeSign) return `-৳ ${absRounded}`;
  return `৳ ${absRounded}`;
}

export function formatInvoiceDate(value: string | null | undefined): string {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n] || '';
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o > 0 ? `${TENS[t]} ${ONES[o]}` : TENS[t] || '';
}

function threeDigitsToWords(n: number): string {
  const h = Math.floor(n / 100);
  const rem = n % 100;
  if (h > 0 && rem > 0) return `${ONES[h]} Hundred ${twoDigitsToWords(rem)}`;
  if (h > 0) return `${ONES[h]} Hundred`;
  return twoDigitsToWords(rem);
}

/**
 * Converts a BDT amount into South Asian (Crore / Lac) English words for formal invoices.
 */
export function numberToBDTWords(amount: number): string {
  const rounded = Math.round(Math.abs(Number(amount) || 0));
  if (rounded === 0) return 'Zero Taka Only';

  let n = rounded;
  const parts: string[] = [];

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  if (crore > 0) {
    parts.push(`${crore >= 100 ? threeDigitsToWords(crore) : twoDigitsToWords(crore)} Crore`);
  }

  const lac = Math.floor(n / 100000);
  n %= 100000;
  if (lac > 0) {
    parts.push(`${twoDigitsToWords(lac)} Lac`);
  }

  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand > 0) {
    parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  }

  if (n > 0) {
    parts.push(threeDigitsToWords(n));
  }

  const prefix = amount < 0 ? 'Credit of BDT ' : 'BDT ';
  return `${prefix}${parts.join(' ')} Taka Only`;
}

export function extractReferenceFromNotes(notes: string | null | undefined): string {
  if (!notes) return '—';
  const match = notes.match(/Ref:\s*([^|\n]+)/i);
  if (match?.[1]) return match[1].trim();
  return '—';
}

export function isPaymentOverdue(payment: BookingPayment, referenceDate = new Date()): boolean {
  if (payment.status !== 'Scheduled' && payment.status !== 'Overdue') return false;
  if (payment.status === 'Overdue') return true;
  const due = payment.dueDate || payment.scheduledDate;
  if (!due) return false;
  const parsed = new Date(due);
  if (Number.isNaN(parsed.getTime())) return false;
  const dueEnd = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59);
  return dueEnd < referenceDate;
}

export function formatPaymentLabel(payment: BookingPayment): string {
  const numSuffix = payment.installmentNumber ? ` #${payment.installmentNumber}` : '';
  return `${payment.type}${numSuffix}`;
}

export function sanitizeInvoiceFilename(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'Viridian-Invoice';
}

function deriveSequenceCode(payment: BookingPayment, index: number): string {
  const rawType = payment.type.toLowerCase();
  if (rawType.includes('down')) return 'DP';
  if (rawType.includes('parking') && Number(payment.scheduledAmount) < 0) return 'CR-PK';
  if (rawType.includes('parking')) return 'PK';
  if (payment.installmentNumber) return `INS-${String(payment.installmentNumber).padStart(2, '0')}`;
  return `TX-${String(index + 1).padStart(2, '0')}`;
}

function inferRowInvoiceCategory(payment: BookingPayment): InvoiceCategory {
  if (Number(payment.scheduledAmount) < 0 || payment.status === 'Waived' || payment.type.toLowerCase().includes('credit note')) {
    return 'credit-note';
  }
  if (payment.status === 'Paid' || (payment.status === 'Partially Paid' && Number(payment.receivedAmount) > 0)) {
    return 'payment-receipt';
  }
  return 'demand-invoice';
}

export function classifyPaymentDocumentCategory(payment: BookingPayment): {
  category: InvoiceCategory;
  actionLabel: string;
} {
  const category = inferRowInvoiceCategory(payment);
  if (category === 'credit-note') {
    return {
      category,
      actionLabel: payment.status === 'Waived' ? 'Waiver Memo' : 'Credit Note',
    };
  }
  if (category === 'payment-receipt') {
    return {
      category,
      actionLabel: payment.status === 'Paid' ? 'Receipt' : 'Partial Receipt',
    };
  }
  return {
    category,
    actionLabel: 'Invoice',
  };
}

function buildLineItem(
  payment: BookingPayment,
  sl: number,
  referenceDate: Date,
  audience: 'admin' | 'client' = 'admin'
): InvoiceLineItem {
  const scheduled = Number(payment.scheduledAmount) || 0;
  const received = Number(payment.receivedAmount) || 0;
  const isCredit = scheduled < 0 || payment.type.toLowerCase().includes('credit note');
  const isWaived = payment.status === 'Waived';
  const overdue = isPaymentOverdue(payment, referenceDate);

  let net = 0;
  if (isCredit) {
    net = Math.abs(scheduled);
  } else if (isWaived) {
    net = 0;
  } else if (payment.status === 'Paid') {
    net = received;
  } else {
    net = Math.max(0, scheduled - received);
  }

  return {
    id: payment.id,
    sl,
    title: formatPaymentLabel(payment),
    subtitle: audience === 'client' ? undefined : payment.notes || undefined,
    dueDate: payment.dueDate || payment.scheduledDate || null,
    paidDate: payment.paidDate || null,
    paymentMode: payment.paymentMode || '—',
    reference: extractReferenceFromNotes(payment.notes),
    status: isWaived ? 'Waived' : overdue ? 'Overdue' : payment.status || 'Scheduled',
    scheduledAmount: scheduled,
    receivedAmount: received,
    netPayableOrCredit: net,
    isCredit,
    isWaived,
    isOverdue: overdue,
  };
}

function computeWaivedTotal(payments: BookingPayment[]): number {
  return payments
    .filter((p) => p.status === 'Waived')
    .reduce((acc, p) => acc + Math.max(0, Number(p.scheduledAmount) || 0), 0);
}

export interface BuildInvoiceOptions {
  booking: Booking;
  payments: BookingPayment[];
  category: InvoiceCategory;
  targetPaymentId?: string;
  issueDate?: Date;
  audience?: 'admin' | 'client';
}

export function buildInvoiceDocument({
  booking,
  payments,
  category,
  targetPaymentId,
  issueDate = new Date(),
  audience = 'admin',
}: BuildInvoiceOptions): InvoiceDocument {
  const ref = booking.bookingRef || `VN-${booking.id.slice(0, 8).toUpperCase()}`;
  const formattedIssueDate = formatInvoiceDate(issueDate.toISOString());
  const totalPrice = Number(booking.totalPrice) || 0;
  const totalPaid = Number(booking.totalPaid) || 0;
  const balanceDue = Number(booking.balanceDue) || 0;
  const completionPct = totalPrice > 0 ? Math.min(100, Math.round((totalPaid / totalPrice) * 100)) : 0;
  const overallWaived = computeWaivedTotal(payments);

  const clientCodeSource = booking.linkedUserId || booking.clientId || booking.id;
  const billedTo = {
    name: booking.clientName || 'Valued Client',
    email: booking.clientEmail || 'N/A',
    phone: booking.clientPhone || 'N/A',
    nid: booking.clientNid || 'Not Provided',
    address: booking.clientAddress || 'Address not on file',
    clientCode: clientCodeSource ? clientCodeSource.slice(0, 8).toUpperCase() : 'N/A',
  };

  const propertySummary = {
    propertyName: booking.propertyName || 'Viridian Nexus Residence',
    location: booking.propertyLocation || 'Dhaka, Bangladesh',
    unitType: booking.unitType || 'Standard Residence',
    unitNumber: booking.unitNumber || 'TBD',
    parking: booking.parkingIncluded
      ? booking.parkingIncluded
      : (booking.parkingRequested ?? 0) > 0
        ? `${booking.parkingRequested} Spot(s) Requested`
        : 'None',
    stage: booking.stage || 'EOI',
    bookingStatus: booking.status || 'Active',
    installmentPlan: booking.installmentPlan || 'Custom Schedule',
    bookingCreatedAt: formatInvoiceDate(booking.createdAt),
  };

  const defaultInstructions = [
    `Crossed Cheque / Pay Order / Demand Draft should be drawn in favor of "${COMPANY_INFO.legalName}".`,
    `Please quote Booking Ref "${ref}" and the Invoice Number on all Bank Transfers or Mobile Financial remittances.`,
    `Official payment receipts are issued upon bank realization and verification by Finance & Accounts (${COMPANY_INFO.email}).`,
  ];

  const baseRemarks: string[] = [];
  if (booking.status === 'Cancelled') {
    baseRemarks.push('Notice: This booking currently carries a CANCELLED status in the administrative ledger.');
  } else if (booking.status === 'On Hold') {
    baseRemarks.push('Notice: This booking is currently marked ON HOLD pending administrative clearance.');
  }

  // Single-payment invoices / receipts / credit notes
  if (category === 'payment-receipt' || category === 'demand-invoice' || category === 'credit-note') {
    const idx = payments.findIndex((p) => p.id === targetPaymentId);
    const selected = (idx >= 0 ? payments[idx] : payments[0]) ?? {
      id: 'ad-hoc',
      bookingId: booking.id,
      type: 'Down Payment',
      scheduledAmount: booking.downPaymentAmount || booking.totalPrice,
      receivedAmount: 0,
      status: 'Scheduled',
      paymentMode: 'Bank Transfer',
      notes: '',
    };
    const safeIdx = idx >= 0 ? idx : 0;
    const lineItem = buildLineItem(selected, 1, issueDate, audience);
    const seqCode = deriveSequenceCode(selected, safeIdx);
    const effectiveCategory = targetPaymentId ? inferRowInvoiceCategory(selected) : category;
    const isParkingAddon = selected.type.toLowerCase().includes('parking') && selected.scheduledAmount >= 0;

    if (effectiveCategory === 'credit-note' || category === 'credit-note') {
      const isWaived = selected.status === 'Waived';
      const creditVal = isWaived ? Math.abs(selected.scheduledAmount) : Math.abs(selected.scheduledAmount);
      const docNum = `VN-CN-${ref}-${seqCode}`;
      const qr = `${COMPANY_INFO.websiteUrl} | ${docNum} | ${ref} | ${billedTo.name} | ${formatInvoiceMoney(creditVal)}`;
      return {
        category: 'credit-note',
        documentTitle: isWaived ? 'WAIVER & ADJUSTMENT MEMO' : 'OFFICIAL CREDIT NOTE',
        documentSubtitle: isWaived
          ? `Fee Waiver Statement — ${lineItem.title}`
          : `Contract Price Credit Adjustment — ${lineItem.title}`,
        invoiceNumber: docNum,
        issueDate: formattedIssueDate,
        dueDate: null,
        statusLabel: isWaived ? 'WAIVED' : 'CREDITED',
        statusTone: 'credit',
        bookingRef: ref,
        qrPayload: qr,
        company: COMPANY_INFO,
        billedTo,
        propertySummary,
        items: [lineItem],
        financialSummary: {
          totalAgreedPrice: totalPrice,
          totalBilledInDoc: -creditVal,
          totalPaidInDoc: Math.abs(selected.receivedAmount || creditVal),
          documentNetAmount: creditVal,
          overallTotalPaid: totalPaid,
          overallBalanceDue: balanceDue,
          overallWaivedAmount: overallWaived,
          completionPercentage: completionPct,
        },
        amountInWordsLabel: isWaived ? 'Waived Amount in Words' : 'Credited Amount in Words',
        amountInWordsValue: numberToBDTWords(creditVal),
        remarks: [
          ...baseRemarks,
          (audience === 'admin' ? selected.notes : undefined) ||
            `Official credit adjustment recorded against ${lineItem.title}.`,
          'Total agreed property price and net balance due reflect the post-adjustment position shown above.',
        ],
        paymentInstructions: defaultInstructions,
      };
    }

    if (effectiveCategory === 'payment-receipt' || (category === 'payment-receipt' && Number(selected.receivedAmount) > 0)) {
      const receivedVal = Number(selected.receivedAmount) || 0;
      const isFull = selected.status === 'Paid';
      const docNum = `VN-REC-${ref}-${seqCode}`;
      const qr = `${COMPANY_INFO.websiteUrl} | ${docNum} | ${ref} | ${billedTo.name} | Paid ${formatInvoiceMoney(receivedVal)}`;
      return {
        category: 'payment-receipt',
        documentTitle: isFull ? 'OFFICIAL PAYMENT RECEIPT' : 'PARTIAL PAYMENT RECEIPT',
        documentSubtitle: `${lineItem.title} Settlement Acknowledgment`,
        invoiceNumber: docNum,
        issueDate: formattedIssueDate,
        dueDate: selected.dueDate ? formatInvoiceDate(selected.dueDate) : null,
        statusLabel: isFull ? 'PAID IN FULL' : 'PARTIALLY PAID',
        statusTone: isFull ? 'paid' : 'partial',
        bookingRef: ref,
        qrPayload: qr,
        company: COMPANY_INFO,
        billedTo,
        propertySummary,
        items: [lineItem],
        financialSummary: {
          totalAgreedPrice: totalPrice,
          totalBilledInDoc: Math.max(0, Number(selected.scheduledAmount) || 0),
          totalPaidInDoc: receivedVal,
          documentNetAmount: receivedVal,
          overallTotalPaid: totalPaid,
          overallBalanceDue: balanceDue,
          overallWaivedAmount: overallWaived,
          completionPercentage: completionPct,
        },
        amountInWordsLabel: 'Amount Received in Words',
        amountInWordsValue: numberToBDTWords(receivedVal),
        remarks: [
          ...baseRemarks,
          `Payment Mode: ${lineItem.paymentMode || 'Confirmed'} | Settlement Date: ${formatInvoiceDate(selected.paidDate || issueDate.toISOString())}${lineItem.reference !== '—' ? ` | Transaction Ref: ${lineItem.reference}` : ''}.`,
          isFull
            ? `${lineItem.title} has been settled in full and credited toward booking ${ref}.`
            : `Remaining balance on ${lineItem.title}: ${formatInvoiceMoney(Math.max(0, selected.scheduledAmount - receivedVal))}.`,
        ],
        paymentInstructions: defaultInstructions,
      };
    }

    // Demand / Tax Invoice for unpaid or partial scheduled item
    const payableNow = Math.max(0, (Number(selected.scheduledAmount) || 0) - (Number(selected.receivedAmount) || 0));
    const docNum = `VN-INV-${ref}-${seqCode}`;
    const overdue = isPaymentOverdue(selected, issueDate);
    const qr = `${COMPANY_INFO.websiteUrl} | ${docNum} | ${ref} | ${billedTo.name} | Due ${formatInvoiceMoney(payableNow)}`;
    return {
      category: 'demand-invoice',
      documentTitle: isParkingAddon ? 'PARKING ADD-ON INVOICE' : 'PAYMENT DEMAND INVOICE',
      documentSubtitle: `${lineItem.title} — ${propertySummary.propertyName}`,
      invoiceNumber: docNum,
      issueDate: formattedIssueDate,
      dueDate: formatInvoiceDate(selected.dueDate || selected.scheduledDate),
      statusLabel: overdue ? 'OVERDUE' : selected.status === 'Partially Paid' ? 'PARTIAL DUE' : 'PAYMENT DUE',
      statusTone: overdue ? 'overdue' : selected.status === 'Partially Paid' ? 'partial' : 'due',
      bookingRef: ref,
      qrPayload: qr,
      company: COMPANY_INFO,
      billedTo,
      propertySummary,
      items: [lineItem],
      financialSummary: {
        totalAgreedPrice: totalPrice,
        totalBilledInDoc: Math.max(0, Number(selected.scheduledAmount) || 0),
        totalPaidInDoc: Number(selected.receivedAmount) || 0,
        documentNetAmount: payableNow,
        overallTotalPaid: totalPaid,
        overallBalanceDue: balanceDue,
        overallWaivedAmount: overallWaived,
        completionPercentage: completionPct,
      },
      amountInWordsLabel: 'Net Payable in Words',
      amountInWordsValue: numberToBDTWords(payableNow),
      remarks: [
        ...baseRemarks,
        (audience === 'admin' ? selected.notes : undefined) ||
          `Kindly remit ${formatInvoiceMoney(payableNow)} on or before ${formatInvoiceDate(selected.dueDate || selected.scheduledDate)} to keep milestones on schedule.`,
      ],
      paymentInstructions: defaultInstructions,
    };
  }

  // Consolidated Outstanding Dues Invoice
  if (category === 'outstanding-bundle') {
    const unpaidRows = payments
      .filter((p) => {
        if (p.status === 'Paid' || p.status === 'Waived') return false;
        const sched = Number(p.scheduledAmount) || 0;
        const rec = Number(p.receivedAmount) || 0;
        return sched > 0 && sched - rec > 0;
      })
      .map((p, idx) => buildLineItem(p, idx + 1, issueDate, audience));

    const totalScheduled = unpaidRows.reduce((acc, r) => acc + r.scheduledAmount, 0);
    const totalAlreadyReceivedOnRows = unpaidRows.reduce((acc, r) => acc + r.receivedAmount, 0);
    const netDue = unpaidRows.reduce((acc, r) => acc + r.netPayableOrCredit, 0);
    const hasOverdue = unpaidRows.some((r) => r.isOverdue);
    const nextDueRow = unpaidRows[0];
    const docNum = `VN-DUE-${ref}`;
    const qr = `${COMPANY_INFO.websiteUrl} | ${docNum} | ${ref} | ${billedTo.name} | Total Due ${formatInvoiceMoney(netDue)}`;

    return {
      category: 'outstanding-bundle',
      documentTitle: 'OUTSTANDING PAYMENT INVOICE',
      documentSubtitle: 'Consolidated Schedule of Pending & Upcoming Dues',
      invoiceNumber: docNum,
      issueDate: formattedIssueDate,
      dueDate: nextDueRow?.dueDate ? formatInvoiceDate(nextDueRow.dueDate) : null,
      statusLabel:
        booking.status === 'Cancelled'
          ? 'CANCELLED'
          : unpaidRows.length === 0
            ? 'SETTLED'
            : hasOverdue
              ? 'INCLUDES OVERDUE'
              : 'BALANCE DUE',
      statusTone:
        booking.status === 'Cancelled'
          ? 'cancelled'
          : unpaidRows.length === 0
            ? 'paid'
            : hasOverdue
              ? 'overdue'
              : 'due',
      bookingRef: ref,
      qrPayload: qr,
      company: COMPANY_INFO,
      billedTo,
      propertySummary,
      items: unpaidRows,
      financialSummary: {
        totalAgreedPrice: totalPrice,
        totalBilledInDoc: totalScheduled,
        totalPaidInDoc: totalAlreadyReceivedOnRows,
        documentNetAmount: netDue,
        overallTotalPaid: totalPaid,
        overallBalanceDue: balanceDue,
        overallWaivedAmount: overallWaived,
        completionPercentage: completionPct,
      },
      amountInWordsLabel: 'Total Outstanding in Words',
      amountInWordsValue: numberToBDTWords(netDue),
      remarks: [
        ...baseRemarks,
        unpaidRows.length === 0
          ? 'All scheduled obligations on this booking have been settled or waived.'
          : `Covers ${unpaidRows.length} pending ledger item(s). Earliest due date: ${formatInvoiceDate(nextDueRow?.dueDate)}.`,
      ],
      paymentInstructions: defaultInstructions,
    };
  }

  // Consolidated Receipts Summary
  if (category === 'receipts-summary') {
    const paidRows = payments
      .filter((p) => Number(p.receivedAmount) > 0 && Number(p.scheduledAmount) >= 0)
      .map((p, idx) => buildLineItem(p, idx + 1, issueDate, audience));

    const sumScheduled = paidRows.reduce((acc, r) => acc + r.scheduledAmount, 0);
    const sumReceived = paidRows.reduce((acc, r) => acc + r.receivedAmount, 0);
    const docNum = `VN-REC-SUM-${ref}`;
    const qr = `${COMPANY_INFO.websiteUrl} | ${docNum} | ${ref} | ${billedTo.name} | Total Received ${formatInvoiceMoney(sumReceived || totalPaid)}`;

    return {
      category: 'receipts-summary',
      documentTitle: 'CONSOLIDATED RECEIPT SUMMARY',
      documentSubtitle: 'Official Acknowledgment of Realized Client Payments',
      invoiceNumber: docNum,
      issueDate: formattedIssueDate,
      dueDate: null,
      statusLabel: balanceDue === 0 ? 'FULLY SETTLED' : `${completionPct}% REALIZED`,
      statusTone: balanceDue === 0 ? 'paid' : 'partial',
      bookingRef: ref,
      qrPayload: qr,
      company: COMPANY_INFO,
      billedTo,
      propertySummary,
      items: paidRows,
      financialSummary: {
        totalAgreedPrice: totalPrice,
        totalBilledInDoc: sumScheduled,
        totalPaidInDoc: sumReceived || totalPaid,
        documentNetAmount: sumReceived || totalPaid,
        overallTotalPaid: totalPaid,
        overallBalanceDue: balanceDue,
        overallWaivedAmount: overallWaived,
        completionPercentage: completionPct,
      },
      amountInWordsLabel: 'Cumulative Received in Words',
      amountInWordsValue: numberToBDTWords(sumReceived || totalPaid),
      remarks: [
        ...baseRemarks,
        paidRows.length === 0
          ? 'No realized payment receipts have been recorded against this booking yet.'
          : `Summarizes ${paidRows.length} cleared/partial remittance(s) confirmed by ${COMPANY_INFO.legalName}.`,
      ],
      paymentInstructions: defaultInstructions,
    };
  }

  // Comprehensive Account Statement OR Master Booking & Allotment Invoice
  const allItems = payments.map((p, idx) => buildLineItem(p, idx + 1, issueDate, audience));
  const isStatement = category === 'account-statement';
  const docNum = isStatement ? `VN-STM-${ref}` : `VN-INV-${ref}-MASTER`;
  const qr = `${COMPANY_INFO.websiteUrl} | ${docNum} | ${ref} | ${billedTo.name} | Total ${formatInvoiceMoney(totalPrice)} | Bal ${formatInvoiceMoney(balanceDue)}`;

  let statusLabel = 'ACTIVE BOOKING';
  let statusTone: InvoiceDocument['statusTone'] = 'neutral';
  if (booking.status === 'Cancelled') {
    statusLabel = 'CANCELLED';
    statusTone = 'cancelled';
  } else if (balanceDue === 0 && totalPrice > 0) {
    statusLabel = 'FULLY PAID';
    statusTone = 'paid';
  } else if (allItems.some((item) => item.isOverdue)) {
    statusLabel = 'OVERDUE ITEMS';
    statusTone = 'overdue';
  } else if (totalPaid > 0) {
    statusLabel = `${completionPct}% PAID`;
    statusTone = 'partial';
  }

  const masterScheduledFallback: InvoiceLineItem[] =
    allItems.length > 0
      ? allItems
      : [
          {
            id: 'master-unit-allocation',
            sl: 1,
            title: `${propertySummary.propertyName} — ${propertySummary.unitType}`,
            subtitle: `${propertySummary.unitNumber}${propertySummary.parking !== 'None' ? ` | Parking: ${propertySummary.parking}` : ''}`,
            dueDate: booking.createdAt || null,
            paidDate: totalPaid > 0 ? booking.updatedAt || null : null,
            paymentMode: '—',
            reference: '—',
            status: balanceDue === 0 ? 'Paid' : 'Scheduled',
            scheduledAmount: totalPrice,
            receivedAmount: totalPaid,
            netPayableOrCredit: balanceDue,
          },
        ];

  return {
    category: isStatement ? 'account-statement' : 'booking-summary',
    documentTitle: isStatement ? 'STATEMENT OF ACCOUNT' : 'BOOKING ALLOTMENT INVOICE',
    documentSubtitle: isStatement
      ? 'Full Financial Ledger, Installments & Settlement Record'
      : 'Master Contract Valuation, Down Payment & Installment Schedule',
    invoiceNumber: docNum,
    issueDate: formattedIssueDate,
    dueDate:
      allItems.find((item) => item.status === 'Scheduled' || item.status === 'Overdue' || item.status === 'Partially Paid')
        ?.dueDate
        ? formatInvoiceDate(
            allItems.find(
              (item) =>
                item.status === 'Scheduled' || item.status === 'Overdue' || item.status === 'Partially Paid'
            )?.dueDate
          )
        : null,
    statusLabel,
    statusTone,
    bookingRef: ref,
    qrPayload: qr,
    company: COMPANY_INFO,
    billedTo,
    propertySummary,
    items: isStatement ? allItems : masterScheduledFallback,
    financialSummary: {
      totalAgreedPrice: totalPrice,
      totalBilledInDoc: totalPrice,
      totalPaidInDoc: totalPaid,
      documentNetAmount: isStatement ? balanceDue : totalPrice,
      overallTotalPaid: totalPaid,
      overallBalanceDue: balanceDue,
      overallWaivedAmount: overallWaived,
      completionPercentage: completionPct,
    },
    amountInWordsLabel: isStatement ? 'Net Balance Due in Words' : 'Total Contract Value in Words',
    amountInWordsValue: numberToBDTWords(isStatement ? balanceDue : totalPrice),
    remarks: [
      ...baseRemarks,
      `Installment Plan: ${propertySummary.installmentPlan} | Booking Stage: ${propertySummary.stage} | Down Payment Committed: ${formatInvoiceMoney(booking.downPaymentAmount || 0)}.`,
      ...(booking.agreementDate ? [`Deed / Agreement Date: ${formatInvoiceDate(booking.agreementDate)}.`] : []),
      ...(booking.handoverDate ? [`Handover Date: ${formatInvoiceDate(booking.handoverDate)}.`] : []),
    ],
    paymentInstructions: defaultInstructions,
  };
}

export interface PaginateInvoiceOptions {
  singlePageBudgetPx?: number;
  firstPageBudgetPx?: number;
  middlePageBudgetPx?: number;
  lastPageBudgetPx?: number;
}

/**
 * Formats the secondary note line for an invoice table row consistently across
 * layout height estimation and sheet rendering.
 */
export function formatInvoiceLineNote(item: InvoiceLineItem): string {
  return (
    [
      item.paymentMode && item.paymentMode !== '—' ? `Mode: ${item.paymentMode}` : null,
      item.reference && item.reference !== '—' ? `Ref: ${item.reference}` : null,
      item.subtitle && !item.subtitle.startsWith('Ref:') ? item.subtitle : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'Scheduled Milestone Obligation'
  );
}

/**
 * Estimates rendered row height (px) on the 794px A4 sheet, accounting for
 * Particulars wrapping across long titles and Mode/Ref/Note subtitles.
 */
export function estimateLineItemRowHeight(item: InvoiceLineItem): number {
  const note = formatInvoiceLineNote(item);
  const titleLines = Math.max(1, Math.ceil((item.title || '').length / 32));
  const noteLines = Math.max(1, Math.ceil(note.length / 44));
  // Compact baseline row: 10px vertical padding + 1px border + 1px gap + line heights (~36px)
  return 12 + titleLines * 13 + noteLines * 11;
}

function estimateWrappedExtraLines(text: string | undefined, charsPerLine: number): number {
  if (!text || text.length <= charsPerLine) return 0;
  return Math.ceil(text.length / charsPerLine) - 1;
}

function estimateDocumentExtras(doc?: InvoiceDocument): { headerExtraPx: number; footerExtraPx: number } {
  if (!doc) return { headerExtraPx: 0, footerExtraPx: 0 };

  const partyExtraLines = Math.max(
    estimateWrappedExtraLines(doc.billedTo.address, 36) + estimateWrappedExtraLines(doc.billedTo.email, 36),
    estimateWrappedExtraLines(doc.propertySummary.propertyName, 34) +
      estimateWrappedExtraLines(doc.propertySummary.location, 36)
  );
  const headerExtraPx = partyExtraLines * 13;

  const remarkLines = doc.remarks.reduce((sum, remark) => sum + 1 + estimateWrappedExtraLines(remark, 62), 0);
  const waivedExtra = doc.financialSummary.overallWaivedAmount > 0 ? 20 : 0;
  const wordsExtra = estimateWrappedExtraLines(doc.amountInWordsValue, 48) * 13;
  const remarksExtra = Math.max(0, remarkLines - 2) * 12;
  const footerExtraPx = Math.max(waivedExtra, remarksExtra + wordsExtra);

  return { headerExtraPx, footerExtraPx };
}

/**
 * Splits invoice table line items using pixel height budgets for each A4 page role
 * so pages fill cleanly without awkward vertical gaps or Print/PDF clipping.
 */
export function paginateInvoiceItems(
  items: InvoiceLineItem[],
  docOrOptions?: InvoiceDocument | PaginateInvoiceOptions
): InvoiceLineItem[][] {
  if (items.length === 0) return [[]];

  const isDoc = Boolean(docOrOptions && 'invoiceNumber' in docOrOptions);
  const opts: PaginateInvoiceOptions = isDoc ? {} : ((docOrOptions as PaginateInvoiceOptions | undefined) ?? {});
  const { headerExtraPx, footerExtraPx } = isDoc
    ? estimateDocumentExtras(docOrOptions as InvoiceDocument)
    : { headerExtraPx: 0, footerExtraPx: 0 };

  const singleBudget = Math.max(120, (opts.singlePageBudgetPx ?? 432) - headerExtraPx - footerExtraPx);
  const firstBudget = Math.max(180, (opts.firstPageBudgetPx ?? 615) - headerExtraPx);
  const middleBudget = Math.max(240, opts.middlePageBudgetPx ?? 892);
  const lastBudget = Math.max(180, (opts.lastPageBudgetPx ?? 710) - footerExtraPx);

  const rowHeights = items.map(estimateLineItemRowHeight);
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);

  if (totalHeight <= singleBudget) {
    return [items];
  }

  const takeFittingSlice = (startIndex: number, budgetPx: number): number => {
    let used = 0;
    let count = 0;
    while (startIndex + count < items.length) {
      const nextHeight = rowHeights[startIndex + count] ?? 36;
      if (count > 0 && used + nextHeight > budgetPx) break;
      if (count === 0 && nextHeight > budgetPx) return 1;
      used += nextHeight;
      count += 1;
    }
    return count;
  };

  const sumSliceHeight = (startIndex: number): number => {
    let total = 0;
    for (let i = startIndex; i < items.length; i++) {
      total += rowHeights[i] ?? 36;
    }
    return total;
  };

  const pages: InvoiceLineItem[][] = [];
  const firstTake = takeFittingSlice(0, firstBudget);
  pages.push(items.slice(0, firstTake));

  let offset = firstTake;
  if (offset >= items.length) {
    // All line items fit on Page 1, leaving only the reconciliation & signature section for Page 2
    pages.push([]);
    return pages;
  }

  while (offset < items.length) {
    const remainingHeight = sumSliceHeight(offset);
    if (remainingHeight <= lastBudget) {
      pages.push(items.slice(offset));
      return pages;
    }
    const middleTake = takeFittingSlice(offset, middleBudget);
    pages.push(items.slice(offset, offset + middleTake));
    offset += middleTake;
  }

  pages.push([]);
  return pages;
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
