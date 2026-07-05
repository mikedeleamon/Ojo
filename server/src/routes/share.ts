import { Router, Request, Response } from 'express';

/**
 * Public landing pages for shared content — the target of the "Link" sticker
 * Instagram renders from a Story's `attributionURL` (see
 * src/lib/share/deepLinks.ts). Instagram requires attributionURL to be
 * https, so it can't point straight at the app's `ojo://` scheme; this page
 * is the https hop that then hands off to `ojo://`, which
 * app/+native-intent.tsx already maps to the right in-app screen.
 *
 * No auth, no DB read — the id in the URL is only used to build the deep
 * link, never looked up server-side, so this route can't leak any user data.
 */
const router = Router();

const APP_STORE_URL = process.env.APP_STORE_URL ?? 'https://apps.apple.com/app/ojo';

function landingHtml(opts: { title: string; deepLink: string }): string {
  const { title, deepLink } = opts;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Ojo</title>
  <meta property="og:title" content="${title}" />
  <meta property="og:site_name" content="Ojo" />
  <meta http-equiv="refresh" content="0; url=${deepLink}" />
  <style>
    body { font-family: -apple-system, sans-serif; background: #0F172A; color: #fff;
           display: flex; flex-direction: column; align-items: center; justify-content: center;
           height: 100vh; margin: 0; text-align: center; padding: 24px; box-sizing: border-box; }
    a.btn { margin-top: 24px; padding: 14px 28px; border-radius: 999px; background: #fff;
            color: #0F172A; text-decoration: none; font-weight: 600; }
    p { color: rgba(255,255,255,0.6); margin-top: 12px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <a class="btn" href="${deepLink}">Open in Ojo</a>
  <p>Don't have Ojo? <a href="${APP_STORE_URL}" style="color:#fff;">Get it on the App Store</a></p>
  <script>
    // Best-effort auto-redirect; the button above is the reliable fallback
    // for browsers (or Instagram's in-app browser) that block the meta-refresh.
    window.location.href = ${JSON.stringify(deepLink)};
  </script>
</body>
</html>`;
}

router.get('/outfit', (_req: Request, res: Response) => {
  res.type('html').send(landingHtml({ title: "Today's Outfit", deepLink: 'ojo://outfit' }));
});

router.get('/trip/:planId', (req: Request, res: Response) => {
  const planId = encodeURIComponent(req.params.planId);
  res.type('html').send(
    landingHtml({ title: 'My TripFit', deepLink: `ojo://trip/${planId}` }),
  );
});

router.get('/weather', (_req: Request, res: Response) => {
  res.type('html').send(landingHtml({ title: "Today's Forecast", deepLink: 'ojo://outfit' }));
});

export default router;
