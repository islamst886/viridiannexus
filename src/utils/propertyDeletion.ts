import { supabase } from '../supabase';
import { deleteMedia } from './supabaseStorage';
import { isActiveAllocationStatus } from './bookingAllocation';
import type { Property } from '../types';

export interface MediaBearingProperty {
  images?: unknown;
  brochureUrl?: string | null;
  brochure_url?: string | null;
  milestones?: unknown;
}

export interface BookingDependencyRow {
  id: string;
  booking_ref?: string | null;
  status?: string | null;
  client_name?: string | null;
}

export interface BookingRequestDependencyRow {
  id: string;
  status?: string | null;
  client_name?: string | null;
}

export interface PropertyDependencyCheckResult {
  canDelete: boolean;
  blockers: string[];
  activeBookings: BookingDependencyRow[];
  cancelledBookingIds: string[];
  pendingRequests: BookingRequestDependencyRow[];
  processedRequestIds: string[];
}

export interface SafePropertyDeletionResult {
  deleted: boolean;
  blocked: boolean;
  error?: string;
  deletedMediaCount: number;
  failedMediaCount: number;
  detachedCancelledBookings: number;
  detachedProcessedRequests: number;
}

export function isPendingBookingRequestStatus(status?: string | null): boolean {
  const normalized = (status ?? '').trim().toLowerCase();
  return normalized === '' || normalized === 'pending' || normalized === 'pending review';
}

function pushMediaStrings(target: Set<string>, value: unknown): void {
  if (!value) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) target.add(trimmed);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      pushMediaStrings(target, item);
    }
    return;
  }
  if (typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      pushMediaStrings(target, nested);
    }
  }
}

/**
 * Extracts and deduplicates all associated media URLs across `images`,
 * `brochureUrl` / `brochure_url`, and `milestones`.
 */
export function collectPropertyMediaUrls(
  property: MediaBearingProperty | null | undefined
): string[] {
  if (!property) return [];
  const urls = new Set<string>();

  if (property.images) {
    pushMediaStrings(urls, property.images);
  }
  pushMediaStrings(urls, property.brochureUrl);
  pushMediaStrings(urls, property.brochure_url);

  if (Array.isArray(property.milestones)) {
    for (const milestone of property.milestones) {
      if (!milestone || typeof milestone !== 'object') continue;
      const rec = milestone as Record<string, unknown>;
      pushMediaStrings(urls, rec.images);
      pushMediaStrings(urls, rec.imageUrl);
      pushMediaStrings(urls, rec.videoUrl);
    }
  }

  return Array.from(urls);
}

/**
 * Excludes any URL that is still referenced by another remaining property so
 * shared media is never wiped when deleting one property.
 */
export function filterUnsharedMediaUrls(
  targetUrls: string[],
  otherProperties: MediaBearingProperty[]
): string[] {
  if (targetUrls.length === 0) return [];
  const referencedElsewhere = new Set<string>();
  for (const prop of otherProperties) {
    for (const url of collectPropertyMediaUrls(prop)) {
      referencedElsewhere.add(url);
    }
  }
  return targetUrls.filter((url) => !referencedElsewhere.has(url));
}

export function evaluatePropertyDeletionDependencies(params: {
  bookings: BookingDependencyRow[];
  bookingRequests: BookingRequestDependencyRow[];
}): PropertyDependencyCheckResult {
  const { bookings, bookingRequests } = params;

  const activeBookings: BookingDependencyRow[] = [];
  const cancelledBookingIds: string[] = [];

  for (const b of bookings) {
    if (isActiveAllocationStatus(b.status)) {
      activeBookings.push(b);
    } else if (b.id) {
      cancelledBookingIds.push(b.id);
    }
  }

  const pendingRequests: BookingRequestDependencyRow[] = [];
  const processedRequestIds: string[] = [];

  for (const r of bookingRequests) {
    if (isPendingBookingRequestStatus(r.status)) {
      pendingRequests.push(r);
    } else if (r.id) {
      processedRequestIds.push(r.id);
    }
  }

  const blockers: string[] = [];
  if (activeBookings.length > 0) {
    const sampleRefs = activeBookings
      .slice(0, 5)
      .map((b) => (b.booking_ref ? `#${b.booking_ref}` : b.client_name || b.id.slice(0, 8)))
      .join(', ');
    const overflow = activeBookings.length > 5 ? ` (+${activeBookings.length - 5} more)` : '';
    blockers.push(
      `Cannot delete property: ${activeBookings.length} active booking(s) still reference it (${sampleRefs}${overflow}). Cancel or reassign those bookings first.`
    );
  }

  if (pendingRequests.length > 0) {
    blockers.push(
      `Cannot delete property: ${pendingRequests.length} pending booking request(s) still reference it. Reject or process those requests first.`
    );
  }

  return {
    canDelete: blockers.length === 0,
    blockers,
    activeBookings,
    cancelledBookingIds,
    pendingRequests,
    processedRequestIds,
  };
}

export async function fetchPropertyDeletionCheck(
  propertyId: string
): Promise<PropertyDependencyCheckResult> {
  const [
    { data: bookingsData, error: bErr },
    { data: requestsData, error: rErr },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, booking_ref, status, client_name')
      .eq('property_id', propertyId),
    supabase
      .from('booking_requests')
      .select('id, status, client_name')
      .eq('property_id', propertyId),
  ]);

  if (bErr) {
    throw new Error(`Unable to verify linked bookings: ${bErr.message}`);
  }
  if (rErr) {
    throw new Error(`Unable to verify booking requests: ${rErr.message}`);
  }

  return evaluatePropertyDeletionDependencies({
    bookings: (bookingsData as BookingDependencyRow[] | null) ?? [],
    bookingRequests: (requestsData as BookingRequestDependencyRow[] | null) ?? [],
  });
}

/**
 * Deletes a property strictly DB-first:
 * 1. Verifies zero active bookings / pending requests block deletion.
 * 2. Collects unshared media URLs from fresh DB state + client object.
 * 3. Detaches historical cancelled bookings / processed requests (with rollback on failure).
 * 4. Deletes the property row in PostgreSQL and verifies deletion succeeded.
 * 5. ONLY after the database confirms deletion, removes unshared Supabase Storage files.
 */
export async function deletePropertySafely(params: {
  property: Property;
  deleteMediaFn?: (url: string) => Promise<boolean>;
}): Promise<SafePropertyDeletionResult> {
  const { property, deleteMediaFn = deleteMedia } = params;

  const check = await fetchPropertyDeletionCheck(property.id);
  if (!check.canDelete) {
    return {
      deleted: false,
      blocked: true,
      error: check.blockers.join(' '),
      deletedMediaCount: 0,
      failedMediaCount: 0,
      detachedCancelledBookings: 0,
      detachedProcessedRequests: 0,
    };
  }

  const [{ data: freshRow }, { data: otherRows }] = await Promise.all([
    supabase
      .from('properties')
      .select('images, brochure_url, milestones')
      .eq('id', property.id)
      .maybeSingle(),
    supabase
      .from('properties')
      .select('images, brochure_url, milestones')
      .neq('id', property.id),
  ]);

  const candidateUrls = Array.from(
    new Set([
      ...collectPropertyMediaUrls(property),
      ...collectPropertyMediaUrls(freshRow as MediaBearingProperty | null),
    ])
  );
  const urlsToDelete = filterUnsharedMediaUrls(
    candidateUrls,
    (otherRows as MediaBearingProperty[] | null) ?? []
  );

  let detachedCancelled: string[] = [];
  let detachedRequests: string[] = [];

  const rollbackDetached = async () => {
    const rollbacks: Array<PromiseLike<unknown>> = [];
    if (detachedCancelled.length > 0) {
      rollbacks.push(
        supabase
          .from('bookings')
          .update({ property_id: property.id })
          .in('id', detachedCancelled)
      );
    }
    if (detachedRequests.length > 0) {
      rollbacks.push(
        supabase
          .from('booking_requests')
          .update({ property_id: property.id })
          .in('id', detachedRequests)
      );
    }
    if (rollbacks.length > 0) {
      await Promise.allSettled(rollbacks);
    }
  };

  if (check.cancelledBookingIds.length > 0) {
    const { error: detachBookingErr } = await supabase
      .from('bookings')
      .update({ property_id: null })
      .in('id', check.cancelledBookingIds);
    if (detachBookingErr) {
      return {
        deleted: false,
        blocked: false,
        error: `Could not detach historical cancelled bookings: ${detachBookingErr.message}`,
        deletedMediaCount: 0,
        failedMediaCount: 0,
        detachedCancelledBookings: 0,
        detachedProcessedRequests: 0,
      };
    }
    detachedCancelled = [...check.cancelledBookingIds];
  }

  if (check.processedRequestIds.length > 0) {
    const { error: detachReqErr } = await supabase
      .from('booking_requests')
      .update({ property_id: null })
      .in('id', check.processedRequestIds);
    if (detachReqErr) {
      await rollbackDetached();
      return {
        deleted: false,
        blocked: false,
        error: `Could not detach processed booking requests: ${detachReqErr.message}`,
        deletedMediaCount: 0,
        failedMediaCount: 0,
        detachedCancelledBookings: 0,
        detachedProcessedRequests: 0,
      };
    }
    detachedRequests = [...check.processedRequestIds];
  }

  // Delete property row in PostgreSQL BEFORE removing any Storage files
  const { data: deletedRows, error: deleteError } = await supabase
    .from('properties')
    .delete()
    .eq('id', property.id)
    .select('id');

  if (deleteError) {
    await rollbackDetached();
    const isFkOrRestrict =
      deleteError.code === '23503' || deleteError.code === '23001';
    return {
      deleted: false,
      blocked: isFkOrRestrict,
      error: isFkOrRestrict
        ? 'Database blocked property deletion because related records (bookings or requests) still reference it. All media files were preserved.'
        : `Database error deleting property: ${deleteError.message}. All media files were preserved.`,
      deletedMediaCount: 0,
      failedMediaCount: 0,
      detachedCancelledBookings: 0,
      detachedProcessedRequests: 0,
    };
  }

  if (!deletedRows || deletedRows.length === 0) {
    await rollbackDetached();
    return {
      deleted: false,
      blocked: false,
      error:
        'Property could not be deleted from the database (admin permission denied or property already removed). All media files were preserved.',
      deletedMediaCount: 0,
      failedMediaCount: 0,
      detachedCancelledBookings: 0,
      detachedProcessedRequests: 0,
    };
  }

  // Only reached once the property row is permanently deleted from PostgreSQL
  let deletedMediaCount = 0;
  let failedMediaCount = 0;

  if (urlsToDelete.length > 0) {
    const outcomes = await Promise.allSettled(urlsToDelete.map((url) => deleteMediaFn(url)));
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled' && outcome.value !== false) {
        deletedMediaCount += 1;
      } else {
        failedMediaCount += 1;
      }
    }
  }

  return {
    deleted: true,
    blocked: false,
    deletedMediaCount,
    failedMediaCount,
    detachedCancelledBookings: detachedCancelled.length,
    detachedProcessedRequests: detachedRequests.length,
  };
}
