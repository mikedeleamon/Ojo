/**
 * limits.ts — the app's copy of the free-tier ceilings.
 *
 * **Mirrors `server/src/lib/entitlements.ts`, which is the only enforcement.**
 * Change one and you must change the other. This copy exists so the UI can
 * count, warn, and route to the paywall *before* the user photographs a
 * garment, crops it, and fills in its attributes — being refused after all that
 * work is the worst possible moment to meet a paywall. A stale copy here shows
 * a wrong counter; it cannot grant anything the server would refuse.
 *
 * See the server file for why the numbers are what they are, and for the
 * grandfathering rule (over-cap accounts keep everything; they just can't add).
 */

/** Items a free account may hold, summed across all of its closets. */
export const FREE_ITEM_LIMIT = 40;

/** Closets a free account may hold. */
export const FREE_CLOSET_LIMIT = 1;

/** Refusal codes the server answers with, so the app can route to the paywall
 *  instead of string-matching an error message. */
export const LIMIT_CODES = {
  item:   'FREE_ITEM_LIMIT_REACHED',
  closet: 'FREE_CLOSET_LIMIT_REACHED',
} as const;

/** Where the counter stops being ambient and starts being a heads-up. Set so
 *  the warning lands with 8 items still to go — enough room to finish what
 *  you're doing rather than a wall appearing without notice. */
export const ITEM_WARNING_RATIO = 0.8;

/** The paywall route, in one place so every gate points at the same screen. */
export const UPGRADE_ROUTE = '/account/upgrade';

/**
 * The limit code on a server refusal, or `null` if this wasn't one.
 *
 * The safety net for the gap between the two copies of these numbers: the UI
 * gates on its own count, but the entitlement can resolve late, another device
 * can add the item that fills the last slot, or this file can simply drift from
 * the server's. In all of those the server refuses and the app should offer the
 * paywall rather than report a generic failure.
 */
export const limitCodeOf = (err: unknown): string | null => {
  const code = (err as { response?: { data?: { code?: string } } })
    ?.response?.data?.code;
  return code === LIMIT_CODES.item || code === LIMIT_CODES.closet ? code : null;
};
