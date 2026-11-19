import { useState, type FormEvent } from 'react';
import { supabase } from '../../supabase';
import type { Booking } from '../../types';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import {
  fetchFreshPropertyAndActiveBookings,
  reconcilePropertyInventoryWithBookings,
} from '../../utils/bookingAllocation';

type CancelableBooking = Booking & { internal_notes?: string | null };

interface CancelBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: CancelableBooking | null;
  adminName: string;
  adminUid: string | undefined;
  onSuccess?: () => void;
}

export default function CancelBookingModal({ isOpen, onClose, booking, adminName, adminUid, onSuccess }: CancelBookingModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !booking) return null;

  const handleCancel = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please provide a cancellation reason/note.');
      return;
    }

    if (!window.confirm('Are you absolutely sure you want to cancel this booking? This will release the assigned unit.')) {
      return;
    }

    setLoading(true);
    try {
      const cancelTime = new Date().toISOString();
      const cancelNoteEntry = `[Cancelled by ${adminName} on ${cancelTime.split('T')[0]}]: ${reason.trim()}`;
      const prevNotes = booking.internalNotes || booking.internal_notes || '';
      const updatedInternalNotes = prevNotes ? `${prevNotes}\n${cancelNoteEntry}` : cancelNoteEntry;

      // Mark booking Cancelled first so reconciliation accurately sees remaining active locks
      const { error: bError } = await supabase.from('bookings').update({
        status: 'Cancelled',
        stage: 'Cancelled',
        internal_notes: updatedInternalNotes,
        last_updated_by: adminUid,
        updated_at: cancelTime
      }).eq('id', booking.id);
      if (bError) throw bError;

      if (booking.propertyId) {
        const postFresh = await fetchFreshPropertyAndActiveBookings(booking.propertyId);
        const reconciled = reconcilePropertyInventoryWithBookings(
          postFresh.property,
          postFresh.activeBookings
        );
        const { error: propErr } = await supabase.from('properties').update({
          inventory: reconciled.inventory,
          parking_inventory: reconciled.parkingInventory
        }).eq('id', booking.propertyId);
        if (propErr) throw propErr;
      }

      await supabase.from('booking_activity_log').insert({
        booking_id: booking.id,
        type: "Booking Cancelled",
        message: `Booking cancelled by ${adminName}. Reason: ${reason.trim()} (Assigned unit released to Available)`,
        actor_name: adminName,
        actor_id: adminUid,
        metadata: {
          reason: reason.trim(),
          cancelledBy: adminName,
          cancellationDate: new Date().toISOString()
        }
      });

      toast.success('Booking cancelled successfully.');
      onSuccess?.();
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Failed to cancel booking: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <X size={24} />
        </button>

        <div className="flex items-center gap-3 text-red-600 mb-2">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle size={24} />
          </div>
          <h3 className="text-xl font-bold font-serif">Cancel Booking</h3>
        </div>

        <p className="text-sm text-gray-600 mb-6 mt-2 border-l-4 border-red-500 pl-3 bg-red-50 p-2 rounded-r">
          You are about to cancel booking <strong className="text-gray-900">{booking.bookingRef}</strong>.
          This action will immediately release the assigned unit (<strong className="text-gray-900">{booking.propertyName} - {booking.unitNumber || 'TBD'}</strong>) back to the inventory as 'Available'.
        </p>

        <form onSubmit={handleCancel} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Cancellation Reason / Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all"
              rows={4}
              placeholder="e.g. Client requested cancellation due to personal reasons. Refund processed."
              required
            />
            <p className="text-xs text-gray-500 mt-1">This note will be permanently logged and visible in the booking details.</p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Keep Booking Active
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Confirm Cancellation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
