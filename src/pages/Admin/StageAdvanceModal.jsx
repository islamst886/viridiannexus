import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { STAGES, evaluateStagePrerequisites } from '../../utils/bookingStageGates';
import { 
  X, CheckCircle2, XCircle, AlertCircle, ArrowRight, 
  ShieldAlert, ShieldCheck, Loader2, Calendar, FileText, Key
} from 'lucide-react';
import { toast } from 'react-toastify';

export default function StageAdvanceModal({ 
  isOpen, 
  onClose, 
  booking, 
  payments, 
  initialTargetStage,
  isSuperAdmin, 
  adminName, 
  adminUid 
}) {
  const currentIndex = STAGES.indexOf(booking?.stage);
  const defaultTarget = initialTargetStage || (currentIndex < STAGES.length - 1 ? STAGES[currentIndex + 1] : booking?.stage);
  
  const [targetStage, setTargetStage] = useState(defaultTarget);
  const [submitting, setSubmitting] = useState(false);

  // Milestone specific metadata
  const [agreementDate, setAgreementDate] = useState(booking?.agreementDate || new Date().toISOString().split('T')[0]);
  const [agreementRef, setAgreementRef] = useState(booking?.agreementRef || '');
  const [handoverDate, setHandoverDate] = useState(booking?.handoverDate || new Date().toISOString().split('T')[0]);
  const [handoverRecipient, setHandoverRecipient] = useState(booking?.handoverRecipient || booking?.clientName || '');
  const [handoverNotes, setHandoverNotes] = useState(booking?.handoverNotes || '');

  // Super Admin Override states
  const [overrideAuthorized, setOverrideAuthorized] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      const target = initialTargetStage || (currentIndex < STAGES.length - 1 ? STAGES[currentIndex + 1] : booking?.stage);
      setTargetStage(target);
      setOverrideAuthorized(false);
      setOverrideReason('');
      setAgreementDate(booking?.agreementDate || new Date().toISOString().split('T')[0]);
      setAgreementRef(booking?.agreementRef || '');
      setHandoverDate(booking?.handoverDate || new Date().toISOString().split('T')[0]);
      setHandoverRecipient(booking?.handoverRecipient || booking?.clientName || '');
      setHandoverNotes(booking?.handoverNotes || '');
    }
  }, [isOpen, initialTargetStage, booking, currentIndex]);

  if (!isOpen || !booking) return null;

  const evaluation = evaluateStagePrerequisites(targetStage, booking, payments);
  const isSameStage = booking.stage === targetStage;
  const isRollback = evaluation.isRollback;
  const canAdvance = isSameStage ? false : (evaluation.allowed || (isSuperAdmin && overrideAuthorized && overrideReason.trim().length >= 8));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canAdvance) return;

    setSubmitting(true);
    try {
      const updates = {
        stage: targetStage,
        last_updated_by: adminUid
      };

      // Include stage metadata if applicable
      if (targetStage === 'Agreement Signed') {
        updates.agreement_date = agreementDate;
        if (agreementRef) updates.agreement_ref = agreementRef;
      } else if (targetStage === 'Handover' || targetStage === 'Completed') {
        updates.handover_date = handoverDate;
        updates.handover_recipient = handoverRecipient;
        if (handoverNotes) updates.handover_notes = handoverNotes;
      }

      await supabase.from('bookings').update(updates).eq('id', booking.id);

      // Log in activity log
      const isOverride = !evaluation.allowed && isSuperAdmin && overrideAuthorized;
      await supabase.from('booking_activity_log').insert({
        booking_id: booking.id,
        action: isOverride ? "Stage Override (Super Admin)" : isRollback ? "Stage Rolled Back" : "Stage Advanced",
        detail: isOverride 
          ? `Stage forcibly set from "${booking.stage}" to "${targetStage}". Justification: ${overrideReason.trim()}`
          : isRollback
          ? `Stage reverted from "${booking.stage}" to "${targetStage}"`
          : `Stage advanced from "${booking.stage}" to "${targetStage}"`,
        performed_by: adminName
      });

      toast.success(isOverride ? "Stage updated with Super Admin override" : `Stage updated to ${targetStage}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Failed to update booking stage");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 sm:p-6">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-gray-100 my-auto animate-fade-in max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-brand-dark text-white p-5 sm:p-6 relative border-b border-brand-primary/30 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-white/60 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>

          <h3 className="text-xl font-bold font-serif text-brand-neutral">Milestone Stage Progression</h3>
          <p className="text-xs text-brand-neutral/70 mt-1">
            Booking #{booking.bookingRef} — {booking.propertyName}
          </p>

          {/* Current vs Target banner */}
          <div className="flex items-center gap-3 mt-4 bg-white/10 p-3 rounded-2xl border border-white/10 text-xs sm:text-sm">
            <div className="flex-1">
              <span className="text-[10px] uppercase font-bold text-brand-neutral/60 block">Current Stage</span>
              <span className="font-bold text-brand-accent">{booking.stage}</span>
            </div>
            <ArrowRight size={18} className="text-brand-neutral/50 shrink-0" />
            <div className="flex-1">
              <span className="text-[10px] uppercase font-bold text-brand-neutral/60 block">Target Stage</span>
              <span className="font-bold text-emerald-400">{targetStage}</span>
            </div>
          </div>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col">
          <div className="p-5 sm:p-6 space-y-5 flex-1">
          
          {/* Target Stage Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Select Target Milestone
            </label>
            <select
              value={targetStage}
              onChange={(e) => {
                setTargetStage(e.target.value);
                setOverrideAuthorized(false);
                setOverrideReason('');
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 text-sm font-semibold bg-white"
            >
              {STAGES.map((s, idx) => (
                <option key={s} value={s}>
                  {idx + 1}. {s} {s === booking.stage ? '(Current)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Same Stage Notice */}
          {isSameStage && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs text-gray-600 text-center">
              The booking is already at <strong>{targetStage}</strong>. Please choose another milestone.
            </div>
          )}

          {/* Rollback Warning */}
          {isRollback && !isSameStage && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-950">Milestone Rollback Notice</p>
                <p className="mt-0.5 text-amber-800">
                  You are moving the booking backwards from <strong>"{booking.stage}"</strong> to <strong>"{targetStage}"</strong>. 
                  This will update the current workflow stage while preserving past financial records in the ledger and activity log.
                </p>
              </div>
            </div>
          )}

          {/* Prerequisites Checklist (for forward transitions) */}
          {!isRollback && !isSameStage && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Milestone Gate Prerequisites
                </span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  evaluation.allowed 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  {evaluation.allowed ? 'All Gates Cleared' : 'Action Required'}
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 space-y-3">
                {evaluation.requirements.map((req) => (
                  <div key={req.id} className="flex items-start gap-3 text-xs">
                    {req.met ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`font-bold ${req.met ? 'text-gray-900' : 'text-red-950'}`}>
                        {req.title}
                      </p>
                      <p className={`mt-0.5 ${req.met ? 'text-gray-500' : 'text-red-700 font-medium'}`}>
                        {req.details}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestone Specific Fields: Agreement Signed */}
          {targetStage === 'Agreement Signed' && (
            <div className="bg-blue-50/50 border border-blue-200/60 rounded-2xl p-4 space-y-3 animate-fade-in text-xs">
              <div className="flex items-center gap-2 font-bold text-blue-950">
                <FileText size={16} className="text-blue-600" />
                <span>Sales Agreement Documentation</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Execution / Signing Date</label>
                  <input
                    type="date"
                    value={agreementDate}
                    onChange={(e) => setAgreementDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Deed / Contract Ref # (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. AGR-2026-081"
                    value={agreementRef}
                    onChange={(e) => setAgreementRef(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Milestone Specific Fields: Handover */}
          {targetStage === 'Handover' && (
            <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-2xl p-4 space-y-3 animate-fade-in text-xs">
              <div className="flex items-center gap-2 font-bold text-emerald-950">
                <Key size={16} className="text-emerald-700" />
                <span>Handover & Possession Details</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Possession / Handover Date</label>
                  <input
                    type="date"
                    value={handoverDate}
                    onChange={(e) => setHandoverDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Keys Delivered To</label>
                  <input
                    type="text"
                    value={handoverRecipient}
                    onChange={(e) => setHandoverRecipient(e.target.value)}
                    placeholder="Client or Authorised Representative"
                    className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-semibold text-gray-700 mb-1">Handover Notes / Inspection Ref</label>
                  <textarea
                    rows={2}
                    value={handoverNotes}
                    onChange={(e) => setHandoverNotes(e.target.value)}
                    placeholder="Key sets delivered, meter readings, snag list cleared..."
                    className="w-full px-3 py-2 border rounded-xl bg-white text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Super Admin Override Section (shown when gates fail) */}
          {!evaluation.allowed && !isRollback && !isSameStage && (
            <div className="border border-red-200 bg-red-50/60 rounded-2xl p-4 space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <ShieldAlert size={20} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-red-950">Financial / Milestone Gate Active</h4>
                  <p className="text-red-800 mt-0.5">
                    {isSuperAdmin
                      ? "The standard business prerequisites are not met. As a Super Admin, you can authorize an executive override. This action will be permanently recorded in the audit log."
                      : "The standard business prerequisites are not met. Only a Super Admin can override these requirements. Please settle the pending payments in the ledger."}
                  </p>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="pt-2 border-t border-red-200/70 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={overrideAuthorized}
                      onChange={(e) => setOverrideAuthorized(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                    />
                    <span className="font-bold text-red-950">
                      Authorize Super Admin Milestone Override
                    </span>
                  </label>

                  {overrideAuthorized && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="block font-bold text-red-900">
                        Audit Justification / Business Reason <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        rows={2}
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Explain why this gate is being overridden (e.g. Bank draft pending clearance, special director approval #841)..."
                        className="w-full p-2.5 border border-red-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-red-400 focus:outline-none"
                        required
                      />
                      {overrideReason.trim().length < 8 && (
                        <p className="text-[11px] text-red-600">
                          Please provide a detailed reason (at least 8 characters) for the audit trail.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>

          {/* Action Footer - Fixed at bottom */}
          <div className="p-4 sm:px-6 bg-gray-50/95 backdrop-blur-sm border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-xl transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting || !canAdvance}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all ${
                submitting || !canAdvance
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : overrideAuthorized
                  ? 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg'
                  : 'bg-brand-primary text-white hover:bg-brand-dark hover:shadow-lg'
              }`}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Saving...
                </>
              ) : overrideAuthorized ? (
                <>
                  <ShieldAlert size={16} /> Confirm Override & Advance
                </>
              ) : isRollback ? (
                'Confirm Rollback'
              ) : (
                'Advance Milestone'
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
