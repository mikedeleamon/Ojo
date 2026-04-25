/**
 * UPDATED CORS SECTION for db/server.ts
 * Replace the existing CORS block (around line 30–33) with this.
 *
 * Why: React Native does NOT send an Origin header (CORS is a browser
 * mechanism). The cors npm package with an explicit origin array passes
 * Origin-less requests through, so RN itself is unaffected. However,
 * Expo web-preview mode and some HTTP debugging tools (Proxyman, Charles)
 * DO send Origin headers that would otherwise be rejected.
 *
 * Changes:
 *  - In development (NODE_ENV !== 'production'), allow any origin via
 *    `origin: true` (reflects the request origin back). This removes
 *    CORS as a variable during local development/testing.
 *  - In production, keep the explicit allowlist from CORS_ORIGINS.
 *  - Added http://localhost:8081 (Expo Metro bundler) to the default
 *    allowlist for web-preview mode.
 */

const isDev = process.env.NODE_ENV !== 'production';

const originsEnv = process.env.CORS_ORIGINS
  ?? 'http://localhost:3000,http://localhost:3001,http://localhost:4000,http://localhost:8081';
const origins = originsEnv.split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: true, // allow all in dev
  credentials: true,
}));
