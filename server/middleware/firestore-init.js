/**
 * Firestore initialization helper
 */

let db = null;

export async function getFirestore() {
  if (db) return db;

  const { getAdmin } = await import('./auth.js');
  const admin = await getAdmin();
  db = admin.firestore();
  return db;
}
