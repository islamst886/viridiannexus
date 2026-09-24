import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { X, Loader2, PlusCircle, DollarSign } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../../context/GlobalState';

export default function AddParkingModal({ isOpen, onClose, booking, onComplete }) {
  const { userProfile } = useGlobalState();
  const adminUid = userProfile?.uid;
  const adminName = userProfile?.displayName || 'Admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [property, setProperty] = useState(null);
  
  const [availableSpots, setAvailableSpots] = useState([]);
  const [selectedSpots, setSelectedSpots] = useState([]);
  
  const [additionAmount, setAdditionAmount] = useState(0);
  const [adjustLedger, setAdjustLedger] = useState(true);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && booking) {
      setLoading(true);
      setNotes('Client requested additional parking mid-booking.');
      setSelectedSpots([]);
      
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 14);
      setInvoiceDueDate(defaultDate.toISOString().split('T')[0]);
      
      getDoc(doc(db, 'properties', booking.propertyId)).then(snap => {
        if (snap.exists()) {
          const pData = snap.data();
          setProperty(pData);
          
          const spots = pData.parkingInventory || [];
          setAvailableSpots(spots.filter(s => s.status === 'Available'));
        }
        setLoading(false);
      }).catch(err => {
        console.error(err);
        toast.error("Failed to load property data.");
        setLoading(false);
      });
    }
  }, [isOpen, booking]);

  // Update suggested price when spots are selected
  useEffect(() => {
    if (property) {
      const pPrice = Number(property.parkingPrice) || 0;
      setAdditionAmount(pPrice * selectedSpots.length);
    }
  }, [selectedSpots, property]);

  if (!isOpen) return null;

  const toggleSpot = (spotId) => {
    if (selectedSpots.includes(spotId)) {
      setSelectedSpots(prev => prev.filter(id => id !== spotId));
    } else {
      setSelectedSpots(prev => [...prev, spotId]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (selectedSpots.length === 0) {
      toast.error("Please select at least one parking spot.");
      return;
    }

    setSubmitting(true);
    try {
      await runTransaction(db, async (txn) => {
        // 1. Claim spots in Property document
        const propRef = doc(db, 'properties', booking.propertyId);
        const propSnap = await txn.get(propRef);
        
        if (!propSnap.exists()) throw new Error("Property not found.");
        
        const pData = propSnap.data();
        const parkingInv = [...(pData.parkingInventory || [])];
        const newlyAssigned = [];
        
        for (const spotId of selectedSpots) {
          const spotIdx = parkingInv.findIndex(s => s.id === spotId);
          if (spotIdx === -1) throw new Error(`Spot ${spotId} no longer exists.`);
          if (parkingInv[spotIdx].status !== 'Available') {
            throw new Error(`Spot ${parkingInv[spotIdx].label} was just taken by someone else.`);
          }
          
          parkingInv[spotIdx].status = 'Assigned';
          parkingInv[spotIdx].assignedBookingId = booking.id;
          newlyAssigned.push(parkingInv[spotIdx]);
        }
        
        txn.update(propRef, { parkingInventory: parkingInv, lastUpdatedAt: serverTimestamp() });
        
        // 2. Update Booking Document
        const addAmount = Number(additionAmount) || 0;
        const newTotalPrice = (booking.totalPrice || 0) + addAmount;
        const newBalanceDue = (booking.balanceDue || 0) + addAmount;

        const currentSpotIds = booking.parkingSpotIds || [];
        const combinedSpotIds = [...currentSpotIds, ...selectedSpots];
        
        // Rebuild display string from all spots (old + new)
        const allSpotsObj = parkingInv.filter(s => combinedSpotIds.includes(s.id));
        const parkingDisplayStr = allSpotsObj.map(s => `${s.label}${s.level ? ` (${s.level})` : ''}`).join(', ') || null;

        txn.update(doc(db, 'bookings', booking.id), {
          parkingSpotIds: combinedSpotIds,
          parkingIncluded: parkingDisplayStr,
          totalPrice: newTotalPrice,
          balanceDue: newBalanceDue,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: adminUid
        });
        
        // 3. Activity Log
        const addedLabels = newlyAssigned.map(s => s.label).join(', ');
        const logRef = doc(collection(db, `bookings/${booking.id}/activityLog`));
        txn.set(logRef, {
          action: 'Parking Added & Price Adjusted',
          detail: `Added parking spots: [${addedLabels}]. Total price increased by ৳${addAmount.toLocaleString('en-IN')}. Reason: ${notes}`,
          performedBy: adminName,
          performedAt: serverTimestamp()
        });

        // 4. Adjust Ledger (Create a debit note/invoice)
        if (adjustLedger && addAmount > 0) {
          const ledgerRef = doc(collection(db, `bookings/${booking.id}/payments`));
          txn.set(ledgerRef, {
            type: 'Add-on Invoice (Parking)',
            installmentNumber: null,
            scheduledDate: invoiceDueDate ? new Date(invoiceDueDate) : new Date(),
            paidDate: null,
            scheduledAmount: addAmount,
            receivedAmount: 0,
            paymentMode: '',
            referenceNumber: 'PARKING-ADDON',
            status: 'Scheduled',
            note: 'Invoice for adding parking mid-booking.',
            recordedBy: adminUid,
            recordedAt: serverTimestamp()
          });
        }
      });

      toast.success('Parking spots successfully added to booking.');
      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to add parking: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <PlusCircle className="text-brand-primary" /> Add Parking to Booking
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
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-bold text-gray-700">Select Available Parking Spots</label>
                <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {availableSpots.length} Available
                </span>
              </div>
              
              {availableSpots.length === 0 ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200">
                  <span className="font-bold">No spots available.</span> All parking in this property is either sold out or undefined.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                  {availableSpots.map(spot => {
                    const isChecked = selectedSpots.includes(spot.id);
                    return (
                      <label 
                        key={spot.id} 
                        className={`flex items-center gap-4 p-3 cursor-pointer border-b last:border-0 transition-colors ${isChecked ? 'bg-brand-primary/10 border-brand-primary/20' : 'hover:bg-gray-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSpot(spot.id)}
                          className="w-4 h-4 text-brand-primary rounded accent-brand-primary"
                        />
                        <div className="flex-1">
                          <span className="font-bold text-sm text-gray-900">{spot.label}</span>
                          {(spot.level || spot.zone) && <span className="text-xs text-gray-500 ml-2">{[spot.level, spot.zone].filter(Boolean).join(' · ')}</span>}
                        </div>
                        <span className="text-xs font-mono text-gray-400">{spot.id}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedSpots.length > 0 && (
              <>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Additional Cost to Total Price (৳)</label>
                  <p className="text-xs text-gray-500 mb-3">
                    The property's standard parking price is ৳{Number(property?.parkingPrice || 0).toLocaleString('en-IN')}. 
                    Based on {selectedSpots.length} spot(s), the suggested addition is ৳{(Number(property?.parkingPrice || 0) * selectedSpots.length).toLocaleString('en-IN')}.
                  </p>
                  <div className="relative mb-4">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="number"
                      value={additionAmount}
                      onChange={(e) => setAdditionAmount(e.target.value)}
                      className="w-full pl-10 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none font-medium"
                    />
                  </div>

                  {/* Price Calculation Summary */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-sm font-medium">
                    <div className="flex justify-between text-gray-500">
                      <span>Current Total Price:</span>
                      <span>৳{(booking.totalPrice || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Addition Amount:</span>
                      <span>+ ৳{(Number(additionAmount) || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 flex justify-between text-gray-900 font-bold text-base">
                      <span>New Total Price:</span>
                      <span>৳{((booking.totalPrice || 0) + (Number(additionAmount) || 0)).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {Number(additionAmount) > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-4">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={adjustLedger} 
                        onChange={(e) => setAdjustLedger(e.target.checked)}
                        className="mt-1 w-4 h-4 text-brand-primary rounded"
                      />
                      <div>
                        <span className="block text-sm font-bold text-gray-900">Auto-Generate Invoice in Ledger</span>
                        <span className="block text-xs text-gray-500 mt-0.5">Automatically creates a "Scheduled" payment invoice for this add-on so the ledger matches the new Total Price.</span>
                      </div>
                    </label>

                    {adjustLedger && (
                      <div className="pl-7 pt-2 border-t border-gray-200">
                        <label className="block text-sm font-bold text-gray-700 mb-1">Invoice Due Date</label>
                        <input
                          type="date"
                          value={invoiceDueDate}
                          onChange={(e) => setInvoiceDueDate(e.target.value)}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm font-medium"
                          required
                        />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Reason / Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details for this addition"
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
                disabled={submitting || selectedSpots.length === 0}
                className="flex-1 px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Add Parking & Update Invoice'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
