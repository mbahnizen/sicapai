/**
 * Quota Service — 20 AI generations per user per week
 */

import { db } from '../middleware/auth.js';

const WEEKLY_LIMIT = 20;

/**
 * Check quota availability without deducting.
 * Call this before the expensive AI operation.
 * @param {string} userId
 * @returns {Promise<boolean>} true if quota is available
 */
export async function checkQuota(userId) {
  const ref = db.collection('quotas').doc(userId);
  const doc = await ref.get();
  if (!doc.exists) return true;

  const data = doc.data();
  const now = new Date();
  const weekStart = getWeekStart(now);
  const storedWeekStart = data.weekStartDate?.toDate
    ? data.weekStartDate.toDate()
    : new Date(data.weekStartDate);

  if (weekStart.getTime() > storedWeekStart.getTime()) return true;
  return data.weeklyUsed < WEEKLY_LIMIT;
}

/**
 * Deduct one quota use. Call this only after AI generation succeeds.
 * @param {string} userId
 */
export async function deductQuota(userId) {
  const ref = db.collection('quotas').doc(userId);
  const doc = await ref.get();
  const now = new Date();
  const weekStart = getWeekStart(now);

  if (!doc.exists) {
    await ref.set({ weeklyUsed: 1, weekStartDate: weekStart, totalLifetime: 1 });
    return;
  }

  const data = doc.data();
  const storedWeekStart = data.weekStartDate?.toDate
    ? data.weekStartDate.toDate()
    : new Date(data.weekStartDate);

  if (weekStart.getTime() > storedWeekStart.getTime()) {
    await ref.update({ weeklyUsed: 1, weekStartDate: weekStart, totalLifetime: (data.totalLifetime || 0) + 1 });
  } else {
    await ref.update({ weeklyUsed: data.weeklyUsed + 1, totalLifetime: (data.totalLifetime || 0) + 1 });
  }
}

/**
 * @deprecated Use checkQuota + deductQuota separately.
 * Kept for reference only — no longer called.
 */
export async function checkAndDeductQuota(userId) {
  const ok = await checkQuota(userId);
  if (ok) await deductQuota(userId);
  return ok;
}

/**
 * Get quota status for a user
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getQuotaStatus(userId) {

  const ref = db.collection('quotas').doc(userId);
  const doc = await ref.get();
  const now = new Date();
  const weekStart = getWeekStart(now);

  if (!doc.exists) {
    return { weeklyUsed: 0, limit: WEEKLY_LIMIT, remaining: WEEKLY_LIMIT };
  }

  const data = doc.data();
  const storedWeekStart = data.weekStartDate?.toDate
    ? data.weekStartDate.toDate()
    : new Date(data.weekStartDate);

  // If new week, quota is reset
  const used = weekStart.getTime() > storedWeekStart.getTime() ? 0 : data.weeklyUsed;

  return {
    weeklyUsed: used,
    limit: WEEKLY_LIMIT,
    remaining: WEEKLY_LIMIT - used,
  };
}

/**
 * Get the start of the current week (Monday 00:00:00 UTC+7)
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
