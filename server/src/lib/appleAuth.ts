/**
 * appleAuth.ts — Sign in with Apple identity-token verification.
 *
 * Flow:
 *  1. The app calls AppleAuthentication.signInAsync() and gets back an
 *     `identityToken` (a JWT signed by Apple).
 *  2. The app POSTs the token to /api/auth/apple.
 *  3. This module verifies the JWT by fetching Apple's public JWKs, checking
 *     the signature, issuer, audience (our bundle ID), and expiry.
 *  4. The caller can then trust the `sub` and `email` claims.
 */

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

const APPLE_ISSUER  = 'https://appleid.apple.com';
const APPLE_JWKS    = 'https://appleid.apple.com/auth/keys';

// JWK cache: keys rotate rarely, so we cache aggressively and only refetch
// on a cache miss (jwks-rsa handles this internally).
const client = jwksClient({
  jwksUri: APPLE_JWKS,
  cache: true,
  cacheMaxAge: 24 * 60 * 60 * 1000, // 24h
  rateLimit: true,
  jwksRequestsPerMinute: 10,
});

function getKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback): void {
  if (!header.kid) {
    callback(new Error('No `kid` in Apple identity token header'));
    return;
  }
  client.getSigningKey(header.kid, (err, key) => {
    if (err || !key) { callback(err ?? new Error('No signing key found')); return; }
    callback(null, key.getPublicKey());
  });
}

export interface AppleIdentityClaims {
  sub:    string;       // Apple's stable per-app user identifier
  email?: string;       // Only present if the user agreed to share it
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
}

/**
 * Verify an Apple identity token. Resolves with the claims if and only if:
 *  - the signature matches one of Apple's current JWKs
 *  - `iss === 'https://appleid.apple.com'`
 *  - `aud` matches the supplied bundle identifier
 *  - the token is not expired
 *
 * `expectedAudience` must equal your iOS app's bundle ID (e.g. `com.ojostudio.ojo`).
 */
export function verifyAppleIdentityToken(
  identityToken: string,
  expectedAudience: string,
): Promise<AppleIdentityClaims> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      identityToken,
      getKey,
      {
        algorithms: ['RS256'],
        issuer:     APPLE_ISSUER,
        audience:   expectedAudience,
      },
      (err, decoded) => {
        if (err) return reject(err);
        if (!decoded || typeof decoded === 'string') {
          return reject(new Error('Apple identity token payload was not a JWT object'));
        }
        const sub = (decoded as jwt.JwtPayload).sub;
        if (!sub) return reject(new Error('Apple identity token missing `sub` claim'));
        resolve({
          sub,
          email:            (decoded as any).email,
          email_verified:   (decoded as any).email_verified,
          is_private_email: (decoded as any).is_private_email,
        });
      },
    );
  });
}
