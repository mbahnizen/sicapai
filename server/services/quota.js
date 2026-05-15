/**
 * Quota Service — 20 AI generations per user per week
 */

import { db } from '../middleware/auth.js';

const WEEKLY_LIMIT = 20;

/**
 * Check and deduct quota for a user
 * @param {string} userId
 * @returns {Promise<boolean>} true if quota available and deducted
 */
export async function checkAndDeductQuota(userId) {

  const ref = db.collection('quotas').doc(userId);

  const doc = await ref.get();
  const now = new Date();
  const weekStart = getWeekStart(now);

  if (!doc.exists) {
    // First time user — create quota doc
    await ref.set({
      weeklyUsed: 1,
      weekStartDate: weekStart,
      totalLifetime: 1,
    });
    return true;
  }

  const data = doc.data();
  const storedWeekStart = data.weekStartDate?.toDate
    ? data.weekStartDate.toDate()
    : new Date(data.weekStartDate);

  // Check if we're in a new week
  if (weekStart.getTime() > storedWeekStart.getTime()) {
    // Reset weekly counter
    await ref.update({
      weeklyUsed: 1,
      weekStartDate: weekStart,
      totalLifetime: (data.totalLifetime || 0) + 1,
    });
    return true;
  }

  // Same week — check limit
  if (data.weeklyUsed >= WEEKLY_LIMIT) {
    return false;
  }

  // Deduct
  await ref.update({
    weeklyUsed: data.weeklyUsed + 1,
    totalLifetime: (data.totalLifetime || 0) + 1,
  });
  return true;
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
