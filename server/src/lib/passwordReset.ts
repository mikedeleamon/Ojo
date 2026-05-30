/**
 * Password reset helpers.
 *
 * Flow:
 *  1. User enters email in the app
 *  2. Server calls `createResetToken(user)`:
 *       - generates a 32-byte random token (raw)
 *       - stores only its SHA-256 hash + expiry on the User document
 *       - returns the raw token to be embedded in the email link
 *  3. Server calls `sendResetEmail(email, deepLink)` to deliver the link.
 *  4. App opens `ojo://reset-password?token=<raw>` from the email.
 *  5. App posts `{ token, newPassword }`; server hashes the supplied token
 *     and looks up a non-expired user with the matching hash, then sets the
 *     new password and bumps `tokenVersion` so existing sessions are revoked.
 *
 * Storing only the hash means a DB leak does not expose live reset codes.
 */

import crypto from 'crypto';

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateResetToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = crypto.randomBytes(32).toString('base64url');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  return { raw, hash, expiresAt };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export function buildResetDeepLink(rawToken: string): string {
  const scheme = process.env.APP_DEEP_LINK_SCHEME ?? 'ojo';
  return `${scheme}://reset-password?token=${encodeURIComponent(rawToken)}`;
}

/**
 * Send the reset-password email.
 *
 * TODO: wire to a real email provider (SendGrid / Resend / SES / Postmark).
 * For now this logs the link so flows can be tested end-to-end in dev.
 *
 * When you implement this, do NOT throw on send failure — the route below
 * always returns 204 to avoid leaking which emails are registered.
 */
export async function sendResetEmail(email: string, deepLink: string): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[passwordReset] sendResetEmail is not wired to a provider — set up SendGrid/Resend before production.');
  }
  console.log(`[passwordReset] reset link for ${email}: ${deepLink}`);
}
