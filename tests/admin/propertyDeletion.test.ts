import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Property } from '../../src/types';

type MockHandler = () => Promise<{ data: unknown; error: unknown }>;

interface RecordedCall {
  table: string;
  op: 'select' | 'update' | 'delete';
  payload?: unknown;
  filters: Array<{ method: string; col: string; val: unknown }>;
}

const { recordedCalls, queuedResults, fromMock } = vi.hoisted(() => {
  const calls: RecordedCall[] = [];
  const queue = new Map<string, MockHandler[]>();

  const popResult = (table: string, op: 'select' | 'update' | 'delete'): Promise<{ data: unknown; error: unknown }> => {
    const key = `${table}:${op}`;
    const list = queue.get(key);
    if (list && list.length > 0) {
      const next = list.shift()!;
      return next();
    }
    return Promise.resolve({ data: [], error: null });
  };

  const makeBuilder = (table: string, op: 'select' | 'update' | 'delete', payload?: unknown) => {
    const call: RecordedCall = { table, op, payload, filters: [] };
    calls.push(call);

    const builder: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        call.filters.push({ method: 'eq', col, val });
        return builder;
      },
      neq(col: string, val: unknown) {
        call.filters.push({ method: 'neq', col, val });
        return builder;
      },
      in(col: string, val: unknown) {
        call.filters.push({ method: 'in', col, val });
        return builder;
      },
      select() {
        return builder;
      },
      maybeSingle() {
        return popResult(table, op);
      },
      single() {
        return popResult(table, op);
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return popResult(table, op).then(onFulfilled, onRejected);
      },
    };
    return builder;
  };

  const from = vi.fn((table: string) => ({
    select: () => makeBuilder(table, 'select'),
    update: (payload: unknown) => makeBuilder(table, 'update', payload),
    delete: () => makeBuilder(table, 'delete'),
  }));

  return {
    recordedCalls: calls,
    queuedResults: queue,
    fromMock: from,
  };
});

vi.mock('../../src/supabase', () => ({
  supabase: {
    from: fromMock,
  },
  getCachedAccessToken: vi.fn(() => null),
}));

import {
  collectPropertyMediaUrls,
  deletePropertySafely,
  evaluatePropertyDeletionDependencies,
  filterUnsharedMediaUrls,
} from '../../src/utils/propertyDeletion';

function pushMock(table: string, op: 'select' | 'update' | 'delete', data: unknown, error: unknown = null) {
  const key = `${table}:${op}`;
  const list = queuedResults.get(key) || [];
  list.push(async () => ({ data, error }));
  queuedResults.set(key, list);
}

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    id: 'sapphire-penthouse',
    name: 'The Sapphire Penthouse',
    location: 'Gulshan 2',
    price: '5.5 Crore',
    status: 'Active',
    propertyType: ['Penthouse'],
    beds: 4,
    baths: 5,
    sqft: '4200 Sq. FT',
    buildingType: 'G+12',
    unitsPerFloor: '1',
    totalUnits: '12',
    landArea: '20 Katha',
    architect: 'Studio Nexus',
    parkingAvailable: '2',
    parkingPrice: '500000',
    passengerLifts: '2',
    frontRoadSize: '60 FT',
    totalShare: '12',
    landmarks: 'Gulshan Lake',
    googleMapLink: '',
    completionDate: '2027',
    overview: 'Luxury residence',
    brochureUrl: 'https://abcdefgh.supabase.co/storage/v1/object/public/brochures/sapphire/brochure.pdf',
    amenities: [],
    customAmenities: [],
    availableUnits: [],
    inventory: [],
    parkingInventory: [],
    milestones: [
      {
        id: 'ms-1',
        title: 'Roof Slab',
        date: '2026-11-01',
        description: 'Completed roof slab',
        status: 'completed',
        percentage: 100,
        images: ['https://abcdefgh.supabase.co/storage/v1/object/public/milestones/sapphire/m1.jpg'],
        imageUrl: 'https://abcdefgh.supabase.co/storage/v1/object/public/milestones/sapphire/m2.jpg',
      },
    ],
    images: {
      hero: 'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/hero.jpg',
      map: 'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/map.jpg',
      floorPlan: '',
      video: '',
      gallery: [
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/g1.jpg',
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/hero.jpg', // dup
      ],
    },
    ...overrides,
  };
}

describe('Enterprise-Safe Property Deletion Governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordedCalls.length = 0;
    queuedResults.clear();
  });

  it('collects and deduplicates all property media URLs across images, brochure, and milestones', () => {
    const prop = makeProperty();
    const urls = collectPropertyMediaUrls(prop);
    expect(urls).toHaveLength(6);
    expect(urls).toEqual(
      expect.arrayContaining([
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/hero.jpg',
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/map.jpg',
        'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/g1.jpg',
        'https://abcdefgh.supabase.co/storage/v1/object/public/brochures/sapphire/brochure.pdf',
        'https://abcdefgh.supabase.co/storage/v1/object/public/milestones/sapphire/m1.jpg',
        'https://abcdefgh.supabase.co/storage/v1/object/public/milestones/sapphire/m2.jpg',
      ])
    );
  });

  it('excludes media URLs still referenced by another property', () => {
    const sharedHero =
      'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/new/shared.jpg';
    const ownedGallery =
      'https://abcdefgh.supabase.co/storage/v1/object/public/property-media/sapphire/g1.jpg';

    const result = filterUnsharedMediaUrls(
      [sharedHero, ownedGallery],
      [{ images: { hero: sharedHero, gallery: [] } }]
    );
    expect(result).toEqual([ownedGallery]);
  });

  it('blocks deletion when active bookings or pending booking requests exist', () => {
    const blockedByActive = evaluatePropertyDeletionDependencies({
      bookings: [
        { id: 'b1', booking_ref: 'VN-2026-0001', status: 'Active', client_name: 'Alice' },
        { id: 'b2', booking_ref: 'VN-2026-0002', status: 'On Hold', client_name: 'Bob' },
        { id: 'b3', booking_ref: 'VN-2026-0003', status: 'Cancelled', client_name: 'Carol' },
      ],
      bookingRequests: [{ id: 'r1', status: 'Pending Review', client_name: 'Dave' }],
    });

    expect(blockedByActive.canDelete).toBe(false);
    expect(blockedByActive.blockers).toHaveLength(2);
    expect(blockedByActive.blockers[0]).toContain('#VN-2026-0001');
    expect(blockedByActive.blockers[0]).toContain('#VN-2026-0002');
    expect(blockedByActive.blockers[1]).toContain('1 pending booking request');

    const safeOnlyCancelled = evaluatePropertyDeletionDependencies({
      bookings: [{ id: 'b3', booking_ref: 'VN-2026-0003', status: 'Cancelled' }],
      bookingRequests: [{ id: 'r2', status: 'Rejected' }, { id: 'r3', status: 'Converted' }],
    });
    expect(safeOnlyCancelled.canDelete).toBe(true);
    expect(safeOnlyCancelled.cancelledBookingIds).toEqual(['b3']);
    expect(safeOnlyCancelled.processedRequestIds).toEqual(['r2', 'r3']);
  });

  it('does NOT delete DB row or Storage media when active bookings exist', async () => {
    pushMock('bookings', 'select', [
      { id: 'b1', booking_ref: 'VN-2026-1001', status: 'Active', client_name: 'Alice' },
    ]);
    pushMock('booking_requests', 'select', []);

    const deleteMediaFn = vi.fn(async () => true);
    const result = await deletePropertySafely({
      property: makeProperty(),
      deleteMediaFn,
    });

    expect(result.deleted).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.error).toContain('#VN-2026-1001');
    expect(deleteMediaFn).not.toHaveBeenCalled();
    expect(recordedCalls.some((c) => c.table === 'properties' && c.op === 'delete')).toBe(false);
  });

  it('does NOT delete DB row or Storage media when pending booking requests exist', async () => {
    pushMock('bookings', 'select', []);
    pushMock('booking_requests', 'select', [{ id: 'req-1', status: 'Pending Review' }]);

    const deleteMediaFn = vi.fn(async () => true);
    const result = await deletePropertySafely({
      property: makeProperty(),
      deleteMediaFn,
    });

    expect(result.deleted).toBe(false);
    expect(result.blocked).toBe(true);
    expect(deleteMediaFn).not.toHaveBeenCalled();
    expect(recordedCalls.some((c) => c.table === 'properties' && c.op === 'delete')).toBe(false);
  });

  it('preserves all Storage media and rolls back detached records when PostgreSQL delete fails or RLS denies (0 rows)', async () => {
    // 1) FK error 23503 case
    pushMock('bookings', 'select', [{ id: 'b-canc', status: 'Cancelled' }]);
    pushMock('booking_requests', 'select', [{ id: 'r-rej', status: 'Rejected' }]);
    pushMock('properties', 'select', { images: {}, brochure_url: null, milestones: [] });
    pushMock('properties', 'select', []);
    pushMock('bookings', 'update', []); // detach ok
    pushMock('booking_requests', 'update', []); // detach ok
    pushMock('properties', 'delete', null, { code: '23503', message: 'violates foreign key' });
    pushMock('bookings', 'update', []); // rollback
    pushMock('booking_requests', 'update', []); // rollback

    const deleteMediaFn = vi.fn(async () => true);
    const fkResult = await deletePropertySafely({
      property: makeProperty(),
      deleteMediaFn,
    });

    expect(fkResult.deleted).toBe(false);
    expect(fkResult.blocked).toBe(true);
    expect(fkResult.error).toContain('All media files were preserved');
    expect(deleteMediaFn).not.toHaveBeenCalled();

    const rollbacks = recordedCalls.filter((c) => c.op === 'update' && c.payload && (c.payload as { property_id: unknown }).property_id === 'sapphire-penthouse');
    expect(rollbacks).toHaveLength(2);

    // 2) Silent RLS denial (no error, 0 rows deleted)
    recordedCalls.length = 0;
    pushMock('bookings', 'select', [{ id: 'b-canc', status: 'Cancelled' }]);
    pushMock('booking_requests', 'select', []);
    pushMock('properties', 'select', { images: {}, brochure_url: null, milestones: [] });
    pushMock('properties', 'select', []);
    pushMock('bookings', 'update', []);
    pushMock('properties', 'delete', []); // 0 rows returned!
    pushMock('bookings', 'update', []); // rollback

    const rlsResult = await deletePropertySafely({
      property: makeProperty(),
      deleteMediaFn,
    });

    expect(rlsResult.deleted).toBe(false);
    expect(rlsResult.error).toContain('All media files were preserved');
    expect(deleteMediaFn).not.toHaveBeenCalled();
  });

  it('detaches cancelled/processed links, deletes DB row FIRST, then cleans only unshared Storage files (handling partial failures)', async () => {
    const events: string[] = [];
    const prop = makeProperty();
    const sharedUrl = prop.images.map;

    pushMock('bookings', 'select', [{ id: 'b-canc', status: 'Cancelled' }]);
    pushMock('booking_requests', 'select', [{ id: 'r-conv', status: 'Converted' }]);
    pushMock('properties', 'select', {
      images: prop.images,
      brochure_url: prop.brochureUrl,
      milestones: prop.milestones,
    });
    // Another property shares `sharedUrl`
    pushMock('properties', 'select', [{ images: { map: sharedUrl } }]);
    pushMock('bookings', 'update', []);
    pushMock('booking_requests', 'update', []);

    const keyDel = 'properties:delete';
    queuedResults.set(keyDel, [
      async () => {
        events.push('db:delete');
        return { data: [{ id: prop.id }], error: null };
      },
    ]);

    const deleteMediaFn = vi.fn(async (url: string) => {
      events.push(`storage:${url}`);
      // Simulate 1 storage file failing
      return !url.endsWith('m2.jpg');
    });

    const result = await deletePropertySafely({ property: prop, deleteMediaFn });

    expect(result).toEqual({
      deleted: true,
      blocked: false,
      deletedMediaCount: 4, // 6 total - 1 shared (map.jpg) - 1 failed (m2.jpg)
      failedMediaCount: 1,
      detachedCancelledBookings: 1,
      detachedProcessedRequests: 1,
    });

    // Strict ordering guarantee: DB row delete completes BEFORE any storage delete starts
    expect(events[0]).toBe('db:delete');
    expect(deleteMediaFn).not.toHaveBeenCalledWith(sharedUrl);
    expect(deleteMediaFn).toHaveBeenCalledTimes(5);
  });
});
