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
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
 * Send the reset-password email via Resend.
 *
 * Does NOT throw on send failure — the route always returns 204 to avoid
 * leaking which email addresses are registered in the system.
 *
 * Requires RESEND_API_KEY in the environment.
 * The FROM address must match a domain you have verified in Resend.
 * During development you can use the Resend sandbox: onboarding@resend.dev
 * (sends only to your own verified email address).
 */
export async function sendResetEmail(email: string, deepLink: string): Promise<void> {
  const from = process.env.RESEND_FROM_EMAIL ?? 'Ojo <noreply@ojoapp.io>';

  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: 'Reset your Ojo password',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <img src="https://ojoapp.io/logo.png" alt="Ojo" width="64" style="margin-bottom:24px;" />
          <h2 style="margin:0 0 8px;font-size:22px;color:#111;">Reset your password</h2>
          <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.5;">
            We received a request to reset the password for your Ojo account.
            Tap the button below — this link expires in <strong>1 hour</strong>.
          </p>
          <a href="${deepLink}"
             style="display:inline-block;padding:14px 28px;background:#87DE5A;color:#111;
                    font-weight:600;font-size:15px;border-radius:10px;text-decoration:none;">
            Reset password
          </a>
          <p style="margin:24px 0 0;color:#999;font-size:13px;line-height:1.5;">
            If you didn't request this, you can safely ignore this email.
            Your password will not change.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[passwordReset] Resend error:', error);
    }
  } catch (err) {
    // Never surface send errors to the caller — the route always returns 204
    console.error('[passwordReset] sendResetEmail failed:', err);
  }
}
