/**
 * Vercel serverless entrypoint for SiCAPAI.
 *
 * Vercel does not run `node server/index.js` as a long-lived process — it
 * imports this file and invokes the exported handler per request. The Express
 * app is reused as-is; `server/index.js` skips `app.listen()` when it detects
 * the Vercel runtime, so the same file still works under Docker/Cloud Run.
 *
 * Routing lives in vercel.json: only /api/* and /__/auth/* reach this function.
 * Static assets and the SPA fallback are served directly by Vercel from dist/.
 */

import app from '../server/index.js';

export default app;
