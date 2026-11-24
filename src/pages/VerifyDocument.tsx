import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  FileSearch,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { COMPANY_INFO } from '../data/companyInfo';
import { supabase } from '../supabase';
import type { DocumentVerificationResponse } from '../utils/documentVerification';

function formatMoney(amount: number | undefined): string {
  if (amount === undefined || !Number.isFinite(amount)) return '—';
  return '৳ ' + Math.round(amount).toLocaleString('en-IN');
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function VerifyDocument() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlRef = (searchParams.get('ref') || '').trim();
  const urlDoc = (searchParams.get('doc') || '').trim();
  const urlCode = (searchParams.get('code') || '').trim();

  const handleLookupSubmit = (nextRef: string, nextDoc: string, nextCode: string) => {
    const next = new URLSearchParams();
    if (nextRef.trim()) next.set('ref', nextRef.trim());
    if (nextDoc.trim()) next.set('doc', nextDoc.trim());
    if (nextCode.trim()) next.set('code', nextCode.trim());
    setSearchParams(next);
  };

  return (
    <VerifyDocumentInner
      key={`${urlRef}|${urlDoc}|${urlCode}`}
      urlRef={urlRef}
      urlDoc={urlDoc}
      urlCode={urlCode}
      onLookupSubmit={handleLookupSubmit}
    />
  );
}

function VerifyDocumentInner({
  urlRef,
  urlDoc,
  urlCode,
  onLookupSubmit,
}: {
  urlRef: string;
  urlDoc: string;
  urlCode: string;
  onLookupSubmit: (nextRef: string, nextDoc: string, nextCode: string) => void;
}) {
  const navigate = useNavigate();
  const hasQuery = Boolean(urlRef && urlDoc);

  const [refInput, setRefInput] = useState(urlRef);
  const [docInput, setDocInput] = useState(urlDoc);
  const [codeInput, setCodeInput] = useState(urlCode);
  const [loading, setLoading] = useState(hasQuery);
  const [result, setResult] = useState<DocumentVerificationResponse | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasQuery) return;
    let cancelled = false;

    const verify = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;

        const query = new URLSearchParams({
          ref: urlRef,
          doc: urlDoc,
          ...(urlCode ? { code: urlCode } : {}),
        });
        const response = await fetch(`/api/verifyDocument?${query.toString()}`, {
          method: 'GET',
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        });
        const payload = (await response.json().catch(() => null)) as
          | DocumentVerificationResponse
          | null;

        if (cancelled) return;
        if (!payload || typeof payload.verdict !== 'string') {
          setFetchError('Unable to verify document at this time. Please try again later.');
        } else {
          setResult(payload);
        }
      } catch {
        if (!cancelled) {
          setFetchError('Network error while contacting the Viridian Nexus verification desk.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void verify();
    return () => {
      cancelled = true;
    };
  }, [hasQuery, urlRef, urlDoc, urlCode]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!refInput.trim() || !docInput.trim()) return;
    onLookupSubmit(refInput, docInput, codeInput);
  };

  const renderVerdictVisual = () => {
    if (!result) return null;

    let wrapperClass = 'border-gray-200 bg-white';
    let badgeClass = 'bg-gray-100 text-gray-800 border-gray-200';
    let icon = <ShieldAlert size={28} className="text-gray-600" />;
    let badgeText = 'Verification Result';

    switch (result.verdict) {
      case 'VERIFIED':
        wrapperClass = 'border-emerald-200 bg-emerald-50/50';
        badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
        icon = <CheckCircle2 size={30} className="text-emerald-600" />;
        badgeText = 'Authentic · Verified';
        break;
      case 'VERIFIED_HISTORICAL_CANCELLED':
        wrapperClass = 'border-amber-200 bg-amber-50/50';
        badgeClass = 'bg-amber-100 text-amber-900 border-amber-200';
        icon = <AlertTriangle size={30} className="text-amber-600" />;
        badgeText = 'Historical Receipt · Booking Cancelled';
        break;
      case 'UNISSUED_DRAFT':
        wrapperClass = 'border-amber-200 bg-amber-50/40';
        badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
        icon = <Clock size={30} className="text-amber-600" />;
        badgeText = 'Unissued Draft';
        break;
      case 'REVOKED':
        wrapperClass = 'border-red-200 bg-red-50/50';
        badgeClass = 'bg-red-100 text-red-800 border-red-200';
        icon = <XCircle size={30} className="text-red-600" />;
        badgeText = 'Revoked / Invalid';
        break;
      case 'INVALID_CODE':
      case 'NOT_FOUND':
        wrapperClass = 'border-red-200 bg-red-50/50';
        badgeClass = 'bg-red-100 text-red-800 border-red-200';
        icon = <ShieldAlert size={30} className="text-red-600" />;
        badgeText = result.verdict === 'INVALID_CODE' ? 'Security Code Mismatch' : 'Not Found';
        break;
    }

    const doc = result.document;

    return (
      <div className={`rounded-2xl border p-6 sm:p-8 shadow-sm ${wrapperClass} space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-2xl bg-white border border-gray-200 shadow-xs shrink-0">
              {icon}
            </div>
            <div>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border mb-2 ${badgeClass}`}
              >
                {badgeText}
              </span>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-gray-900">
                {result.headline}
              </h2>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed">{result.message}</p>
            </div>
          </div>

          {result.adminBookingId && (
            <button
              type="button"
              onClick={() => void navigate(`/admin/bookings/${result.adminBookingId}`)}
              className="px-4 py-2.5 rounded-xl bg-brand-dark text-brand-accent hover:bg-brand-primary hover:text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors shadow-sm"
            >
              Open in Admin Ledger <ArrowRight size={14} />
            </button>
          )}
        </div>

        {doc && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Document Type
              </span>
              <span className="font-bold text-gray-900">{doc.documentTitle}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Invoice / Reference No.
              </span>
              <span className="font-mono font-bold text-brand-dark">{doc.invoiceNumber}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Booking Reference
              </span>
              <span className="font-bold text-gray-900">#{doc.bookingRef}</span>
            </div>

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Allottee (Masked)
              </span>
              <span className="font-semibold text-gray-900">{doc.clientNameMasked}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Property &amp; Allocation
              </span>
              <span className="font-semibold text-gray-900 block">{doc.propertyName}</span>
              <span className="text-xs text-gray-500">{doc.unitSummary}</span>
            </div>
            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Live Booking Status
              </span>
              <span className="font-bold text-gray-900">
                {doc.bookingStatus} · {doc.bookingStage}
              </span>
              {doc.refundStatusLabel && (
                <span className="block text-xs text-cyan-800 font-semibold mt-0.5">
                  {doc.refundStatusLabel}
                </span>
              )}
            </div>

            {doc.documentAmountLabel && doc.documentAmount !== undefined && (
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  {doc.documentAmountLabel}
                </span>
                <span className="font-bold text-brand-primary text-base">
                  {formatMoney(doc.documentAmount)}
                </span>
              </div>
            )}

            {doc.issuedBy && (
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Verified &amp; Issued By
                </span>
                <span className="font-semibold text-gray-900">
                  {doc.issuedBy}
                  {doc.issuedAt ? ` · ${formatDate(doc.issuedAt)}` : ''}
                </span>
              </div>
            )}

            <div>
              <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Checked Timestamp
              </span>
              <span className="text-xs text-gray-600">{formatDate(result.verifiedAt)}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Institutional Header */}
        <div className="bg-brand-dark text-white rounded-2xl p-6 sm:p-8 shadow-lg border border-brand-primary/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-brand-accent/15 border border-brand-accent/30 rounded-xl text-brand-accent">
                <ShieldCheck size={28} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-brand-accent font-bold">
                  {COMPANY_INFO.legalName}
                </p>
                <h1 className="text-2xl sm:text-3xl font-serif font-bold mt-0.5">
                  Official Document Verification
                </h1>
              </div>
            </div>
            <div className="text-xs text-brand-neutral/80 flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
              <Building2 size={14} className="text-brand-accent" />
              <span>{COMPANY_INFO.enlistments.combinedSummary}</span>
            </div>
          </div>
          <p className="text-sm text-brand-neutral/80 mt-4 leading-relaxed">
            Verify the authenticity and live ledger status of Allotment Invoices, Statements of
            Account, Payment Receipts, Cancellation Settlements, and Refund Vouchers issued by{' '}
            {COMPANY_INFO.legalName}. Sensitive personal details are masked for privacy.
          </p>
        </div>

        {/* Loading / Error / Verdict */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 flex flex-col items-center justify-center gap-3 shadow-sm">
            <Loader2 className="animate-spin text-brand-primary" size={34} />
            <p className="text-sm font-semibold text-gray-600">
              Checking official Viridian Nexus ledger...
            </p>
          </div>
        )}

        {!loading && fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-sm text-red-800">
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && renderVerdictVisual()}

        {/* Manual Lookup Form */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center gap-2.5 mb-2">
            <FileSearch size={20} className="text-brand-primary" />
            <h2 className="text-lg font-serif font-bold text-gray-900">
              Verify Another Document Manually
            </h2>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Enter the Booking Reference and Invoice / Voucher Number printed on the top-right header
            of your document.
          </p>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="verify-ref-input"
                className="block text-xs font-bold text-gray-700 mb-1"
              >
                Booking Reference *
              </label>
              <input
                id="verify-ref-input"
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="e.g. VN-2026-8687"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
                required
              />
            </div>
            <div>
              <label
                htmlFor="verify-doc-input"
                className="block text-xs font-bold text-gray-700 mb-1"
              >
                Invoice / Voucher No. *
              </label>
              <input
                id="verify-doc-input"
                type="text"
                value={docInput}
                onChange={(e) => setDocInput(e.target.value)}
                placeholder="e.g. VN-CXL-2026-8687"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
                required
              />
            </div>
            <div>
              <label
                htmlFor="verify-code-input"
                className="block text-xs font-bold text-gray-700 mb-1"
              >
                Verify Code (Optional)
              </label>
              <input
                id="verify-code-input"
                type="text"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                placeholder="e.g. VN-0A1B2C3"
                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-primary/40"
              />
            </div>

            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                className="px-6 py-2.5 bg-brand-primary hover:bg-brand-dark text-white text-sm font-bold rounded-xl transition-colors inline-flex items-center gap-2"
              >
                <ShieldCheck size={16} />
                Verify Authenticity
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
