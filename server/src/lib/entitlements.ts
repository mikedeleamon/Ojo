/**
 * entitlements.ts — what a free account may hold, and what Ojo Pro unlocks.
 *
 * Pure decision logic only; the Express/Mongoose glue lives in
 * routes/closets.ts. Same split as revenuecatEntitlement.ts, and for the same
 * reason: this codebase has no route-level test harness, so anything worth
 * asserting has to be a function that takes numbers and returns a verdict.
 *
 * **These numbers are mirrored in the app at `src/config/limits.ts`.** Change
 * one and you must change the other — the client copy exists so the UI can warn
 * and gate *before* the user does the work of photographing a garment, but this
 * file is the only enforcement. A stale client copy shows the wrong counter; it
 * cannot grant anything.
 *
 * ## Why these two numbers
 *
 * **Items: 40.** The outfit engine's reachable empty exit is `insufficient`
 * (src/lib/outfitEngine.ts) — it fires *after* weather filtering, so a closet
 * that dresses a 70° day can produce nothing at all at 25°. A cap set below
 * year-round coverage doesn't read as "limited," it reads as "broken in
 * winter." The app's own wardrobe model (src/lib/archetypes/typicalWardrobe.ts)
 * puts a typical wardrobe at 19–32 garment kinds depending on climate band, of
 * which 12–25% are accessories. 40 clears full-year coverage in every band with
 * headroom, and still binds on someone cataloguing a whole wardrobe.
 *
 * **Closets: 1.** Both the outfit engine and TripFit read only the *preferred*
 * closet, so a second closet adds nothing to the daily loop — it is an
 * alternate wardrobe (travel, seasonal, a partner's), not a bigger one. Capping
 * free accounts at one costs them no daily function, and means a free user
 * never has to understand the preferred-closet mechanic at all.
 *
 * ## Grandfathering
 *
 * The check is `current < limit`, never `current <= limit` and never a sweep
 * over existing rows. An account already holding more than the cap — because it
 * predates this file, or because Pro lapsed — keeps every item and every
 * closet, fully usable by the engine. It simply cannot add another. Nothing
 * here deletes, hides, or degrades data a user already photographed.
 */

/**
 * Whether the ceilings are actually enforced, read from the environment.
 *
 * **Defaults to off.** These caps are only coherent once there is something to
 * buy: until the RevenueCat/App Store/Play products of Step 0 exist, every
 * account reads `isPro: false` — not because it is free, but because the store
 * isn't wired — and enforcing would wall users behind a paywall that cannot
 * sell them anything. Deploying this code therefore changes nothing until
 * `ENFORCE_FREE_TIER_LIMITS=true` is set deliberately, after purchases work.
 *
 * It doubles as a kill switch: 40 and 1 are reasoned estimates, not measured
 * ones, so if the cap turns out to be wrong it can be lifted for everyone by
 * flipping one Railway variable — no deploy, no app release.
 *
 * Read per call rather than cached at import so the variable can be changed on
 * a running server without a restart.
 */
export const limitsEnforced = (): boolean =>
  process.env.ENFORCE_FREE_TIER_LIMITS === 'true';

/** Items a free account may hold, summed across all of its closets. */
export const FREE_ITEM_LIMIT = 40;

/** Closets a free account may hold. */
export const FREE_CLOSET_LIMIT = 1;

export type LimitKind = 'item' | 'closet';

/** Machine-readable refusal codes, matching the `code` convention the auth
 *  routes use (e.g. EMAIL_NOT_VERIFIED). The app branches on these to route to
 *  the paywall rather than string-matching the message. */
export const LIMIT_CODES: Record<LimitKind, string> = {
  item:   'FREE_ITEM_LIMIT_REACHED',
  closet: 'FREE_CLOSET_LIMIT_REACHED',
};

const LIMIT_MESSAGES: Record<LimitKind, string> = {
  item:   `Free accounts include ${FREE_ITEM_LIMIT} items. Ojo Pro adds unlimited items.`,
  closet: `Free accounts include ${FREE_CLOSET_LIMIT} closet. Ojo Pro adds unlimited closets.`,
};

export interface LimitCheck {
  allowed: boolean;
  /** How many the account may hold — `null` means unlimited (Pro). */
  limit:   number | null;
  /** How many it holds right now. May exceed `limit` on a grandfathered account. */
  current: number;
  /** Present only on a refusal. */
  code?:   string;
  error?:  string;
}

/** The ceiling for this account, or `null` for Pro (no ceiling). */
export const limitFor = (kind: LimitKind, isPro: boolean): number | null => {
  if (isPro) return null;
  return kind === 'item' ? FREE_ITEM_LIMIT : FREE_CLOSET_LIMIT;
};

/**
 * Whether this account may add one more of `kind`, given how many it holds.
 *
 * `current` is the count *before* the addition, so the boundary is
 * `current < limit`: an account holding 39 of 40 may add its 40th, and one
 * holding 40 may not add a 41st.
 */
export const checkLimit = (kind: LimitKind, current: number, isPro: boolean): LimitCheck => {
  const limit = limitFor(kind, isPro);
  if (limit === null || current < limit) return { allowed: true, limit, current };
  return {
    allowed: false,
    limit,
    current,
    code:    LIMIT_CODES[kind],
    error:   LIMIT_MESSAGES[kind],
  };
};
