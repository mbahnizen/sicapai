/**
 * Auth Middleware — Verify Firebase JWT via Admin SDK
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Initialize Firebase Admin (singleton)
if (!admin.apps.length) {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialJson  = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (credentialPath) {
    // Local dev: path to service-account.json file
    const serviceAccount = JSON.parse(readFileSync(resolve(credentialPath), 'utf-8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else if (credentialJson) {
    // Cloud Run: service account JSON passed as env var string
    const serviceAccount = JSON.parse(credentialJson);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
  } else {
    // Cloud Run with ADC: service account attached via IAM — no JSON needed
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
}

export const db = admin.firestore();
export const firebaseAdmin = admin;

/**
 * Express middleware — verifies Firebase ID token from Authorization header
 */
export async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token autentikasi diperlukan' });
  }

  const token = authHeader.split('Bearer ')[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name || decoded.email,
    };
    next();
  } catch (error) {
    console.error('Auth verification failed:', error.message);
    return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa' });
  }
}

/**
 * Validates if a user is a member of a specific institution
 * @param {string} userId - User UID
 * @param {string} institutionId - Institution ID
 * @returns {Promise<boolean>}
 */
export async function checkMembership(userId, institutionId) {
  if (!userId || !institutionId) return false;
  
  const snap = await db.collection('institution_members')
    .where('userId', '==', userId)
    .where('institutionId', '==', institutionId)
    .limit(1)
    .get();
    
  return !snap.empty;
}
