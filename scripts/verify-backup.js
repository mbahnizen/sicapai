/**
 * Backup verification - downloads the newest backup from R2 and reads it back.
 *
 * A backup nobody has ever restored is not a backup. This proves three things
 * the upload alone cannot: the object is really there, it still decompresses,
 * and it parses into the shape a restore would need.
 *
 * Usage:
 *   node scripts/verify-backup.js                 # newest object in the bucket
 *   node scripts/verify-backup.js <object-key>    # a specific one
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { gunzipSync } from 'zlib';
import 'dotenv/config';

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;

const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET })
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const list = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET }));
const objects = list.Contents ?? [];

console.log(`\n  r2://${R2_BUCKET} - ${objects.length} objek\n`);
for (const o of objects.slice(-5)) {
  console.log(`    ${o.Key}  (${(o.Size / 1024).toFixed(1)} KB)`);
}

const key = process.argv[2] ?? objects.sort((a, b) => b.LastModified - a.LastModified)[0]?.Key;
if (!key) {
  console.error('\n  Bucket kosong - tidak ada yang bisa diverifikasi.');
  process.exit(1);
}

const got = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
const data = JSON.parse(gunzipSync(Buffer.from(await got.Body.transformToByteArray())));

const counts = Object.entries(data.collections).map(([k, v]) => `${k}=${v.length}`);
const timestamps = (JSON.stringify(data).match(/"__type":"timestamp"/g) || []).length;

console.log(`\n  Baca ulang: ${key}`);
console.log(`    project    : ${data.project}`);
console.log(`    exportedAt : ${data.exportedAt}`);
console.log(`    totalDocs  : ${data.totalDocs}`);
console.log(`    koleksi    : ${counts.join(', ')}`);
console.log(`    timestamp  : ${timestamps} tersimpan bertipe`);

// A file that unzips but contains nothing would still "pass" a naive check.
const sum = Object.values(data.collections).reduce((n, v) => n + v.length, 0);
if (sum !== data.totalDocs || sum === 0) {
  console.error(`\n  RUSAK: totalDocs=${data.totalDocs} tapi isi sebenarnya ${sum}.`);
  process.exit(1);
}

console.log('\n  RESTORE OK - berkas utuh dan bisa dibaca kembali.\n');
