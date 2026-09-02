import { Router, Request, Response } from 'express';

/**
 * https landing page for the password-reset email.
 *
 * WHY THIS EXISTS
 * ───────────────
 * The reset email used to link straight at `ojo://reset-password?token=…`.
 * A custom-scheme href is not reliably clickable from an email client — many
 * webmail readers sanitise any href that isn't http(s), so for a large share of
 * users the "Reset password" button rendered as dead text with no way forward.
 * Password reset is also the one flow an App Review tester is most likely to
 * exercise, and the only account-recovery path this app has.
 *
 * So the email now points here, over https, and this page performs the hop to
 * `ojo://reset-password?token=…`, which app/+native-intent.tsx already maps to
 * the reset screen. Exactly the pattern routes/share.ts uses for Instagram's
 * attributionURL — same reason (https required), same handoff.
 *
 * The token is passed straight through and never looked up here: this route
 * does no database work and returns the same page whether the token is live,
 * expired or invented. Validation belongs to POST /api/auth/reset-password,
 * which is where an attacker probing tokens meets the auth rate limiter.
 *
 * A fast-follow worth doing: an Associated Domains entitlement plus a hosted
 * apple-app-site-association would turn this into a real Universal Link and
 * skip the browser hop entirely. The page is the portable fallback either way.
 */
const router = Router();

/**
 * Escape for interpolation into HTML text or a double-quoted attribute.
 * The token is base64url from crypto.randomBytes so it cannot contain any of
 * these, but this page is one `String(req.query.x)` away from reflecting
 * arbitrary input and the escaping must not depend on that staying true.
 */
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function resetHtml(deepLink: string): string {
  const safe = esc(deepLink);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <meta name="referrer" content="no-referrer" />
  <title>Reset your Ojo password</title>
  <meta http-equiv="refresh" content="0; url=${safe}" />
  <style>
    body { font-family: -apple-system, sans-serif; background: #0F172A; color: #fff;
           display: flex; flex-direction: column; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; text-align: center; padding: 24px; box-sizing: border-box; }
    a.btn { margin-top: 24px; padding: 14px 28px; border-radius: 999px; background: #87DE5A;
            color: #0F172A; text-decoration: none; font-weight: 600; }
    p { color: rgba(255,255,255,0.6); margin-top: 16px; font-size: 14px; line-height: 1.5; max-width: 320px; }
  </style>
</head>
<body>
  <h1>Reset your password</h1>
  <a class="btn" href="${safe}">Open in Ojo</a>
  <p>This link expires one hour after it was sent. If nothing happens, make sure Ojo is installed on this device.</p>
  <script>
    // Best-effort auto-open; the button above is the reliable fallback for
    // browsers that block a meta-refresh to a custom scheme.
    window.location.href = ${JSON.stringify(deepLink)};
  </script>
</body>
</html>`;
}

router.get('/reset', (req: Request, res: Response) => {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) {
    res.status(400).type('html').send(
      '<!DOCTYPE html><meta charset="utf-8"><title>Invalid link</title>' +
      '<p>This password reset link is missing its token. Request a new one from the Ojo app.</p>',
    );
    return;
  }

  // The token is in the query string, so it must not travel anywhere else:
  // no-referrer stops it leaking as a Referer header, and no-store keeps it out
  // of shared caches and the browser's back-forward cache.
  res.set('Referrer-Policy', 'no-referrer');
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.set('Cache-Control', 'no-store, max-age=0');
  res.type('html').send(resetHtml(`ojo://reset-password?token=${encodeURIComponent(token)}`));
});

export default router;
