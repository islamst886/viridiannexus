import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { X, Loader2, AlertTriangle, DollarSign } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../../context/GlobalState';

export default function ReleaseParkingModal({ isOpen, onClose, booking, onComplete }) {
  const { userProfile } = useGlobalState();
  const adminUid = userProfile?.uid;
  const adminName = userProfile?.displayName || 'Admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [property, setProperty] = useState(null);
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [adjustLedger, setAdjustLedger] = useState(true);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && booking) {
      setLoading(true);
      setNotes('Client opted out of parking.');
      getDoc(doc(db, 'properties', booking.propertyId)).then(snap => {
        if (snap.exists()) {
          const pData = snap.data();
          setProperty(pData);
          const pPrice = Number(pData.parkingPrice) || 0;
          const numSpots = (booking.parkingSpotIds || []).length;
          setDeductionAmount(pPrice * numSpots);
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        toast.error("Failed to load property data.");
        setLoading(false);
      });
    }
  }, [isOpen, booking]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!booking.parkingSpotIds || booking.parkingSpotIds.length === 0) {
      toast.error("No parking spots to release.");
      return;
    }

    setSubmitting(true);
    try {
      await runTransaction(db, async (txn) => {
        // 1. Release spots in Property document
        const propRef = doc(db, 'properties', booking.propertyId);
        const propSnap = await txn.get(propRef);
        
        if (propSnap.exists()) {
          const pData = propSnap.data();
          const parkingInv = [...(pData.parkingInventory || [])];
          
          for (const spotId of booking.parkingSpotIds) {
            const spotIdx = parkingInv.findIndex(s => s.id === spotId);
            if (spotIdx !== -1) {
              parkingInv[spotIdx].status = 'Available';
              parkingInv[spotIdx].assignedBookingId = null;
            }
          }
          
          txn.update(propRef, { parkingInventory: parkingInv, lastUpdatedAt: serverTimestamp() });
        }
        
        // 2. Update Booking Document
        const deduct = Number(deductionAmount) || 0;
        const newTotalPrice = Math.max(0, (booking.totalPrice || 0) - deduct);
        const newBalanceDue = Math.max(0, (booking.balanceDue || 0) - deduct);

        txn.update(doc(db, 'bookings', booking.id), {
          parkingSpotIds: [],
          parkingIncluded: null,
          totalPrice: newTotalPrice,
          balanceDue: newBalanceDue,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: adminUid
        });
        
        // 3. Activity Log
        const logRef = doc(collection(db, `bookings/${booking.id}/activityLog`));
        txn.set(logRef, {
          action: 'Parking Released & Price Adjusted',
          detail: `Parking spots [${(booking.parkingSpotIds || []).join(', ')}] released. Total price reduced by ৳${deduct.toLocaleString('en-IN')}. Reason: ${notes}`,
          performedBy: adminName,
          performedAt: serverTimestamp()
        });

        // 4. Adjust Ledger (Create a credit note)
        if (adjustLedger && deduct > 0) {
          const ledgerRef = doc(collection(db, `bookings/${booking.id}/payments`));
          txn.set(ledgerRef, {
            type: 'Credit Note (Parking Removed)',
            installmentNumber: null,
            scheduledDate: new Date(),
            paidDate: new Date(),
            scheduledAmount: -deduct,
            receivedAmount: -deduct,
            paymentMode: 'System',
            referenceNumber: 'PARKING-RELEASE',
            status: 'Paid',
            note: 'Automatic deduction for releasing parking spots.',
            recordedBy: adminUid,
            recordedAt: serverTimestamp()
          });
        }
      });

      toast.success('Parking spots released and pricing updated successfully.');
      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to release parking: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            🚗 Release Parking
          </h2>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-brand-primary" size={40} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6">
            
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg flex gap-3 text-sm">
              <AlertTriangle className="shrink-0" size={20} />
              <div>
                <strong className="block mb-1">You are releasing {(booking.parkingSpotIds || []).length} parking spot(s)</strong>
                <p>These spots will immediately become available for other clients to book. The client will no longer have parking assigned.</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Deduction from Total Price (৳)</label>
              <p className="text-xs text-gray-500 mb-3">
                The property's standard parking price is ৳{Number(property?.parkingPrice || 0).toLocaleString('en-IN')}. 
                Based on {(booking.parkingSpotIds || []).length} spot(s), the suggested deduction is ৳{(Number(property?.parkingPrice || 0) * (booking.parkingSpotIds || []).length).toLocaleString('en-IN')}.
              </p>
              <div className="relative mb-4">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="number"
                  value={deductionAmount}
                  onChange={(e) => setDeductionAmount(e.target.value)}
                  className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500/50 outline-none font-medium"
                />
              </div>

              {/* Price Calculation Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm font-medium">
                <div className="flex justify-between text-gray-500">
                  <span>Current Total Price:</span>
                  <span>৳{(booking.totalPrice || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Deduction Amount:</span>
                  <span>- ৳{(Number(deductionAmount) || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between text-gray-900 font-bold text-base">
                  <span>New Total Price:</span>
                  <span>৳{Math.max(0, (booking.totalPrice || 0) - (Number(deductionAmount) || 0)).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {Number(deductionAmount) > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={adjustLedger} 
                    onChange={(e) => setAdjustLedger(e.target.checked)}
                    className="mt-1 w-4 h-4 text-brand-primary rounded"
                  />
                  <div>
                    <span className="block text-sm font-bold text-gray-900">Auto-balance Installment Ledger</span>
                    <span className="block text-xs text-gray-500 mt-0.5">Automatically creates a negative "Price Adjustment" payment record so the total ledger balance matches the new reduced Total Price.</span>
                  </div>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Reason / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why is parking being released?"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm h-24 resize-none"
              ></textarea>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={onClose} 
                disabled={submitting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                type="submit"
                disabled={submitting}
                className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Release Parking & Adjust'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
