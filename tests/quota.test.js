import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDb, mockStore, mockTransaction } = vi.hoisted(() => {
  const mockStore = new Map();

  const mockTransaction = {
    get: vi.fn(async (ref) => {
      const data = mockStore.get(ref.path);
      return {
        exists: data !== undefined,
        data: () => (data ? { ...data } : undefined),
      };
    }),
    set: vi.fn((ref, data) => {
      mockStore.set(ref.path, { ...data });
    }),
    update: vi.fn((ref, data) => {
      const existing = mockStore.get(ref.path) || {};
      mockStore.set(ref.path, { ...existing, ...data });
    }),
  };

  const createDocRef = (path) => ({
    path,
    get: vi.fn(async () => {
      const data = mockStore.get(path);
      return {
        exists: data !== undefined,
        data: () => (data ? { ...data } : undefined),
      };
    }),
  });

  const mockDb = {
    collection: vi.fn((collectionName) => ({
      doc: vi.fn((docId) => createDocRef(`${collectionName}/${docId}`)),
    })),
    runTransaction: vi.fn(async (updateFunction) => {
      return updateFunction(mockTransaction);
    }),
  };

  return { mockDb, mockStore, mockTransaction };
});

// Mock auth middleware module so initializeApp is never called
vi.mock('../server/middleware/auth.js', () => ({
  db: mockDb,
}));

import {
  checkAndDeductQuotaAtomic,
  checkQuota,
  getQuotaStatus,
} from '../server/services/quota.js';

// Helper to compute expected Monday 00:00:00 week start
function getWeekStartHelper(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Helper to create Firestore Timestamp-like objects with .toDate()
function createFirestoreTimestamp(date) {
  return {
    toDate: () => new Date(date),
  };
}

describe('Quota Service', () => {
  const FIXED_NOW = new Date('2026-06-10T10:30:00.000Z'); // Wednesday
  let currentWeekStart;
  let previousWeekStart;
  let olderWeekStart;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);

    currentWeekStart = getWeekStartHelper(FIXED_NOW);
    previousWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    olderWeekStart = new Date(currentWeekStart.getTime() - 14 * 24 * 60 * 60 * 1000);

    mockStore.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkAndDeductQuotaAtomic', () => {
    it('creates quota document with weeklyUsed: 1 and totalLifetime: 1 when document does not exist', async () => {
      const userId = 'user-new-1';
      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.set).toHaveBeenCalledTimes(1);
      expect(mockTransaction.update).not.toHaveBeenCalled();

      const docRefPath = `quotas/${userId}`;
      expect(mockTransaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 1,
          weekStartDate: currentWeekStart,
          totalLifetime: 1,
        }
      );

      const saved = mockStore.get(docRefPath);
      expect(saved).toEqual({
        weeklyUsed: 1,
        weekStartDate: currentWeekStart,
        totalLifetime: 1,
      });
    });

    it('increments weeklyUsed and totalLifetime when in same week and below limit (weeklyUsed: 1 -> 2)', async () => {
      const userId = 'user-existing-1';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 1,
        weekStartDate: currentWeekStart,
        totalLifetime: 5,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
      expect(mockTransaction.set).not.toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 2,
          totalLifetime: 6,
        }
      );

      const saved = mockStore.get(docRefPath);
      expect(saved.weeklyUsed).toBe(2);
      expect(saved.totalLifetime).toBe(6);
    });

    it('increments weeklyUsed and totalLifetime at boundary just below limit (weeklyUsed: 19 -> 20)', async () => {
      const userId = 'user-existing-19';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 19,
        weekStartDate: currentWeekStart,
        totalLifetime: 19,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 20,
          totalLifetime: 20,
        }
      );

      const saved = mockStore.get(docRefPath);
      expect(saved.weeklyUsed).toBe(20);
      expect(saved.totalLifetime).toBe(20);
    });

    it('handles missing totalLifetime on existing document by defaulting to 0 + 1', async () => {
      const userId = 'user-no-lifetime';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 3,
        weekStartDate: currentWeekStart,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 4,
          totalLifetime: 1,
        }
      );
    });

    it('returns false and writes nothing when in same week and weeklyUsed is at limit (20)', async () => {
      const userId = 'user-limit-reached';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 20,
        weekStartDate: currentWeekStart,
        totalLifetime: 20,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
      expect(mockTransaction.update).not.toHaveBeenCalled();

      const saved = mockStore.get(docRefPath);
      expect(saved.weeklyUsed).toBe(20);
      expect(saved.totalLifetime).toBe(20);
    });

    it('returns false and writes nothing when in same week and weeklyUsed is above limit (25)', async () => {
      const userId = 'user-above-limit';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 25,
        weekStartDate: currentWeekStart,
        totalLifetime: 35,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(false);
      expect(mockTransaction.set).not.toHaveBeenCalled();
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });

    it('resets weeklyUsed to 1 and keeps accumulating totalLifetime when stored week is older than current week', async () => {
      const userId = 'user-old-week';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 20,
        weekStartDate: previousWeekStart,
        totalLifetime: 50,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledTimes(1);
      expect(mockTransaction.set).not.toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 1,
          weekStartDate: currentWeekStart,
          totalLifetime: 51,
        }
      );

      const saved = mockStore.get(docRefPath);
      expect(saved.weeklyUsed).toBe(1);
      expect(saved.totalLifetime).toBe(51);
      expect(saved.weekStartDate).toEqual(currentWeekStart);
    });

    it('resets weeklyUsed to 1 and initializes totalLifetime when older week has undefined totalLifetime', async () => {
      const userId = 'user-old-no-lifetime';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 10,
        weekStartDate: olderWeekStart,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 1,
          weekStartDate: currentWeekStart,
          totalLifetime: 1,
        }
      );
    });

    it('reads weekStartDate correctly when formatted as a Firestore Timestamp (with .toDate())', async () => {
      const userId = 'user-timestamp';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 5,
        weekStartDate: createFirestoreTimestamp(currentWeekStart),
        totalLifetime: 15,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 6,
          totalLifetime: 16,
        }
      );
    });

    it('reads weekStartDate correctly when formatted as a Firestore Timestamp from an older week', async () => {
      const userId = 'user-timestamp-old';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 20,
        weekStartDate: createFirestoreTimestamp(previousWeekStart),
        totalLifetime: 40,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 1,
          weekStartDate: currentWeekStart,
          totalLifetime: 41,
        }
      );
    });

    it('reads weekStartDate correctly when formatted as an ISO date string', async () => {
      const userId = 'user-iso-date';
      const docRefPath = `quotas/${userId}`;
      mockStore.set(docRefPath, {
        weeklyUsed: 2,
        weekStartDate: currentWeekStart.toISOString(),
        totalLifetime: 8,
      });

      const result = await checkAndDeductQuotaAtomic(userId);

      expect(result).toBe(true);
      expect(mockTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ path: docRefPath }),
        {
          weeklyUsed: 3,
          totalLifetime: 9,
        }
      );
    });
  });

  describe('checkQuota', () => {
    it('returns true when no quota document exists', async () => {
      const result = await checkQuota('non-existent-user');
      expect(result).toBe(true);
    });

    it('returns true when in same week and weeklyUsed is below limit (e.g. 0)', async () => {
      mockStore.set('quotas/user-0', {
        weeklyUsed: 0,
        weekStartDate: currentWeekStart,
      });
      const result = await checkQuota('user-0');
      expect(result).toBe(true);
    });

    it('returns true when in same week and weeklyUsed is 19', async () => {
      mockStore.set('quotas/user-19', {
        weeklyUsed: 19,
        weekStartDate: currentWeekStart,
      });
      const result = await checkQuota('user-19');
      expect(result).toBe(true);
    });

    it('returns false when in same week and weeklyUsed is exactly at limit (20)', async () => {
      mockStore.set('quotas/user-20', {
        weeklyUsed: 20,
        weekStartDate: currentWeekStart,
      });
      const result = await checkQuota('user-20');
      expect(result).toBe(false);
    });

    it('returns false when in same week and weeklyUsed exceeds limit (25)', async () => {
      mockStore.set('quotas/user-25', {
        weeklyUsed: 25,
        weekStartDate: currentWeekStart,
      });
      const result = await checkQuota('user-25');
      expect(result).toBe(false);
    });

    it('returns true when stored week is older than current week even if weeklyUsed was 20', async () => {
      mockStore.set('quotas/user-old-exhausted', {
        weeklyUsed: 20,
        weekStartDate: previousWeekStart,
      });
      const result = await checkQuota('user-old-exhausted');
      expect(result).toBe(true);
    });

    it('supports weekStartDate as a Firestore Timestamp with .toDate()', async () => {
      mockStore.set('quotas/user-timestamp-check', {
        weeklyUsed: 20,
        weekStartDate: createFirestoreTimestamp(currentWeekStart),
      });
      const result = await checkQuota('user-timestamp-check');
      expect(result).toBe(false);
    });

    it('supports weekStartDate as a plain Date object from older week', async () => {
      mockStore.set('quotas/user-date-check', {
        weeklyUsed: 20,
        weekStartDate: new Date(olderWeekStart),
      });
      const result = await checkQuota('user-date-check');
      expect(result).toBe(true);
    });
  });

  describe('getQuotaStatus', () => {
    it('returns default full quota when document does not exist', async () => {
      const status = await getQuotaStatus('new-user');

      expect(status).toEqual({
        weeklyUsed: 0,
        limit: 20,
        remaining: 20,
      });
      expect(status.limit).toBe(20);
      expect(status.remaining).toBe(20);
      expect(status.weeklyUsed).toBe(0);
    });

    it('returns correct remaining quota for same week with partial usage (weeklyUsed: 7)', async () => {
      mockStore.set('quotas/user-used-7', {
        weeklyUsed: 7,
        weekStartDate: currentWeekStart,
      });

      const status = await getQuotaStatus('user-used-7');

      expect(status).toEqual({
        weeklyUsed: 7,
        limit: 20,
        remaining: 13,
      });
      expect(status.limit).toBe(20);
      expect(status.remaining).toBe(20 - 7);
    });

    it('returns 0 remaining when weeklyUsed is at limit (20)', async () => {
      mockStore.set('quotas/user-used-20', {
        weeklyUsed: 20,
        weekStartDate: currentWeekStart,
      });

      const status = await getQuotaStatus('user-used-20');

      expect(status).toEqual({
        weeklyUsed: 20,
        limit: 20,
        remaining: 0,
      });
      expect(status.limit).toBe(20);
      expect(status.remaining).toBe(0);
    });

    it('resets weeklyUsed to 0 and remaining to limit when stored week is older than current week', async () => {
      mockStore.set('quotas/user-old-status', {
        weeklyUsed: 20,
        weekStartDate: previousWeekStart,
      });

      const status = await getQuotaStatus('user-old-status');

      expect(status).toEqual({
        weeklyUsed: 0,
        limit: 20,
        remaining: 20,
      });
      expect(status.weeklyUsed).toBe(0);
      expect(status.limit).toBe(20);
      expect(status.remaining).toBe(20);
    });

    it('supports weekStartDate as a Firestore Timestamp with .toDate()', async () => {
      mockStore.set('quotas/user-ts-status', {
        weeklyUsed: 8,
        weekStartDate: createFirestoreTimestamp(currentWeekStart),
      });

      const status = await getQuotaStatus('user-ts-status');

      expect(status).toEqual({
        weeklyUsed: 8,
        limit: 20,
        remaining: 12,
      });
    });

    it('supports weekStartDate as an ISO string from an older week', async () => {
      mockStore.set('quotas/user-iso-old-status', {
        weeklyUsed: 15,
        weekStartDate: olderWeekStart.toISOString(),
      });

      const status = await getQuotaStatus('user-iso-old-status');

      expect(status).toEqual({
        weeklyUsed: 0,
        limit: 20,
        remaining: 20,
      });
    });
  });
});
