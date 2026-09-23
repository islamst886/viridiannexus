export const STAGES = [
  'EOI',
  'Token Paid',
  'Agreement Signed',
  'Down Payment Paid',
  'Installments Running',
  'Fully Paid',
  'Handover',
  'Completed'
];

/**
 * Evaluates whether a booking meets the prerequisites to transition to targetStage.
 * 
 * @param {string} targetStage - The stage to evaluate
 * @param {object} booking - The booking document
 * @param {Array} payments - The list of payment ledger items
 * @returns {object} { allowed, isRollback, requirements, summary }
 */
export function evaluateStagePrerequisites(targetStage, booking, payments = []) {
  if (!booking || !targetStage) {
    return { allowed: false, isRollback: false, requirements: [], summary: 'Missing booking or target stage.' };
  }

  const currentIndex = STAGES.indexOf(booking.stage);
  const targetIndex = STAGES.indexOf(targetStage);

  if (targetIndex === -1) {
    return { allowed: false, isRollback: false, requirements: [], summary: 'Unknown stage.' };
  }

  // Same stage
  if (currentIndex === targetIndex) {
    return {
      allowed: true,
      isRollback: false,
      requirements: [{ id: 'current', title: 'Already at this stage', met: true }],
      summary: `Booking is currently at ${targetStage}.`
    };
  }

  // Rollback to an earlier stage
  if (targetIndex < currentIndex) {
    return {
      allowed: true,
      isRollback: true,
      requirements: [{
        id: 'rollback',
        title: 'Stage Rollback Warning',
        met: true,
        details: `Reverting stage from "${booking.stage}" back to "${targetStage}". Previous milestone data will remain in the activity log.`
      }],
      summary: `Reverting stage to "${targetStage}".`
    };
  }

  // Forward transition gates
  const requirements = [];

  // Helper payment lookups
  const tokenPayment = payments.find(p => p.type === 'Token');
  const downPayment = payments.find(p => p.type === 'Down Payment');
  
  const isTokenPaid = tokenPayment 
    ? (tokenPayment.status === 'Paid' || (Number(tokenPayment.receivedAmount) || 0) >= (Number(tokenPayment.scheduledAmount) || 0))
    : (Number(booking.totalPaid) || 0) >= (Number(booking.tokenAmount) || 1);

  const isDownPaymentPaid = downPayment
    ? (downPayment.status === 'Paid' || (Number(downPayment.receivedAmount) || 0) >= (Number(downPayment.scheduledAmount) || 0))
    : (Number(booking.totalPaid) || 0) >= ((Number(booking.tokenAmount) || 0) + (Number(booking.downPaymentAmount) || 1));

  const totalBalance = Number(booking.balanceDue) !== undefined ? Number(booking.balanceDue) : (Number(booking.totalPrice) - Number(booking.totalPaid));
  const isZeroBalance = totalBalance <= 0;
  
  const unpaidPaymentsCount = payments.filter(p => p.status !== 'Paid' && p.status !== 'Waived').length;

  // Build requirements based on targetStage
  switch (targetStage) {
    case 'Token Paid': {
      requirements.push({
        id: 'token_payment',
        title: 'Token Payment Cleared',
        met: isTokenPaid,
        details: isTokenPaid 
          ? 'Token deposit has been recorded as paid in the ledger.'
          : `Token payment of ৳ ${(Number(tokenPayment?.scheduledAmount) || Number(booking.tokenAmount) || 0).toLocaleString()} is pending in the ledger.`,
        paymentIdToPay: !isTokenPaid && tokenPayment ? tokenPayment.id : null
      });
      break;
    }

    case 'Agreement Signed': {
      requirements.push({
        id: 'token_prereq',
        title: 'Token Deposit Paid',
        met: isTokenPaid,
        details: isTokenPaid
          ? 'Token deposit confirmed.'
          : 'Token payment must be paid before signing formal agreement.',
        paymentIdToPay: !isTokenPaid && tokenPayment ? tokenPayment.id : null
      });
      break;
    }

    case 'Down Payment Paid': {
      requirements.push({
        id: 'token_prereq',
        title: 'Token Deposit Paid',
        met: isTokenPaid,
        details: isTokenPaid ? 'Token deposit confirmed.' : 'Token payment must be settled.',
        paymentIdToPay: !isTokenPaid && tokenPayment ? tokenPayment.id : null
      });
      requirements.push({
        id: 'downpayment_payment',
        title: 'Down Payment Cleared in Ledger',
        met: isDownPaymentPaid,
        details: isDownPaymentPaid
          ? 'Down payment has been recorded as paid in the ledger.'
          : `Down payment of ৳ ${(Number(downPayment?.scheduledAmount) || Number(booking.downPaymentAmount) || 0).toLocaleString()} is pending in the ledger.`,
        paymentIdToPay: !isDownPaymentPaid && downPayment ? downPayment.id : null
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
        paymentIdToPay: !isDownPaymentPaid && downPayment ? downPayment.id : null
      });
      requirements.push({
        id: 'installment_schedule',
        title: 'Installment Schedule Active',
        met: payments.some(p => p.type?.startsWith('Installment')),
        details: 'Active installment schedule exists in the ledger.'
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
          : `Outstanding balance of ৳ ${Math.max(0, totalBalance).toLocaleString()} remaining.`
      });
      requirements.push({
        id: 'ledger_all_cleared',
        title: 'All Ledger Payments Settled or Waived',
        met: unpaidPaymentsCount === 0,
        details: unpaidPaymentsCount === 0
          ? 'All payment ledger entries are marked as Paid or Waived.'
          : `${unpaidPaymentsCount} payment item(s) are still pending in the ledger.`
      });
      break;
    }

    case 'Handover': {
      requirements.push({
        id: 'fully_paid_prereq',
        title: '100% Financial Clearance (Fully Paid)',
        met: isZeroBalance && unpaidPaymentsCount === 0,
        details: isZeroBalance && unpaidPaymentsCount === 0
          ? 'All dues are fully settled.'
          : `Property cannot be handed over with outstanding dues (৳ ${Math.max(0, totalBalance).toLocaleString()} remaining).`
      });
      requirements.push({
        id: 'agreement_prereq',
        title: 'Legal Agreement Executed',
        met: currentIndex >= STAGES.indexOf('Agreement Signed') || Boolean(booking.agreementDate),
        details: 'Formal sales agreement has been signed.'
      });
      break;
    }

    case 'Completed': {
      const isHandoverDone = currentIndex >= STAGES.indexOf('Handover') || Boolean(booking.handoverDate);
      requirements.push({
        id: 'handover_prereq',
        title: 'Physical Handover Completed',
        met: isHandoverDone,
        details: isHandoverDone
          ? 'Property handover executed.'
          : 'Handover must be completed before marking booking as fully closed/completed.'
      });
      requirements.push({
        id: 'fully_paid_prereq',
        title: 'Full Financial Clearance',
        met: isZeroBalance,
        details: isZeroBalance ? 'All payments cleared.' : 'Outstanding balance remains.'
      });
      break;
    }

    default:
      break;
  }

  const allMet = requirements.every(r => r.met);

  return {
    allowed: allMet,
    isRollback: false,
    requirements,
    summary: allMet 
      ? `All prerequisites for "${targetStage}" are satisfied.`
      : `Cannot advance to "${targetStage}" due to ${requirements.filter(r => !r.met).length} unmet requirement(s).`
  };
}
