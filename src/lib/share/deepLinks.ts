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
 * EXPO_PUBLIC_SHARE_BASE_URL is unset until the landing page is actually
 * hosted at a real domain; until then these helpers return `null` and callers
 * omit attributionURL entirely, so sharing still works — just without the
 * tappable link sticker.
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
