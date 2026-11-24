import {
  formatInvoiceDate,
  formatInvoiceLineNote,
  formatInvoiceMoney,
  paginateInvoiceItems,
  type InvoiceDocument,
  type InvoiceLineItem,
} from '../../utils/invoiceBuilder';

interface BrochureInvoiceSheetProps {
  doc: InvoiceDocument;
  logoSrc: string;
  qrSrc: string;
  bgSrc?: string;
}

const STATUS_PILL_CLASSES: Record<string, string> = {
  Paid: 'vn-tone-paid',
  'Partially Paid': 'vn-tone-partial',
  'Partial (Closed)': 'vn-tone-partial',
  Overdue: 'vn-tone-overdue',
  Waived: 'vn-tone-neutral',
  Scheduled: 'vn-tone-due',
  Voided: 'vn-tone-voided',
  Deducted: 'vn-tone-cancelled',
  Closed: 'vn-tone-neutral',
  'Refund Pending': 'vn-tone-partial',
  'Partially Refunded': 'vn-tone-refund',
  Refunded: 'vn-tone-paid',
};

function getLineStatusClass(item: InvoiceLineItem): string {
  if (item.isVoided) return 'vn-tone-voided';
  if (item.isCredit) return 'vn-tone-credit';
  if (item.isFee) return 'vn-tone-cancelled';
  return STATUS_PILL_CLASSES[item.status] || 'vn-tone-neutral';
}

function getSummaryTotalLabel(doc: InvoiceDocument): string {
  switch (doc.category) {
    case 'payment-receipt':
    case 'receipts-summary':
      return 'Total Amount Acknowledged';
    case 'credit-note':
      return 'Net Amount Credited / Adjusted';
    case 'cancellation-settlement':
      if (doc.cancellationSummary && doc.cancellationSummary.refundRemaining > 0) {
        return 'Net Refund Remaining';
      }
      if (doc.cancellationSummary && doc.cancellationSummary.refundDisbursed > 0) {
        return 'Total Refund Disbursed';
      }
      return 'Net Closing Balance';
    case 'refund-voucher':
      return doc.financialSummary.totalPaidInDoc > 0
        ? 'Refund Disbursed in Voucher'
        : 'Net Refund Payable';
    case 'demand-invoice':
    case 'outstanding-bundle':
      return 'Net Amount Payable Now';
    case 'booking-summary':
      return 'Total Contract Value';
    case 'account-statement':
    default:
      return 'Net Outstanding Balance';
  }
}

function getSummaryTotalAmount(doc: InvoiceDocument): number {
  switch (doc.category) {
    case 'payment-receipt':
    case 'receipts-summary':
      return doc.financialSummary.totalPaidInDoc;
    case 'credit-note':
    case 'cancellation-settlement':
    case 'refund-voucher':
      return doc.financialSummary.documentNetAmount;
    case 'demand-invoice':
    case 'outstanding-bundle':
      return doc.financialSummary.documentNetAmount;
    case 'booking-summary':
      return doc.financialSummary.totalAgreedPrice;
    case 'account-statement':
    default:
      return doc.financialSummary.overallBalanceDue;
  }
}

export default function BrochureInvoiceSheet({
  doc,
  logoSrc,
  qrSrc,
  bgSrc = '',
}: BrochureInvoiceSheetProps) {
  const pages = paginateInvoiceItems(doc.items, doc);
  const totalPages = pages.length;

  return (
    <div className="vn-invoice-pages-root">
      {pages.map((pageItems, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === totalPages - 1;
        const isSummaryOnlyFinalPage = pageItems.length === 0 && doc.items.length > 0;

        return (
          <section
            key={`page-${pageIndex}`}
            className="vn-invoice-page"
            aria-label={`${doc.documentTitle} page ${pageIndex + 1} of ${totalPages}`}
          >
            {bgSrc && <img src={bgSrc} alt="" aria-hidden="true" className="vn-inv-bg-img" />}
            {doc.watermarkText && (
              <div className="vn-inv-watermark" aria-hidden="true">
                {doc.watermarkText}
              </div>
            )}
            <div className="vn-inv-body">
              {isFirstPage ? (
                <>
                  {/* Top Enlistment Strip matching brochure theme */}
                  <div className="vn-inv-enlist-bar">
                    <div className="vn-split-badge" aria-label={doc.company.enlistments.rajuk}>
                      <span className="vn-split-badge-left">RAJUK</span>
                      <span className="vn-split-badge-right">ENLISTED</span>
                    </div>
                    <span className="vn-inv-compliance-pill">
                      {doc.company.enlistments.bangladeshArmy}
                    </span>
                    <div className="vn-split-badge" aria-label={doc.company.enlistments.canttBoard}>
                      <span className="vn-split-badge-left">CANTT. BOARD</span>
                      <span className="vn-split-badge-right">ENLISTED</span>
                    </div>
                  </div>

                  {/* Brand & Document Masthead */}
                  <div className="vn-inv-masthead">
                    <div className="vn-inv-brand-col">
                      <div className="vn-inv-logo-box">
                        <img
                          src={logoSrc || '/logo.png'}
                          alt={doc.company.legalName}
                          className="vn-inv-logo-img"
                        />
                      </div>
                      <div>
                        <h1 className="vn-inv-company-title">Viridian Nexus</h1>
                        <div className="vn-inv-company-sub">Development Ltd.</div>
                        <div className="vn-inv-motto">&ldquo;{doc.company.motto}&rdquo;</div>
                      </div>
                    </div>

                    <div className="vn-inv-doc-meta-col">
                      <h2 className="vn-inv-doc-title">{doc.documentTitle}</h2>
                      <div className="vn-inv-doc-subtitle">{doc.documentSubtitle}</div>
                      <span className={`vn-inv-status-badge vn-tone-${doc.statusTone}`}>
                        {doc.statusLabel}
                      </span>
                    </div>
                  </div>

                  {/* Brochure Signature Double Rule */}
                  <div className="vn-double-rule" />

                  {/* Corporate Contact Directory + Verification QR & Metadata */}
                  <div className="vn-inv-dir-grid">
                    <table className="vn-inv-contact-table">
                      <tbody>
                        <tr>
                          <td className="vn-inv-contact-label">Corporate Office</td>
                          <td>: {doc.company.corporateOffice.singleLine}</td>
                        </tr>
                        <tr>
                          <td className="vn-inv-contact-label">E-mail</td>
                          <td>: {doc.company.email}</td>
                        </tr>
                        <tr>
                          <td className="vn-inv-contact-label">Website</td>
                          <td>: {doc.company.websiteDisplay}</td>
                        </tr>
                        <tr>
                          <td className="vn-inv-contact-label">Phone</td>
                          <td>
                            : {doc.company.phones.landline}, {doc.company.phones.mobile}
                          </td>
                        </tr>
                      </tbody>
                    </table>

                    <div className="vn-inv-meta-right">
                      <div className="vn-inv-meta-kv">
                        <div>
                          Invoice No: <strong>{doc.invoiceNumber}</strong>
                        </div>
                        <div>
                          Booking Ref: <strong>#{doc.bookingRef}</strong>
                        </div>
                        <div>
                          Issue Date: <strong>{doc.issueDate}</strong>
                        </div>
                        {doc.dueDate && (
                          <div>
                            Due Date: <strong>{doc.dueDate}</strong>
                          </div>
                        )}
                        {doc.verificationCode && (
                          <div>
                            Verify Code: <strong>{doc.verificationCode}</strong>
                          </div>
                        )}
                      </div>

                      {qrSrc && (
                        <div className="vn-inv-qr-box">
                          <img src={qrSrc} alt="Verify Document QR" className="vn-inv-qr-img" />
                          <div className="vn-inv-qr-caption">Verify Doc</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Billed To & Property Allocation Grid */}
                  <div className="vn-inv-party-grid">
                    <div className="vn-inv-party-card">
                      <div className="vn-inv-party-heading">Billed To / Allottee</div>
                      <div className="vn-inv-party-name">{doc.billedTo.name}</div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Client ID:</span>
                        <span>{doc.billedTo.clientCode}</span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Phone:</span>
                        <span>{doc.billedTo.phone}</span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">E-mail:</span>
                        <span>{doc.billedTo.email}</span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">NID / Pass:</span>
                        <span>{doc.billedTo.nid}</span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Address:</span>
                        <span>{doc.billedTo.address}</span>
                      </div>
                    </div>

                    <div className="vn-inv-party-card vn-party-accent">
                      <div className="vn-inv-party-heading">
                        {doc.propertySummary.bookingStatus === 'Cancelled'
                          ? 'Property & Unit Allocation (Released)'
                          : 'Property & Unit Allocation'}
                      </div>
                      <div className="vn-inv-party-name">{doc.propertySummary.propertyName}</div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Location:</span>
                        <span>{doc.propertySummary.location}</span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Unit Details:</span>
                        <span>
                          {doc.propertySummary.unitType}
                          {doc.propertySummary.unitNumber !== 'TBD'
                            ? ` (${doc.propertySummary.unitNumber})`
                            : ''}
                        </span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Parking:</span>
                        <span>{doc.propertySummary.parking}</span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Stage / Plan:</span>
                        <span>
                          {doc.propertySummary.stage} · {doc.propertySummary.installmentPlan}
                        </span>
                      </div>
                      <div className="vn-inv-party-row">
                        <span className="vn-inv-party-key">Booked On:</span>
                        <span>{doc.propertySummary.bookingCreatedAt}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="vn-inv-cont-header">
                  <div className="vn-inv-cont-brand">
                    <img
                      src={logoSrc || '/logo.png'}
                      alt={doc.company.legalName}
                      className="vn-inv-cont-logo"
                    />
                    <div>
                      <div className="vn-inv-cont-title">
                        {doc.company.legalName} — {doc.documentTitle}
                      </div>
                      <div className="vn-inv-cont-sub">
                        Allottee: {doc.billedTo.name} · {doc.propertySummary.propertyName}
                      </div>
                    </div>
                  </div>
                  <div className="vn-inv-cont-right">
                    <div>
                      <strong>{doc.invoiceNumber}</strong>
                    </div>
                    <div>
                      Booking Ref: #{doc.bookingRef} · Issued {doc.issueDate}
                    </div>
                  </div>
                </div>
              )}

              {/* Financial Line Items Table (or Summary-only Continuation Banner) */}
              {isSummaryOnlyFinalPage ? (
                <div className="vn-inv-reconcile-banner">
                  <div>
                    <strong>
                      Ledger Schedule Reconciled on Preceding Page{totalPages > 2 ? 's' : ''}
                    </strong>
                    <span>
                      {' '}
                      — All {doc.items.length} itemized financial obligations and receipts appear on Page
                      {totalPages > 2 ? `s 1–${totalPages - 1}` : ' 1'}.
                    </span>
                  </div>
                  <span className="vn-inv-reconcile-tag">Final Reconciliation &amp; Authorization</span>
                </div>
              ) : (
                <div className="vn-inv-table-wrap">
                  <table className="vn-inv-table">
                    <thead>
                      <tr>
                        <th style={{ width: '32px' }}>SL</th>
                        <th>Particulars &amp; Payment Description</th>
                        <th style={{ width: '88px' }} className="vn-nowrap">
                          Due Date
                        </th>
                        <th style={{ width: '88px' }} className="vn-nowrap">
                          Paid Date
                        </th>
                        <th style={{ width: '80px' }} className="vn-center">
                          Status
                        </th>
                        <th style={{ width: '92px' }} className="vn-num">
                          Scheduled
                        </th>
                        <th style={{ width: '92px' }} className="vn-num">
                          Received
                        </th>
                        <th style={{ width: '96px' }} className="vn-num">
                          Net Due / Credit
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageItems.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            style={{
                              textAlign: 'center',
                              padding: '22px 14px',
                              color: '#64748b',
                              fontWeight: 600,
                            }}
                          >
                            {doc.category === 'outstanding-bundle'
                              ? 'All scheduled financial obligations for this booking are settled in full.'
                              : 'No matching payment ledger transactions found for this statement view.'}
                          </td>
                        </tr>
                      ) : (
                        pageItems.map((item) => {
                          const netLabel = item.isVoided
                            ? 'Voided'
                            : item.isFee
                              ? formatInvoiceMoney(item.scheduledAmount)
                              : item.isRefund
                                ? item.netPayableOrCredit > 0
                                  ? formatInvoiceMoney(item.netPayableOrCredit)
                                  : 'Settled'
                                : item.isCredit
                                  ? `${formatInvoiceMoney(item.netPayableOrCredit, false)} Cr.`
                                  : item.isWaived || item.status === 'Paid' || item.status === 'Partial (Closed)' || item.status === 'Closed'
                                    ? '৳ 0'
                                    : formatInvoiceMoney(item.netPayableOrCredit);

                          return (
                            <tr key={item.id}>
                              <td>{String(item.sl).padStart(2, '0')}</td>
                              <td>
                                <div className="vn-row-title">{item.title}</div>
                                <div className="vn-row-note">{formatInvoiceLineNote(item)}</div>
                              </td>
                              <td className="vn-nowrap">
                                {item.dueDate ? formatInvoiceDate(item.dueDate) : '—'}
                              </td>
                              <td className="vn-nowrap">
                                {item.paidDate ? formatInvoiceDate(item.paidDate) : '—'}
                              </td>
                              <td className="vn-center">
                                <span className={`vn-pill-mini ${getLineStatusClass(item)}`}>
                                  {item.isCredit ? 'Credit' : item.status}
                                </span>
                              </td>
                              <td className="vn-num">{formatInvoiceMoney(item.scheduledAmount)}</td>
                              <td
                                className="vn-num"
                                style={{
                                  fontWeight: item.receivedAmount > 0 ? 700 : 400,
                                  color:
                                    item.receivedAmount < 0
                                      ? '#6b21a8'
                                      : item.receivedAmount > 0
                                        ? '#166534'
                                        : '#64748b',
                                }}
                              >
                                {item.receivedAmount !== 0
                                  ? formatInvoiceMoney(item.receivedAmount)
                                  : '—'}
                              </td>
                              <td
                                className="vn-num"
                                style={{
                                  fontWeight: 700,
                                  color: item.isCredit
                                    ? '#6b21a8'
                                    : item.isOverdue
                                      ? '#991b1b'
                                      : '#0f172a',
                                }}
                              >
                                {netLabel}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {isLastPage ? (
                <>
                  {/* Financial Reconciliation + Words + Instructions */}
                  <div
                    className={`vn-inv-summary-grid${isSummaryOnlyFinalPage ? ' vn-inv-summary-grid--flush' : ''}`}
                  >
                    <div>
                      <div className="vn-inv-words-box">
                        <div className="vn-inv-words-label">{doc.amountInWordsLabel}</div>
                        <div className="vn-inv-words-value">{doc.amountInWordsValue}</div>
                      </div>

                      <div className="vn-inv-notes-box">
                        <div className="vn-inv-notes-title">
                          Terms, Remarks &amp; Remittance Instructions
                        </div>
                        <ul className="vn-inv-notes-list">
                          {doc.remarks.map((remark, idx) => (
                            <li key={`rmk-${idx}`}>{remark}</li>
                          ))}
                          {doc.paymentInstructions.slice(0, 2).map((instr, idx) => (
                            <li key={`inst-${idx}`}>{instr}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="vn-inv-totals-card">
                      {doc.cancellationSummary &&
                      (doc.category === 'cancellation-settlement' ||
                        doc.category === 'refund-voucher') ? (
                        <div className="vn-inv-totals-rows">
                          <div className="vn-inv-total-line">
                            <span>Gross Client Payments Collected</span>
                            <strong style={{ color: '#166534' }}>
                              {formatInvoiceMoney(doc.cancellationSummary.grossCollected)}
                            </strong>
                          </div>
                          {doc.cancellationSummary.cancellationFee > 0 && (
                            <div className="vn-inv-total-line">
                              <span>Less: Cancellation Fee / Deduction</span>
                              <strong style={{ color: '#991b1b' }}>
                                -{formatInvoiceMoney(doc.cancellationSummary.cancellationFee)}
                              </strong>
                            </div>
                          )}
                          <div className="vn-inv-total-line">
                            <span>Net Refundable Amount</span>
                            <strong>
                              {formatInvoiceMoney(doc.cancellationSummary.netRefundable)}
                            </strong>
                          </div>
                          <div className="vn-inv-total-line">
                            <span>Refund Disbursed to Date</span>
                            <strong style={{ color: '#155e75' }}>
                              {formatInvoiceMoney(doc.cancellationSummary.refundDisbursed)}
                            </strong>
                          </div>
                        </div>
                      ) : (
                        <div className="vn-inv-totals-rows">
                          <div className="vn-inv-total-line">
                            <span>Agreed Contract Value</span>
                            <strong>{formatInvoiceMoney(doc.financialSummary.totalAgreedPrice)}</strong>
                          </div>
                          <div className="vn-inv-total-line">
                            <span>Cumulative Received ({doc.financialSummary.completionPercentage}%)</span>
                            <strong style={{ color: '#166534' }}>
                              {formatInvoiceMoney(doc.financialSummary.overallTotalPaid)}
                            </strong>
                          </div>
                          {doc.financialSummary.overallWaivedAmount > 0 && (
                            <div className="vn-inv-total-line">
                              <span>Total Waived Adjustments</span>
                              <strong>
                                {formatInvoiceMoney(doc.financialSummary.overallWaivedAmount)}
                              </strong>
                            </div>
                          )}
                          <div className="vn-inv-total-line">
                            <span>Overall Contract Balance Due</span>
                            <strong
                              style={{
                                color:
                                  doc.financialSummary.overallBalanceDue > 0 ? '#991b1b' : '#166534',
                              }}
                            >
                              {formatInvoiceMoney(doc.financialSummary.overallBalanceDue)}
                            </strong>
                          </div>
                        </div>
                      )}

                      <div className="vn-inv-grand-total">
                        <span>{getSummaryTotalLabel(doc)}</span>
                        <span>{formatInvoiceMoney(getSummaryTotalAmount(doc))}</span>
                      </div>
                    </div>
                  </div>

                  {/* Authorised Signatories */}
                  <div className="vn-inv-sign-grid">
                    <div className="vn-inv-sign-col">
                      <div className="vn-inv-sign-line">Prepared By</div>
                      <div>Finance &amp; Billing Desk</div>
                    </div>
                    <div className="vn-inv-sign-col">
                      <div className="vn-inv-sign-line">Authorised Signatory</div>
                      <div>{doc.company.legalName}</div>
                    </div>
                    <div className="vn-inv-sign-col">
                      <div className="vn-inv-sign-line">Allottee Acknowledgment</div>
                      <div>{doc.billedTo.name}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    marginTop: 'auto',
                    textAlign: 'right',
                    fontSize: '9.5px',
                    fontWeight: 600,
                    color: '#475569',
                    paddingBottom: '6px',
                  }}
                >
                  Continued on Page {pageIndex + 2} of {totalPages} →
                </div>
              )}
            </div>

            {/* Brochure Publication Footer */}
            <div className="vn-inv-footer-wrap">
              <div className="vn-inv-disclaimer-block">
                <div className="vn-inv-disclaimer-text">
                  All schedules and renderings remain subject to formal allotment agreements; the
                  authority reserves the right to modify terms &amp; conditions as per necessity.
                  This is an official publication of <strong>{doc.company.legalName}</strong>
                </div>
                <div className="vn-inv-rights-text">
                  All rights reserved to © viridiannexusdevelopmentltd.
                </div>
              </div>
              <div className="vn-inv-grey-bar" />
              <div className="vn-inv-bottom-strip">
                <span className="vn-inv-page-tag">
                  {doc.invoiceNumber} · Page {pageIndex + 1} of {totalPages}
                </span>
                <span className="vn-inv-bottom-wordmark">VIRIDIAN NEXUS LTD.</span>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
