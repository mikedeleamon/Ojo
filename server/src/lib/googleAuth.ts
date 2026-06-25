/**
 * googleAuth.ts — Sign in with Google ID-token verification.
 *
 * Flow (mirrors appleAuth.ts):
 *  1. The app runs the native Google Sign-In flow and gets back an `idToken`
 *     (a JWT signed by Google).
 *  2. The app POSTs the token to /api/auth/google.
 *  3. This module verifies the JWT against Google's public certs, checking the
 *     signature, issuer, audience (our OAuth client ID), and expiry.
 *  4. The caller can then trust the `sub` and `email` claims.
 *
 * `google-auth-library` ships transitively with `googleapis` (already a
 * server dependency for the Gmail Trip Planner), so there's nothing new to
 * install on the backend.
 */

import { OAuth2Client } from 'google-auth-library';

const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

// A single reusable client — it caches Google's signing certs internally.
const client = new OAuth2Client();

export interface GoogleIdentityClaims {
  sub:    string;       // Google's stable per-user identifier
  email?: string;       // Present when the email scope is granted
  email_verified?: boolean;
  name?:  string;
  given_name?:  string;
  family_name?: string;
}

/**
 * Verify a Google ID token. Resolves with the claims if and only if:
 *  - the signature matches one of Google's current certs
 *  - `iss` is a recognised Google issuer
 *  - `aud` matches one of the supplied client IDs (iOS / Android / Web)
 *  - the token is not expired
 *
 * `allowedAudiences` must contain every OAuth client ID the app may present
 * (e.g. the iOS client ID, the Android client ID, and the Web client ID used
 * for `idToken` issuance).
 */
export async function verifyGoogleIdToken(
  idToken: string,
  allowedAudiences: string[],
): Promise<GoogleIdentityClaims> {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: allowedAudiences,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error('Google ID token had no payload');
  if (!payload.iss || !GOOGLE_ISSUERS.includes(payload.iss)) {
    throw new Error(`Unexpected Google token issuer: ${payload.iss}`);
  }
  if (!payload.sub) throw new Error('Google ID token missing `sub` claim');

  return {
    sub:            payload.sub,
    email:          payload.email,
    email_verified: payload.email_verified,
    name:           payload.name,
    given_name:     payload.given_name,
    family_name:    payload.family_name,
  };
}
