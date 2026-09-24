import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc, collection, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../../context/GlobalState';

export default function ChangeParkingModal({ isOpen, onClose, booking, onComplete }) {
  const { userProfile } = useGlobalState();
  const adminUid = userProfile?.uid;
  const adminName = userProfile?.displayName || 'Admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [property, setProperty] = useState(null);
  const [availableSpots, setAvailableSpots] = useState([]);
  const [currentSpots, setCurrentSpots] = useState([]);
  
  const [spotsToRelease, setSpotsToRelease] = useState([]);
  const [spotsToClaim, setSpotsToClaim] = useState([]);
  
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (isOpen && booking) {
      setLoading(true);
      setNotes('Client requested a parking spot exchange.');
      setSpotsToRelease([]);
      setSpotsToClaim([]);
      
      getDoc(doc(db, 'properties', booking.propertyId)).then(snap => {
        if (snap.exists()) {
          const pData = snap.data();
          setProperty(pData);
          
          const allSpots = pData.parkingInventory || [];
          setAvailableSpots(allSpots.filter(s => s.status === 'Available'));
          
          const assigned = allSpots.filter(s => (booking.parkingSpotIds || []).includes(s.id));
          setCurrentSpots(assigned);
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

  const toggleRelease = (spotId) => {
    setSpotsToRelease(prev => 
      prev.includes(spotId) ? prev.filter(id => id !== spotId) : [...prev, spotId]
    );
  };

  const toggleClaim = (spotId) => {
    setSpotsToClaim(prev => 
      prev.includes(spotId) ? prev.filter(id => id !== spotId) : [...prev, spotId]
    );
  };

  const isBalanced = spotsToRelease.length > 0 && spotsToRelease.length === spotsToClaim.length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isBalanced) {
      toast.error(`You must claim exactly ${spotsToRelease.length} spot(s) to match the ones being released.`);
      return;
    }

    setSubmitting(true);
    try {
      await runTransaction(db, async (txn) => {
        const propRef = doc(db, 'properties', booking.propertyId);
        const propSnap = await txn.get(propRef);
        
        if (!propSnap.exists()) throw new Error("Property not found.");
        
        const pData = propSnap.data();
        const parkingInv = [...(pData.parkingInventory || [])];
        
        const releasedLabels = [];
        const claimedLabels = [];

        // 1. Release old spots
        for (const spotId of spotsToRelease) {
          const spotIdx = parkingInv.findIndex(s => s.id === spotId);
          if (spotIdx !== -1) {
            parkingInv[spotIdx].status = 'Available';
            parkingInv[spotIdx].assignedBookingId = null;
            releasedLabels.push(parkingInv[spotIdx].label);
          }
        }

        // 2. Claim new spots
        for (const spotId of spotsToClaim) {
          const spotIdx = parkingInv.findIndex(s => s.id === spotId);
          if (spotIdx === -1) throw new Error(`Spot ${spotId} no longer exists.`);
          if (parkingInv[spotIdx].status !== 'Available') {
            throw new Error(`Spot ${parkingInv[spotIdx].label} is no longer available.`);
          }
          parkingInv[spotIdx].status = 'Assigned';
          parkingInv[spotIdx].assignedBookingId = booking.id;
          claimedLabels.push(parkingInv[spotIdx].label);
        }
        
        txn.update(propRef, { parkingInventory: parkingInv, lastUpdatedAt: serverTimestamp() });
        
        // 3. Update Booking Document
        const currentSpotIds = booking.parkingSpotIds || [];
        // Remove released, add claimed
        const finalSpotIds = [...currentSpotIds.filter(id => !spotsToRelease.includes(id)), ...spotsToClaim];
        
        const allSpotsObj = parkingInv.filter(s => finalSpotIds.includes(s.id));
        const parkingDisplayStr = allSpotsObj.map(s => `${s.label}${s.level ? ` (${s.level})` : ''}`).join(', ') || null;

        txn.update(doc(db, 'bookings', booking.id), {
          parkingSpotIds: finalSpotIds,
          parkingIncluded: parkingDisplayStr,
          lastUpdatedAt: serverTimestamp(),
          lastUpdatedBy: adminUid
        });
        
        // 4. Activity Log
        const logRef = doc(collection(db, `bookings/${booking.id}/activityLog`));
        txn.set(logRef, {
          action: 'Parking Swapped',
          detail: `Exchanged spots: Given up [${releasedLabels.join(', ')}], Claimed [${claimedLabels.join(', ')}]. No price adjustment required. Reason: ${notes}`,
          performedBy: adminName,
          performedAt: serverTimestamp()
        });
      });

      toast.success('Parking spots successfully swapped.');
      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(`Failed to swap parking: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="text-brand-primary" /> Swap / Change Parking
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
          <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col h-full">
            
            <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg mb-6 text-sm">
              <strong className="block mb-1">Zero-Sum Exchange</strong>
              <p>Swap existing parking spots for different available spots in a single atomic action. Because this is a direct 1-to-1 exchange, <b>no financial adjustments</b> are made to the Total Price or Ledger.</p>
            </div>

            <div className="grid grid-cols-2 gap-8 flex-1 min-h-[300px]">
              {/* Left Column: Give Up */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold text-gray-700">1. Spots to Give Up</label>
                  <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {spotsToRelease.length} Selected
                  </span>
                </div>
                
                <div className="border border-red-200 rounded-lg overflow-y-auto flex-1 bg-white">
                  {currentSpots.map(spot => {
                    const isChecked = spotsToRelease.includes(spot.id);
                    return (
                      <label 
                        key={spot.id} 
                        className={`flex items-center gap-4 p-3 cursor-pointer border-b border-gray-100 last:border-0 transition-colors ${isChecked ? 'bg-red-50 border-red-100' : 'hover:bg-gray-50'}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRelease(spot.id)}
                          className="w-4 h-4 text-red-500 rounded accent-red-500"
                        />
                        <div className="flex-1">
                          <span className={`font-bold text-sm ${isChecked ? 'text-red-900' : 'text-gray-900'}`}>{spot.label}</span>
                          {(spot.level || spot.zone) && <span className="text-xs text-gray-500 ml-2">{[spot.level, spot.zone].filter(Boolean).join(' · ')}</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Claim */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-bold text-gray-700">2. Spots to Claim</label>
                  <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {spotsToClaim.length} Selected
                  </span>
                </div>
                
                <div className="border border-green-200 rounded-lg overflow-y-auto flex-1 bg-white">
                  {availableSpots.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500 mt-10">No available spots in this property.</div>
                  ) : (
                    availableSpots.map(spot => {
                      const isChecked = spotsToClaim.includes(spot.id);
                      return (
                        <label 
                          key={spot.id} 
                          className={`flex items-center gap-4 p-3 cursor-pointer border-b border-gray-100 last:border-0 transition-colors ${isChecked ? 'bg-green-50 border-green-100' : 'hover:bg-gray-50'}`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleClaim(spot.id)}
                            className="w-4 h-4 text-green-600 rounded accent-green-600"
                          />
                          <div className="flex-1">
                            <span className={`font-bold text-sm ${isChecked ? 'text-green-900' : 'text-gray-900'}`}>{spot.label}</span>
                            {(spot.level || spot.zone) && <span className="text-xs text-gray-500 ml-2">{[spot.level, spot.zone].filter(Boolean).join(' · ')}</span>}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6">
              {!isBalanced && spotsToRelease.length > 0 && (
                <div className="text-xs text-red-600 font-bold mb-2 flex items-center gap-1">
                  <AlertTriangle size={14} /> You must select exactly {spotsToRelease.length} new spot(s) to match the released spots.
                </div>
              )}
              <label className="block text-sm font-bold text-gray-700 mb-2">Reason for Swap</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Client preferred a spot closer to the elevator..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary/50 outline-none text-sm h-20 resize-none"
              ></textarea>
            </div>

            <div className="flex gap-3 pt-6 mt-2 border-t border-gray-100">
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
                disabled={submitting || !isBalanced}
                className="flex-[2] px-4 py-2 bg-brand-primary hover:bg-brand-dark text-white rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Execute Atomic Parking Swap'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
