import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../../supabase';
import type { Booking, ParkingSpot } from '../../types';
import { X, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import { useGlobalState } from '../../context/GlobalState';
import {
  computePropertyAllocationSnapshot,
  detectConcurrentAllocationConflict,
  fetchFreshPropertyAndActiveBookings,
  formatParkingDisplayList,
  normalizeParkingSpotIds,
  reconcilePropertyInventoryWithBookings,
  validateParkingAssignment,
} from '../../utils/bookingAllocation';

interface ChangeParkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onComplete?: () => void;
}

export default function ChangeParkingModal({ isOpen, onClose, booking, onComplete }: ChangeParkingModalProps) {
  const { userProfile } = useGlobalState();
  const adminUid = userProfile?.uid;
  const adminName = userProfile?.displayName || 'Admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [availableSpots, setAvailableSpots] = useState<ParkingSpot[]>([]);
  const [currentSpots, setCurrentSpots] = useState<ParkingSpot[]>([]);

  const [spotsToRelease, setSpotsToRelease] = useState<string[]>([]);
  const [spotsToClaim, setSpotsToClaim] = useState<string[]>([]);

  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !booking) return;

    setLoading(true);
    setNotes('Client requested a parking spot exchange.');
    setSpotsToRelease([]);
    setSpotsToClaim([]);

    void (async () => {
      try {
        const [{ data: freshBooking }, fresh] = await Promise.all([
          supabase
            .from('bookings')
            .select('parking_spot_ids')
            .eq('id', booking.id)
            .single(),
          fetchFreshPropertyAndActiveBookings(booking.propertyId),
        ]);

        const snapshot = computePropertyAllocationSnapshot(
          fresh.property,
          fresh.activeBookings
        );
        const liveSpotIds = normalizeParkingSpotIds(
          freshBooking?.parking_spot_ids ?? booking.parkingSpotIds
        );
        setAvailableSpots(snapshot.availableParkingSpots);
        setCurrentSpots(
          (fresh.property.parkingInventory ?? []).filter(s => liveSpotIds.includes(s.id))
        );
      } catch (err) {
        console.error(err);
        toast.error("Failed to load property data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, booking]);

  if (!isOpen || !booking) return null;

  const toggleRelease = (spotId: string): void => {
    setSpotsToRelease(prev =>
      prev.includes(spotId) ? prev.filter(id => id !== spotId) : [...prev, spotId]
    );
  };

  const toggleClaim = (spotId: string): void => {
    setSpotsToClaim(prev =>
      prev.includes(spotId) ? prev.filter(id => id !== spotId) : [...prev, spotId]
    );
  };

  const isBalanced = spotsToRelease.length > 0 && spotsToRelease.length === spotsToClaim.length;

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (booking.status === 'Cancelled') {
      toast.error('Cancelled bookings cannot swap parking spots.');
      return;
    }
    const releaseIds = normalizeParkingSpotIds(spotsToRelease);
    const claimIds = normalizeParkingSpotIds(spotsToClaim);
    if (!isBalanced) {
      toast.error(`You must claim exactly ${spotsToRelease.length} spot(s) to match the ones being released.`);
      return;
    }
    if (claimIds.some(id => releaseIds.includes(id))) {
      toast.error('You cannot claim the same parking spot you are releasing.');
      return;
    }

    setSubmitting(true);
    try {
      const [{ data: freshBooking, error: fbErr }, fresh] = await Promise.all([
        supabase
          .from('bookings')
          .select('status, parking_spot_ids, parking_included')
          .eq('id', booking.id)
          .single(),
        fetchFreshPropertyAndActiveBookings(booking.propertyId),
      ]);
      if (fbErr) throw fbErr;
      if (freshBooking?.status === 'Cancelled') {
        throw new Error('Cancelled bookings cannot swap parking spots.');
      }

      const liveCurrentSpotIds = normalizeParkingSpotIds(
        freshBooking?.parking_spot_ids ?? booking.parkingSpotIds
      );
      const invalidRelease = releaseIds.find(id => !liveCurrentSpotIds.includes(id));
      if (invalidRelease) {
        throw new Error('Assigned parking spots changed. Please close and reopen the modal.');
      }

      const remainingSpotIds = liveCurrentSpotIds.filter(id => !releaseIds.includes(id));
      const validation = validateParkingAssignment({
        property: fresh.property,
        activeBookings: fresh.activeBookings,
        spotIds: claimIds,
        excludeBookingId: booking.id,
        existingOwnedSpotIds: remainingSpotIds,
      });
      if (!validation.ok) {
        const snapshot = computePropertyAllocationSnapshot(
          fresh.property,
          fresh.activeBookings
        );
        setAvailableSpots(snapshot.availableParkingSpots);
        setSpotsToClaim([]);
        throw new Error(validation.error);
      }

      const releasedLabels = (fresh.property.parkingInventory ?? [])
        .filter(s => releaseIds.includes(s.id))
        .map(s => s.label);
      const claimedLabels = validation.spots.map(s => s.label);

      // 1. Update Booking Document FIRST and run race check
      const finalSpotIds = normalizeParkingSpotIds([...remainingSpotIds, ...claimIds]);
      const allSpotsObj = (fresh.property.parkingInventory ?? []).filter(s => finalSpotIds.includes(s.id));
      const parkingDisplayStr = formatParkingDisplayList(allSpotsObj);

      const { error: bErr } = await supabase.from('bookings').update({
        parking_spot_ids: finalSpotIds,
        parking_included: parkingDisplayStr,
        last_updated_by: adminUid,
        updated_at: new Date().toISOString()
      }).eq('id', booking.id);
      if (bErr) throw bErr;

      const conflictCheck = await detectConcurrentAllocationConflict({
        propertyId: booking.propertyId,
        bookingId: booking.id,
        parkingSpotIds: finalSpotIds,
        mode: 'update',
      });
      if (conflictCheck.hasConflict) {
        await supabase.from('bookings').update({
          parking_spot_ids: liveCurrentSpotIds,
          parking_included: freshBooking?.parking_included ?? booking.parkingIncluded ?? null,
          last_updated_by: adminUid,
          updated_at: new Date().toISOString()
        }).eq('id', booking.id);
        try {
          const refreshed = await fetchFreshPropertyAndActiveBookings(booking.propertyId);
          setAvailableSpots(
            computePropertyAllocationSnapshot(
              refreshed.property,
              refreshed.activeBookings
            ).availableParkingSpots
          );
          setSpotsToClaim([]);
        } catch {
          // ignore secondary refresh failure
        }
        throw new Error(
          conflictCheck.message ||
            'One or more claimed parking spots were just assigned to another booking.'
        );
      }

      // 2. Reconcile Property Parking Inventory from authoritative live bookings
      const postFresh = await fetchFreshPropertyAndActiveBookings(booking.propertyId);
      const reconciled = reconcilePropertyInventoryWithBookings(
        postFresh.property,
        postFresh.activeBookings
      );
      const { error: propErr } = await supabase
        .from('properties')
        .update({ parking_inventory: reconciled.parkingInventory })
        .eq('id', booking.propertyId);
      if (propErr) throw propErr;

      // 3. Activity Log
      await supabase.from('booking_activity_log').insert({
        booking_id: booking.id,
        type: 'Parking Swapped',
        message: `Exchanged spots: Given up [${releasedLabels.join(', ')}], Claimed [${claimedLabels.join(', ')}]. No price adjustment required.${notes ? ` Reason: ${notes}` : ''}`,
        actor_name: adminName,
        actor_id: adminUid
      });

      toast.success('Parking spots successfully swapped.');
      onComplete?.();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to swap parking: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 shrink-0">
          <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-2">
            <RefreshCw className="text-brand-primary" /> Swap / Change Parking
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="animate-spin text-brand-primary" size={40} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto p-6 space-y-6 flex-1 min-h-0">
              <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded-lg text-sm">
                <strong className="block mb-1">Zero-Sum Exchange</strong>
                <p>
                  Swap existing parking spots for different available spots in a single atomic action.
                  Because this is a direct 1-to-1 exchange, <b>no financial adjustments</b> are made
                  to the Total Price or Ledger.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column: Give Up */}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-gray-700">1. Spots to Give Up</label>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {spotsToRelease.length} Selected
                    </span>
                  </div>

                  <div className="border border-red-200 rounded-lg h-64 overflow-y-auto bg-white">
                    {currentSpots.length === 0 ? (
                      <div className="p-4 text-center text-sm text-gray-500 mt-10">
                        No spots currently assigned to this booking.
                      </div>
                    ) : (
                      currentSpots.map(spot => {
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
                            <div className="flex-1 min-w-0">
                              <span className={`font-bold text-sm ${isChecked ? 'text-red-900' : 'text-gray-900'}`}>{spot.label}</span>
                              {(spot.level || spot.zone) && <span className="text-xs text-gray-500 ml-2">{[spot.level, spot.zone].filter(Boolean).join(' · ')}</span>}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Claim */}
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-bold text-gray-700">2. Spots to Claim</label>
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {spotsToClaim.length} Selected
                    </span>
                  </div>

                  <div className="border border-green-200 rounded-lg h-64 overflow-y-auto bg-white">
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
                            <div className="flex-1 min-w-0">
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

              <div>
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
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex gap-3 shrink-0">
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
