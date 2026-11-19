import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../../supabase';
import type { Booking, ParkingSpot } from '../../types';
import { X, Loader2, PlusCircle, DollarSign } from 'lucide-react';
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

interface PropertyParkingMeta {
  id: string;
  parkingPrice: number | string | null;
  parkingInventory: ParkingSpot[];
}

interface AddParkingModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onComplete?: () => void;
}

export default function AddParkingModal({ isOpen, onClose, booking, onComplete }: AddParkingModalProps) {
  const { userProfile } = useGlobalState();
  const adminUid = userProfile?.uid;
  const adminName = userProfile?.displayName || 'Admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [property, setProperty] = useState<PropertyParkingMeta | null>(null);

  const [availableSpots, setAvailableSpots] = useState<ParkingSpot[]>([]);
  const [selectedSpots, setSelectedSpots] = useState<string[]>([]);

  const [additionAmount, setAdditionAmount] = useState<number | string>(0);
  const [adjustLedger, setAdjustLedger] = useState(true);
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!isOpen || !booking) return;

    setLoading(true);
    setNotes('Client requested additional parking mid-booking.');
    setSelectedSpots([]);

    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() + 14);
    setInvoiceDueDate(defaultDate.toISOString().split('T')[0] ?? '');

    void (async () => {
      try {
        const fresh = await fetchFreshPropertyAndActiveBookings(booking.propertyId);
        const snapshot = computePropertyAllocationSnapshot(
          fresh.property,
          fresh.activeBookings
        );
        setProperty({
          id: fresh.property.id || fresh.propertyRow.id,
          parkingPrice: (fresh.propertyRow.parking_price as number | string | null) ?? null,
          parkingInventory: fresh.property.parkingInventory ?? [],
        });
        setAvailableSpots(snapshot.availableParkingSpots);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load property data.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, booking]);

  // Update suggested price when spots are selected
  useEffect(() => {
    if (property) {
      const pPrice = Number(property.parkingPrice) || 0;
      setAdditionAmount(pPrice * selectedSpots.length);
    }
  }, [selectedSpots, property]);

  if (!isOpen || !booking) return null;

  const toggleSpot = (spotId: string): void => {
    if (selectedSpots.includes(spotId)) {
      setSelectedSpots(prev => prev.filter(id => id !== spotId));
    } else {
      setSelectedSpots(prev => [...prev, spotId]);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (booking.status === 'Cancelled') {
      toast.error('Cancelled bookings cannot be assigned parking spots.');
      return;
    }
    const selectedNormalized = normalizeParkingSpotIds(selectedSpots);
    if (selectedNormalized.length === 0) {
      toast.error("Please select at least one parking spot.");
      return;
    }

    setSubmitting(true);
    try {
      const [{ data: freshBooking, error: fbErr }, fresh] = await Promise.all([
        supabase
          .from('bookings')
          .select('status, parking_spot_ids, parking_included, total_price, balance_due')
          .eq('id', booking.id)
          .single(),
        fetchFreshPropertyAndActiveBookings(booking.propertyId),
      ]);
      if (fbErr) throw fbErr;
      if (freshBooking?.status === 'Cancelled') {
        throw new Error('Cancelled bookings cannot be assigned parking spots.');
      }

      const existingSpotIds = normalizeParkingSpotIds(
        freshBooking?.parking_spot_ids ?? booking.parkingSpotIds
      );
      const validation = validateParkingAssignment({
        property: fresh.property,
        activeBookings: fresh.activeBookings,
        spotIds: selectedNormalized,
        excludeBookingId: booking.id,
        existingOwnedSpotIds: existingSpotIds,
      });
      if (!validation.ok) {
        const snapshot = computePropertyAllocationSnapshot(
          fresh.property,
          fresh.activeBookings
        );
        setAvailableSpots(snapshot.availableParkingSpots);
        setSelectedSpots([]);
        throw new Error(validation.error);
      }

      // 1. Update Booking Document FIRST and run race check
      const prevTotalPrice = Number(freshBooking?.total_price ?? booking.totalPrice) || 0;
      const prevBalanceDue = Number(freshBooking?.balance_due ?? booking.balanceDue) || 0;
      const addAmount = Number(additionAmount) || 0;
      const newTotalPrice = prevTotalPrice + addAmount;
      const newBalanceDue = prevBalanceDue + addAmount;

      const combinedSpotIds = normalizeParkingSpotIds([...existingSpotIds, ...selectedNormalized]);
      const allSpotsObj = (fresh.property.parkingInventory ?? []).filter(s => combinedSpotIds.includes(s.id));
      const parkingDisplayStr = formatParkingDisplayList(allSpotsObj);

      const { error: bErr } = await supabase.from('bookings').update({
        parking_spot_ids: combinedSpotIds,
        parking_included: parkingDisplayStr,
        total_price: newTotalPrice,
        balance_due: newBalanceDue,
        last_updated_by: adminUid,
        updated_at: new Date().toISOString()
      }).eq('id', booking.id);
      if (bErr) throw bErr;

      const conflictCheck = await detectConcurrentAllocationConflict({
        propertyId: booking.propertyId,
        bookingId: booking.id,
        parkingSpotIds: combinedSpotIds,
        mode: 'update',
      });
      if (conflictCheck.hasConflict) {
        await supabase.from('bookings').update({
          parking_spot_ids: existingSpotIds,
          parking_included: freshBooking?.parking_included ?? booking.parkingIncluded ?? null,
          total_price: prevTotalPrice,
          balance_due: prevBalanceDue,
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
          setSelectedSpots([]);
        } catch {
          // ignore secondary refresh failure
        }
        throw new Error(
          conflictCheck.message ||
            'One or more parking spots were just assigned to another booking.'
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
      const addedLabels = validation.spots.map(s => s.label).join(', ');
      await supabase.from('booking_activity_log').insert({
        booking_id: booking.id,
        type: 'Parking Added & Price Adjusted',
        message: `Added parking spots: [${addedLabels}]. Total price increased by ৳${addAmount.toLocaleString('en-IN')}.${notes ? ` Reason: ${notes}` : ''}`,
        actor_name: adminName,
        actor_id: adminUid
      });

      // 4. Adjust Ledger (Create a debit note/invoice)
      if (adjustLedger && addAmount > 0) {
        await supabase.from('booking_payments').insert({
          booking_id: booking.id,
          type: 'Add-on Invoice (Parking)',
          due_date: (invoiceDueDate ? new Date(invoiceDueDate) : new Date()).toISOString().split('T')[0],
          scheduled_amount: addAmount,
          received_amount: 0,
          payment_mode: 'Cash',
          status: 'Scheduled',
          notes: `Invoice for adding parking mid-booking.${notes ? ` Note: ${notes}` : ''}`,
          recorded_by: adminUid
        });
      }

      toast.success('Parking spots successfully added to booking.');
      onComplete?.();
      onClose();
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to add parking: ${msg}`);
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
