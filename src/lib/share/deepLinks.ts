/**
 * share/deepLinks.ts — attribution URLs embedded in shared Instagram Stories
 * (the "Link" sticker Instagram renders from `attributionURL`).
 *
 * These are plain https URLs (Instagram requires https for attributionURL —
 * the `ojo://` scheme used by the widget's deep links can't be used directly
 * here). Each URL resolves to a tiny landing page served by the API
 * (server/src/routes/share.ts) that immediately hands off to the real
 * `ojo://` deep link — see src/lib/widget/deepLinks.ts + app/+native-intent.tsx
 * for the in-app routing those `ojo://` links resolve to.
 *
 * EXPO_PUBLIC_SHARE_BASE_URL must point at the API host — the /s/* pages are
 * Express routes, not part of the marketing site (www.ojoapp.io 404s on them).
 * It is set for the preview and production build profiles in eas.json; when it
 * is unset these helpers return `null` and callers omit attributionURL
 * entirely, so sharing still works — just without the tappable link sticker.
 *
 * Every path below needs a matching route in server/src/routes/share.ts AND a
 * matching `ojo://` branch in app/+native-intent.tsx, or the sticker lands on a
 * 404 / dead-ends after the handoff.
 */

const SHARE_BASE_URL = process.env.EXPO_PUBLIC_SHARE_BASE_URL;

const buildShareUrl = (path: string): string | null =>
  SHARE_BASE_URL ? `${SHARE_BASE_URL.replace(/\/$/, '')}${path}` : null;

/** Attribution link for a shared today's-outfit story. */
export const outfitShareLink = (): string | null => buildShareUrl('/s/outfit');

/** Attribution link for a shared TripFit day. */
export const tripShareLink = (planId: string): string | null =>
  buildShareUrl(`/s/trip/${encodeURIComponent(planId)}`);

/** Attribution link for a shared weather forecast. */
export const weatherShareLink = (): string | null => buildShareUrl('/s/weather');

/** Attribution link for a shared donation list. */
export const donationShareLink = (): string | null => buildShareUrl('/s/donation');

/** Attribution link for a shared weekly recap. */
export const recapShareLink = (): string | null => buildShareUrl('/s/recap');
