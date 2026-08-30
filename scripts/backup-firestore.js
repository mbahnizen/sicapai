/**
 * Firestore backup — dumps every collection to a single gzipped JSON file
 * and uploads it to Cloudflare R2.
 *
 * Firestore scheduled backups and PITR both require an active billing account.
 * This script is the stopgap: it needs nothing but the service account that the
 * server already uses, and R2's free tier is far larger than this data set.
 *
 * Usage:
 *   node scripts/backup-firestore.js            # dump and upload to R2
 *   node scripts/backup-firestore.js --local    # dump to ./backups only, no upload
 *
 * Required environment (upload mode):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * Credentials for Firestore are read exactly like server/middleware/auth.js:
 *   GOOGLE_APPLICATION_CREDENTIALS (path) or FIREBASE_SERVICE_ACCOUNT (raw JSON)
 */

import admin from 'firebase-admin';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { gzipSync } from 'zlib';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';

// Every top-level collection the server touches. Firestore has no reliable way
// to discover collections that are currently empty, so this list is explicit on
// purpose — add to it when a new collection is introduced.
const COLLECTIONS = [
  'institutions',
  'institution_members',
  'students',
  'reports',
  'progress',
  'quotas',
];

const LOCAL_ONLY = process.argv.includes('--local');

function initFirestore() {
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  let sa;
  if (credentialPath) {
    sa = JSON.parse(readFileSync(resolve(credentialPath), 'utf-8'));
  } else if (credentialJson) {
    sa = JSON.parse(credentialJson);
  } else {
    throw new Error(
      'No Firestore credentials. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.'
    );
  }

  admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });

  // The project is read from the credential, never hard-coded. SiCAPAI has two
  // similarly named Firebase projects, and a backup that merely claims which one
  // it came from is worse than one that does not say at all.
  return { db: admin.firestore(), projectId: sa.project_id };
}

/**
 * Firestore values do not survive a plain JSON.stringify: Timestamps become
 * {_seconds, _nanoseconds}, references become opaque objects, and Buffers
 * become byte arrays. Tag them instead so a restore can rebuild the real types.
 */
function encode(value) {
  if (value === null || value === undefined) return null;

  if (value instanceof admin.firestore.Timestamp) {
    return { __type: 'timestamp', value: value.toDate().toISOString() };
  }
  if (value instanceof admin.firestore.GeoPoint) {
    return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value instanceof admin.firestore.DocumentReference) {
    return { __type: 'ref', path: value.path };
  }
  if (Buffer.isBuffer(value)) {
    return { __type: 'bytes', value: value.toString('base64') };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encode(v)]));
  }
  return value;
}

async function dumpCollection(db, name) {
  const snap = await db.collection(name).get();
  return snap.docs.map((doc) => ({ id: doc.id, data: encode(doc.data()) }));
}

async function main() {
  const { db, projectId } = initFirestore();
  const startedAt = new Date();

  console.log(`
  Project: ${projectId}
`);

  const collections = {};
  let totalDocs = 0;

  for (const name of COLLECTIONS) {
    const docs = await dumpCollection(db, name);
    collections[name] = docs;
    totalDocs += docs.length;
    console.log(`  ${name.padEnd(22)} ${String(docs.length).padStart(5)} docs`);
  }

  const payload = {
    schemaVersion: 1,
    project: projectId,
    exportedAt: startedAt.toISOString(),
    totalDocs,
    collections,
  };

  const gz = gzipSync(Buffer.from(JSON.stringify(payload), 'utf-8'));
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const key = `firestore/${projectId}/${startedAt.toISOString().slice(0, 10)}/${projectId}-${stamp}.json.gz`;

  console.log(`\n  ${totalDocs} docs total, ${(gz.length / 1024).toFixed(1)} KB gzipped`);

  // A backup that reports success without containing anything is worse than a
  // loud failure, because it hides the problem until the day you need it.
  if (totalDocs === 0) {
    throw new Error('Refusing to store an empty backup — every collection came back with 0 docs.');
  }

  if (LOCAL_ONLY) {
    mkdirSync('backups', { recursive: true });
    const out = `backups/${projectId}-${stamp}.json.gz`;
    writeFileSync(out, gz);
    console.log(`  written to ${out} (local only, not uploaded)`);
    return;
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: gz,
    ContentType: 'application/json',
    ContentEncoding: 'gzip',
  }));

  console.log(`  uploaded to r2://${R2_BUCKET}/${key}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backup failed:', err.message);
    process.exit(1);
  });
