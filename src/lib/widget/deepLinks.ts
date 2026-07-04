/**
 * widget/deepLinks.ts — the single source of truth for the deep-link URLs the
 * widget embeds in its snapshot.
 *
 * These are the *external* URLs (scheme `ojo://`) written into snapshot.json and
 * opened on tap. The inbound mapping to in-app expo-router routes lives in
 * app/+native-intent.tsx — keep the two in sync:
 *
 *   ojo://outfit     → "/"                              (home tab · today's outfit)
 *   ojo://trip/<id>  → "/account/tripfit?planId=<id>"   (opens the saved trip)
 */

/** Home tab / today's outfit. */
export const OUTFIT_DEEP_LINK = 'ojo://outfit';

/** A specific saved trip, opened in TripFit. */
export const tripDeepLink = (planId: string): string =>
  `ojo://trip/${encodeURIComponent(planId)}`;
