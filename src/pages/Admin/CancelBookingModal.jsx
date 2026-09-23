import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc, serverTimestamp, runTransaction, addDoc, collection } from 'firebase/firestore';
import { X, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';

export default function CancelBookingModal({ isOpen, onClose, booking, adminName, adminUid, onSuccess }) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !booking) return null;

  const handleCancel = async (e) => {
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
      if (booking?.propertyId && booking?.inventoryId) {
        await runTransaction(db, async (txn) => {
          const propRef = doc(db, 'properties', booking.propertyId);
          const propSnap = await txn.get(propRef);
          
          if (propSnap.exists()) {
            const pData = propSnap.data();
            const inv = [...(pData.inventory || [])];
            const targetUnit = inv.find(u => u.id === booking.inventoryId);
            if (targetUnit) {
              targetUnit.status = 'Available';
              delete targetUnit.bookingId;
              delete targetUnit.bookingRef;
              delete targetUnit.clientName;
              txn.update(propRef, { 
                inventory: inv, 
                lastUpdatedAt: serverTimestamp() 
              });
            }
          }
          
          txn.update(doc(db, 'bookings', booking.id), {
            status: 'Cancelled',
            stage: 'Cancelled',
            cancellationNote: reason.trim(),
            cancellationDate: serverTimestamp(),
            cancelledBy: adminName,
            cancelledByUid: adminUid,
            lastUpdatedAt: serverTimestamp(),
            lastUpdatedBy: adminUid
          });
        });
      } else {
        await updateDoc(doc(db, 'bookings', booking.id), {
          status: 'Cancelled',
          cancellationNote: reason.trim(),
          cancellationDate: serverTimestamp(),
          cancelledBy: adminName,
          cancelledByUid: adminUid,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: adminUid
        });
      }

      await addDoc(collection(db, `bookings/${booking.id}/activityLog`), {
        action: "Booking Cancelled",
        detail: `Booking cancelled. Reason: ${reason.trim()} (Assigned unit released to Available)`,
        performedBy: adminName,
        performedAt: serverTimestamp()
      });

      toast.success('Booking cancelled successfully.');
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error("Failed to cancel booking");
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
