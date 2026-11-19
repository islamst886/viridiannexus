import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, EyeOff, FileCheck2, FileSpreadsheet, FileText, Loader2, Lock, Printer, Receipt, ShieldCheck, X } from 'lucide-react';
import { toast } from 'react-toastify';
import type { Booking, BookingPayment } from '../../types';
import {
  buildInvoiceDocument,
  classifyPaymentDocumentCategory,
  formatInvoiceMoney,
  formatPaymentLabel,
  type InvoiceCategory,
} from '../../utils/invoiceBuilder';
import {
  downloadInvoicePdf,
  generateInvoiceQrDataUrl,
  INVOICE_SHEET_STYLES,
  loadInvoiceBrochureBgDataUrl,
  loadInvoiceLogoDataUrl,
  printInvoiceElement,
} from '../../utils/invoiceExport';
import {
  getClientAuthorizedBookingCategories,
  getClientAuthorizedPayments,
  getDocumentVerificationInfo,
  isBookingDocKey,
  persistBookingInvoiceRelease,
  resolveDefaultClientDocumentSelection,
} from '../../utils/invoiceRelease';
import BrochureInvoiceSheet from './BrochureInvoiceSheet';

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  payments: BookingPayment[];
  initialCategory?: InvoiceCategory;
  initialPaymentId?: string;
  audience?: 'admin' | 'client';
  actorName?: string;
  actorId?: string | null;
  onBookingUpdated?: (updatedBooking: Booking) => void;
}

const BOOKING_LEVEL_TABS: Array<{
  category: InvoiceCategory;
  label: string;
  shortDesc: string;
}> = [
  {
    category: 'booking-summary',
    label: 'Allotment Invoice',
    shortDesc: 'Full contract valuation & milestone schedule',
  },
  {
    category: 'account-statement',
    label: 'Statement of Account',
    shortDesc: 'Complete transaction ledger & reconciliation',
  },
  {
    category: 'outstanding-bundle',
    label: 'Outstanding Invoice',
    shortDesc: 'Consolidated unpaid & overdue demand notice',
  },
  {
    category: 'receipts-summary',
    label: 'Receipts Summary',
    shortDesc: 'Summary of all cleared & partial receipts',
  },
];

const INVOICE_PREVIEW_HASH = '#invoice-preview';

export default function InvoicePreviewModal({
  isOpen,
  onClose,
  booking,
  payments,
  initialCategory = 'booking-summary',
  initialPaymentId,
  audience = 'admin',
  actorName = 'Admin',
  actorId = null,
  onBookingUpdated,
}: InvoicePreviewModalProps) {
  const isClientView = audience === 'client';
  const navigate = useNavigate();
  const location = useLocation();
  const propKey = `${booking?.id ?? ''}|${initialCategory}|${initialPaymentId ?? ''}|${isOpen ? '1' : '0'}`;
  const [selection, setSelection] = useState<{
    propKey: string;
    category: InvoiceCategory;
    paymentId: string;
  } | null>(null);
  const [logoSrc, setLogoSrc] = useState<string>('/logo.png');
  const [qrSrc, setQrSrc] = useState<string>('');
  const [printing, setPrinting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updatingRelease, setUpdatingRelease] = useState(false);
  const bgSrc = useMemo(() => (isOpen ? loadInvoiceBrochureBgDataUrl() : ''), [isOpen]);

  const exportRef = useRef<HTMLDivElement>(null);
  const prevOpenRef = useRef(false);
  const pushedHashRef = useRef(false);
  const onCloseRef = useRef(onClose);
  const locationStateRef = useRef(location.state);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    locationStateRef.current = location.state;
  }, [location.state]);

  const authorizedCategories = useMemo(
    () => (booking && isClientView ? getClientAuthorizedBookingCategories(booking) : BOOKING_LEVEL_TABS.map((t) => t.category)),
    [booking, isClientView]
  );

  const authorizedPayments = useMemo(
    () => (booking && isClientView ? getClientAuthorizedPayments(booking, payments) : payments),
    [booking, payments, isClientView]
  );

  const visibleTabs = useMemo(
    () =>
      isClientView
        ? BOOKING_LEVEL_TABS.filter((tab) => authorizedCategories.includes(tab.category))
        : BOOKING_LEVEL_TABS,
    [isClientView, authorizedCategories]
  );

  const { selectedCategory, selectedPaymentId, hasAuthorizedContent } = useMemo(() => {
    const rawCat =
      selection && selection.propKey === propKey ? selection.category : initialCategory;
    const rawPayId =
      selection && selection.propKey === propKey
        ? selection.paymentId
        : initialPaymentId || payments[0]?.id || '';

    if (!isClientView || !booking) {
      return {
        selectedCategory: rawCat,
        selectedPaymentId: rawPayId,
        hasAuthorizedContent: true,
      };
    }

    if (isBookingDocKey(rawCat)) {
      if (authorizedCategories.includes(rawCat)) {
        return {
          selectedCategory: rawCat,
          selectedPaymentId: authorizedPayments[0]?.id || '',
          hasAuthorizedContent: true,
        };
      }
    } else {
      const matched = authorizedPayments.find((p) => p.id === rawPayId);
      if (matched) {
        return {
          selectedCategory: classifyPaymentDocumentCategory(matched).category,
          selectedPaymentId: matched.id,
          hasAuthorizedContent: true,
        };
      }
    }

    const fallback = resolveDefaultClientDocumentSelection(booking, payments);
    if (!fallback) {
      return {
        selectedCategory: rawCat,
        selectedPaymentId: '',
        hasAuthorizedContent: false,
      };
    }

    return {
      selectedCategory: fallback.category,
      selectedPaymentId: fallback.paymentId || authorizedPayments[0]?.id || '',
      hasAuthorizedContent: true,
    };
  }, [
    selection,
    propKey,
    initialCategory,
    initialPaymentId,
    payments,
    isClientView,
    booking,
    authorizedCategories,
    authorizedPayments,
  ]);

  const invoiceDoc = useMemo(() => {
    if (!booking || !hasAuthorizedContent) return null;
    return buildInvoiceDocument({
      booking,
      payments,
      category: selectedCategory,
      targetPaymentId: selectedPaymentId || undefined,
      audience,
    });
  }, [booking, hasAuthorizedContent, payments, selectedCategory, selectedPaymentId, audience]);

  const currentPaymentObj = useMemo(
    () =>
      !isBookingDocKey(selectedCategory)
        ? payments.find((p) => p.id === selectedPaymentId) ?? null
        : null,
    [payments, selectedCategory, selectedPaymentId]
  );

  const verificationInfo = useMemo(
    () =>
      booking
        ? getDocumentVerificationInfo(booking, selectedCategory, currentPaymentObj)
        : { verified: false },
    [booking, selectedCategory, currentPaymentObj]
  );

  useEffect(() => {
    if (!isOpen || !invoiceDoc) return;
    let active = true;

    void loadInvoiceLogoDataUrl().then((src) => {
      if (active) setLogoSrc(src);
    });

    void generateInvoiceQrDataUrl(invoiceDoc.qrPayload).then((qr) => {
      if (active) setQrSrc(qr);
    });

    return () => {
      active = false;
    };
  }, [isOpen, invoiceDoc]);

  // Push a same-route hash entry when opening so the browser Back button closes the invoice
  // view and returns directly to the booking details page instead of leaving it.
  useEffect(() => {
    const openNow = Boolean(isOpen && booking);
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = openNow;

    if (!openNow) {
      pushedHashRef.current = false;
      return;
    }

    if (!wasOpen && window.location.hash !== INVOICE_PREVIEW_HASH) {
      pushedHashRef.current = true;
      navigate(`${window.location.pathname}${window.location.search}${INVOICE_PREVIEW_HASH}`, {
        replace: false,
        state: locationStateRef.current,
      });
    }
  }, [isOpen, booking, navigate]);

  // Listen to browser Back/Forward navigation while the invoice preview is open
  useEffect(() => {
    if (!isOpen) return;

    const handlePopState = () => {
      if (window.location.hash !== INVOICE_PREVIEW_HASH) {
        pushedHashRef.current = false;
        onCloseRef.current();
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isOpen]);

  const handleRequestClose = useCallback(() => {
    if (printing || downloading) return;
    if (pushedHashRef.current && window.location.hash === INVOICE_PREVIEW_HASH) {
      pushedHashRef.current = false;
      onCloseRef.current();
      navigate(-1);
      return;
    }
    onCloseRef.current();
    if (window.location.hash === INVOICE_PREVIEW_HASH) {
      navigate(`${window.location.pathname}${window.location.search}`, {
        replace: true,
        state: locationStateRef.current,
      });
    }
  }, [printing, downloading, navigate]);

  // Close cleanly on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleRequestClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleRequestClose]);

  const isBookingDetailRoute =
    location.pathname.startsWith('/admin/bookings/') ||
    location.pathname.startsWith('/dashboard/booking/');
  const backLabel = isBookingDetailRoute ? 'Back to Booking' : 'Back to Bookings';

  if (!isOpen || !booking) return null;

  if (isClientView && (!hasAuthorizedContent || !invoiceDoc)) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white rounded-2xl max-w-md w-full p-8 text-center shadow-2xl border border-gray-200">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
            <Lock size={26} />
          </div>
          <h3 className="text-xl font-serif font-bold text-gray-900 mb-2">
            No Verified Invoices Available Yet
          </h3>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Only official invoices, statements, and receipts that have been verified and issued by Viridian Nexus Finance appear here for download.
          </p>
          <button
            type="button"
            onClick={handleRequestClose}
            className="w-full py-2.5 bg-brand-dark text-white font-bold rounded-lg hover:bg-brand-primary transition-colors text-sm"
          >
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  if (!invoiceDoc) return null;

  const isIndividualSelected =
    selectedCategory === 'payment-receipt' ||
    selectedCategory === 'demand-invoice' ||
    selectedCategory === 'credit-note';

  const handleSelectIndividualPayment = (paymentId: string) => {
    const found = authorizedPayments.find((p) => p.id === paymentId);
    const nextCategory = found
      ? classifyPaymentDocumentCategory(found).category
      : selectedCategory;
    setSelection({ propKey, category: nextCategory, paymentId });
  };

  const handleToggleReleaseStatus = async () => {
    if (isClientView || !booking) return;
    if (!isBookingDocKey(selectedCategory) && !currentPaymentObj) return;

    const nextStatus = verificationInfo.verified ? 'withheld' : 'issued';
    setUpdatingRelease(true);
    try {
      const updated = await persistBookingInvoiceRelease({
        booking,
        target: isBookingDocKey(selectedCategory)
          ? { kind: 'booking-doc', category: selectedCategory }
          : { kind: 'payment-doc', payment: currentPaymentObj! },
        nextStatus,
        actorName,
        actorId,
      });
      onBookingUpdated?.(updated);
      toast.success(
        nextStatus === 'issued'
          ? `${invoiceDoc.documentTitle} verified & issued to Client Dashboard`
          : `${invoiceDoc.documentTitle} withdrawn from Client Dashboard`
      );
    } catch (err) {
      console.error('Failed to update invoice release status:', err);
      toast.error('Failed to update client invoice visibility');
    } finally {
      setUpdatingRelease(false);
    }
  };

  const handlePrint = async () => {
    if (!exportRef.current) return;
    setPrinting(true);
    try {
      await printInvoiceElement(exportRef.current, `${invoiceDoc.invoiceNumber} — ${invoiceDoc.documentTitle}`);
    } catch (err) {
      console.error('Print failed:', err);
      toast.error('Unable to open print dialog. Please try downloading the PDF instead.');
    } finally {
      setPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!exportRef.current) return;
    setDownloading(true);
    try {
      await downloadInvoicePdf(exportRef.current, invoiceDoc.invoiceNumber);
      toast.success(`Downloaded ${invoiceDoc.invoiceNumber}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast.error('Failed to generate PDF file. Please try the Print option as fallback.');
    } finally {
      setDownloading(false);
    }
  };

  const totalAuthorizedChoices =
    visibleTabs.length + (authorizedPayments.length > 0 ? 1 : 0);
  const showClientSwitcherStrip = !isClientView || totalAuthorizedChoices > 1 || authorizedPayments.length > 1;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vn-invoice-modal-title"
    >
      <style>{INVOICE_SHEET_STYLES}</style>

      {/* Top Interactive Toolbar */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3.5 shadow-sm shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Back Button + Title & Meta */}
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleRequestClose}
                disabled={printing || downloading}
                className="px-3.5 py-2 border border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-xs sm:text-sm rounded-lg inline-flex items-center gap-1.5 shadow-sm transition-colors shrink-0 disabled:opacity-50"
              >
                <ArrowLeft size={16} />
                <span>{backLabel}</span>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText size={19} className="text-brand-primary shrink-0 hidden sm:block" />
                  <h2
                    id="vn-invoice-modal-title"
                    className="text-base sm:text-lg font-serif font-bold text-gray-900 truncate"
                  >
                    {isClientView ? 'Verified Invoice & Statement View' : 'Official Invoice & Document Center'}
                  </h2>
                  <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-brand-primary border border-emerald-200 rounded-md shrink-0">
                    #{invoiceDoc.bookingRef}
                  </span>
                  {isClientView && (
                    <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-md shrink-0">
                      <ShieldCheck size={12} /> Verified · Read-Only
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {invoiceDoc.documentTitle} · {invoiceDoc.invoiceNumber} · {booking.clientName}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleRequestClose}
              disabled={printing || downloading}
              aria-label="Close invoice preview"
              className="lg:hidden p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg shrink-0 disabled:opacity-50"
            >
              <X size={22} />
            </button>
          </div>

          {/* Primary Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {!isClientView && (isBookingDocKey(selectedCategory) || Boolean(currentPaymentObj)) && (
              <button
                type="button"
                onClick={() => void handleToggleReleaseStatus()}
                disabled={updatingRelease || printing || downloading}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold border inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 ${
                  verificationInfo.verified
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200'
                }`}
                title={
                  verificationInfo.verified
                    ? 'Currently visible on Client Dashboard — click to withdraw'
                    : 'Verify & issue this document so it appears on the Client Dashboard'
                }
              >
                {updatingRelease ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : verificationInfo.verified ? (
                  <EyeOff size={14} />
                ) : (
                  <ShieldCheck size={14} />
                )}
                {verificationInfo.verified ? 'Issued to Client (Withdraw)' : 'Verify & Issue to Client'}
              </button>
            )}

            <button
              type="button"
              onClick={() => void handlePrint()}
              disabled={printing || downloading}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 font-bold text-xs sm:text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {printing ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Print Invoice
            </button>

            <button
              type="button"
              onClick={() => void handleDownloadPdf()}
              disabled={downloading || printing}
              className="px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white font-bold text-xs sm:text-sm rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
            >
              {downloading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Download size={16} />
              )}
              {downloading ? 'Generating PDF...' : 'Download PDF'}
            </button>

            <button
              type="button"
              onClick={handleRequestClose}
              disabled={printing || downloading}
              aria-label="Close invoice preview"
              className="hidden lg:flex p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Document Type Switcher Strip */}
        {showClientSwitcherStrip && (
          <div className="max-w-7xl mx-auto mt-3 pt-3 border-t border-gray-100 flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
            {/* Booking-wide Document Types */}
            {visibleTabs.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {visibleTabs.map((tab) => {
                  const active = selectedCategory === tab.category;
                  return (
                    <button
                      key={tab.category}
                      type="button"
                      onClick={() =>
                        setSelection({
                          propKey,
                          category: tab.category,
                          paymentId: selectedPaymentId,
                        })
                      }
                      title={tab.shortDesc}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        active
                          ? 'bg-brand-dark text-brand-accent shadow-sm'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tab.category === 'booking-summary' && <FileSpreadsheet size={13} />}
                      {tab.category === 'account-statement' && <FileText size={13} />}
                      {tab.category === 'outstanding-bundle' && <Receipt size={13} />}
                      {tab.category === 'receipts-summary' && <FileCheck2 size={13} />}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Individual Ledger Item Selector */}
            {authorizedPayments.length > 0 && (
              <div className="flex items-center gap-2">
                <label
                  htmlFor="vn-individual-invoice-select"
                  className="text-xs font-bold text-gray-500 whitespace-nowrap"
                >
                  {isClientView ? 'Verified Invoice / Receipt:' : 'Item Invoice / Receipt:'}
                </label>
                <select
                  id="vn-individual-invoice-select"
                  value={isIndividualSelected ? selectedPaymentId : ''}
                  onChange={(e) => {
                    if (e.target.value) handleSelectIndividualPayment(e.target.value);
                  }}
                  className={`text-xs font-semibold rounded-lg border px-2.5 py-1.5 max-w-xs sm:max-w-sm outline-none focus:ring-2 focus:ring-brand-primary/40 ${
                    isIndividualSelected
                      ? 'border-brand-primary bg-emerald-50 text-brand-dark'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  <option value="">
                    {isClientView
                      ? '— Select Verified Receipt / Issued Invoice —'
                      : '— Select Specific Installment / Add-on / Credit —'}
                  </option>
                  {authorizedPayments.map((p) => {
                    const { actionLabel } = classifyPaymentDocumentCategory(p);
                    return (
                      <option key={p.id} value={p.id}>
                        {formatPaymentLabel(p)} ({formatInvoiceMoney(p.scheduledAmount)}) — {p.status}{' '}
                        [{actionLabel}]
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scrollable Interactive A4 Preview Area */}
      <div className="flex-1 overflow-auto bg-gray-900/90 py-6 px-3 sm:px-6 flex justify-center items-start">
        <div className="w-full flex justify-center overflow-x-auto pb-8">
          <BrochureInvoiceSheet doc={invoiceDoc} logoSrc={logoSrc} qrSrc={qrSrc} bgSrc={bgSrc} />
        </div>
      </div>

      {/* Unscaled Fixed-A4 Offscreen Mount for Crisp 1:1 Print & PDF Capture */}
      <div
        ref={exportRef}
        data-vn-export-host="1"
        aria-hidden="true"
        style={{
          position: 'fixed',
          left: '-99999px',
          top: 0,
          width: '794px',
          pointerEvents: 'none',
        }}
      >
        <BrochureInvoiceSheet doc={invoiceDoc} logoSrc={logoSrc} qrSrc={qrSrc} bgSrc={bgSrc} />
      </div>
    </div>
  );
}
