import type { Booking, BookingDBRow, BookingPayment, BookingPaymentDBRow } from '../types';

export const STAGES = [
  'EOI',
  'Down Payment Paid',
  'Agreement Signed',
  'Installments Running',
  'Fully Paid',
  'Handover',
  'Completed',
] as const;

export type StageName = (typeof STAGES)[number];

export type GateBookingInput = Partial<Omit<Booking, 'notes' | 'internalNotes' | 'internal_notes'>> &
  Partial<BookingDBRow>;
export type GatePaymentInput = Partial<Omit<BookingPayment, 'notes'>> & Partial<BookingPaymentDBRow>;

export interface StageRequirement {
  id: string;
  title: string;
  met: boolean;
  details?: string;
  paymentIdToPay?: string | null;
}

export interface StageGateEvaluation {
  allowed: boolean;
  isRollback: boolean;
  requirements: StageRequirement[];
  summary: string;
}

/**
 * Evaluates whether a booking meets the prerequisites to transition to targetStage.
 */
export function evaluateStagePrerequisites(
  targetStage: string,
  booking: GateBookingInput | null | undefined,
  payments: GatePaymentInput[] = []
): StageGateEvaluation {
  if (!booking || !targetStage) {
    return {
      allowed: false,
      isRollback: false,
      requirements: [],
      summary: 'Missing booking or target stage.',
    };
  }

  const currentStage = booking.stage === 'Token Paid' ? 'EOI' : (booking.stage ?? '');
  const currentIndex = STAGES.indexOf(currentStage as StageName);
  const targetIndex = STAGES.indexOf(targetStage as StageName);

  if (targetIndex === -1) {
    return {
      allowed: false,
      isRollback: false,
      requirements: [],
      summary: 'Unknown stage.',
    };
  }

  // Same stage
  if (currentIndex === targetIndex) {
    return {
      allowed: true,
      isRollback: false,
      requirements: [{ id: 'current', title: 'Already at this stage', met: true }],
      summary: `Booking is currently at ${targetStage}.`,
    };
  }

  // Rollback to an earlier stage
  if (targetIndex < currentIndex) {
    return {
      allowed: true,
      isRollback: true,
      requirements: [
        {
          id: 'rollback',
          title: 'Stage Rollback Warning',
          met: true,
          details: `Reverting stage from "${booking.stage}" back to "${targetStage}". Previous milestone data will remain in the activity log.`,
        },
      ],
      summary: `Reverting stage to "${targetStage}".`,
    };
  }

  // Forward transition gates
  const requirements: StageRequirement[] = [];

  const downPayment = payments.find((p) => p.type === 'Down Payment');
  const dpReceived = Number(downPayment?.receivedAmount ?? downPayment?.received_amount) || 0;
  const configuredDownPayment = booking.downPaymentAmount ?? booking.down_payment_amount;
  const dpScheduled =
    Number(
      downPayment?.scheduledAmount ??
        downPayment?.scheduled_amount ??
        configuredDownPayment
    ) || 0;
  const hasExplicitZeroDownPayment =
    !downPayment &&
    configuredDownPayment !== undefined &&
    configuredDownPayment !== null &&
    Number(configuredDownPayment) === 0;
  const isDownPaymentPaid = hasExplicitZeroDownPayment
    ? true
    : downPayment
      ? downPayment.status === 'Paid' || dpReceived >= (dpScheduled || 1)
      : (Number(booking.totalPaid ?? booking.total_paid) || 0) >= (dpScheduled || 1);

  const rawBalance =
    booking.balanceDue !== undefined
      ? booking.balanceDue
      : booking.balance_due !== undefined
        ? booking.balance_due
        : Number(booking.totalPrice ?? booking.total_price ?? 0) -
          Number(booking.totalPaid ?? booking.total_paid ?? 0);
  const totalBalance = Number(rawBalance) || 0;
  const isZeroBalance = totalBalance <= 0;

  const unpaidPaymentsCount = payments.filter(
    (p) => p.status !== 'Paid' && p.status !== 'Waived'
  ).length;

  switch (targetStage) {
    case 'Down Payment Paid': {
      requirements.push({
        id: 'downpayment_payment',
        title: 'Down Payment Cleared in Ledger',
        met: isDownPaymentPaid,
        details: isDownPaymentPaid
          ? 'Down payment has been recorded as paid in the ledger.'
          : `Down payment of ৳ ${(Number(downPayment?.scheduledAmount) || Number(booking.downPaymentAmount) || 0).toLocaleString()} is pending in the ledger.`,
        paymentIdToPay: !isDownPaymentPaid && downPayment?.id ? downPayment.id : null,
      });
      break;
    }

    case 'Agreement Signed': {
      requirements.push({
        id: 'downpayment_prereq',
        title: 'Down Payment Settled',
        met: isDownPaymentPaid,
        details: isDownPaymentPaid
          ? 'Down payment confirmed.'
          : 'Down payment must be settled before signing formal agreement.',
        paymentIdToPay: !isDownPaymentPaid && downPayment?.id ? downPayment.id : null,
      });
      break;
    }

    case 'Installments Running': {
      requirements.push({
        id: 'downpayment_prereq',
        title: 'Down Payment Settled',
        met: isDownPaymentPaid,
        details: isDownPaymentPaid
          ? 'Down payment cleared.'
          : 'Down payment must be completed before tracking running installments.',
        paymentIdToPay: !isDownPaymentPaid && downPayment?.id ? downPayment.id : null,
      });
      requirements.push({
        id: 'installment_schedule',
        title: 'Installment Schedule Active',
        met: payments.some((p) => p.type?.startsWith('Installment')),
        details: 'Active installment schedule exists in the ledger.',
      });
      break;
    }

    case 'Fully Paid': {
      requirements.push({
        id: 'zero_balance',
        title: 'Zero Balance Due (100% Received)',
        met: isZeroBalance,
        details: isZeroBalance
          ? `Agreed price of ৳ ${Number(booking.totalPrice || 0).toLocaleString()} is 100% collected.`
          : `Outstanding balance of ৳ ${Math.max(0, totalBalance).toLocaleString()} remaining.`,
      });
      requirements.push({
        id: 'ledger_all_cleared',
        title: 'All Ledger Payments Settled or Waived',
        met: unpaidPaymentsCount === 0,
        details:
          unpaidPaymentsCount === 0
            ? 'All payment ledger entries are marked as Paid or Waived.'
            : `${unpaidPaymentsCount} payment item(s) are still pending in the ledger.`,
      });
      break;
    }

    case 'Handover': {
      requirements.push({
        id: 'fully_paid_prereq',
        title: '100% Financial Clearance (Fully Paid)',
        met: isZeroBalance && unpaidPaymentsCount === 0,
        details:
          isZeroBalance && unpaidPaymentsCount === 0
            ? 'All dues are fully settled.'
            : `Property cannot be handed over with outstanding dues (৳ ${Math.max(0, totalBalance).toLocaleString()} remaining).`,
      });
      requirements.push({
        id: 'agreement_prereq',
        title: 'Legal Agreement Executed',
        met:
          currentIndex >= STAGES.indexOf('Agreement Signed') ||
          Boolean(booking.agreementDate || booking.agreement_date),
        details: 'Formal sales agreement has been signed.',
      });
      break;
    }

    case 'Completed': {
      const isHandoverDone =
        currentIndex >= STAGES.indexOf('Handover') ||
        Boolean(booking.handoverDate || booking.handover_date);
      requirements.push({
        id: 'handover_prereq',
        title: 'Physical Handover Completed',
        met: isHandoverDone,
        details: isHandoverDone
          ? 'Property handover executed.'
          : 'Handover must be completed before marking booking as fully closed/completed.',
      });
      requirements.push({
        id: 'fully_paid_prereq',
        title: 'Full Financial Clearance',
        met: isZeroBalance,
        details: isZeroBalance ? 'All payments cleared.' : 'Outstanding balance remains.',
      });
      break;
    }

    default:
      break;
  }

  const allMet = requirements.every((r) => r.met);

  return {
    allowed: allMet,
    isRollback: false,
    requirements,
    summary: allMet
      ? `All prerequisites for "${targetStage}" are satisfied.`
      : `Cannot advance to "${targetStage}" due to ${requirements.filter((r) => !r.met).length} unmet requirement(s).`,
  };
}
