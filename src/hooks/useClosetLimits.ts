import { useMemo } from 'react';
import { useClosets } from './useClosets';
import { usePurchases } from '../context/PurchasesContext';
import {
  FREE_ITEM_LIMIT,
  FREE_CLOSET_LIMIT,
  ITEM_WARNING_RATIO,
} from '../config/limits';

export interface ClosetLimits {
  itemCount:    number;
  /** `null` means unlimited — Pro, no store configured, or the entitlement not
   *  yet resolved. The counter and banner hide entirely when it is null. */
  itemLimit:    number | null;
  canAddItem:   boolean;
  canAddCloset: boolean;
  /** Within the warning band, but not yet at the cap. */
  showItemWarning: boolean;
}

/**
 * The free-tier ceilings as they apply to this account, right now.
 *
 * Mirrors `server/src/lib/entitlements.ts`, which is the actual enforcement —
 * everything here is so the UI can gate *before* the user does the work, never
 * instead of the server.
 *
 * **Unknown entitlement — or no store at all — means uncapped.**
 * `usePurchases` reports `isPro: false` for the whole first-frame window before
 * RevenueCat resolves, so gating on it directly would flash a paywall at a
 * paying subscriber (the same trap TripPlanner and InsightsPage already guard
 * with `isReady`). Until the entitlement is actually known — and until a store
 * exists at all — this hook reports no limit and allows everything; the server
 * still refuses anything a free account may not do, so the permissive default
 * costs nothing but a late error instead of an early one.
 */
export const useClosetLimits = (): ClosetLimits => {
  const { closets } = useClosets();
  const { isPro, isReady, isConfigured } = usePurchases();

  const itemCount = useMemo(
    () => closets.reduce((sum, c) => sum + (c.articles?.length ?? 0), 0),
    [closets],
  );

  return useMemo(() => {
    // `isConfigured` is load-bearing, not defensive: with no RevenueCat key the
    // context reports isPro false for everyone, and the paywall itself falls
    // back to "Ojo Pro is almost here" with nothing to buy. Capping in that
    // state would wall users behind a screen that cannot sell them anything.
    // The server's ENFORCE_FREE_TIER_LIMITS flag is the other half of this and
    // defaults off for the same reason.
    const capped = isConfigured && isReady && !isPro;
    const itemLimit   = capped ? FREE_ITEM_LIMIT   : null;
    const closetLimit = capped ? FREE_CLOSET_LIMIT : null;
    const closetCount = closets.length;

    return {
      itemCount,
      itemLimit,
      canAddItem:   itemLimit   === null || itemCount   < itemLimit,
      canAddCloset: closetLimit === null || closetCount < closetLimit,
      // Only ever true below the cap, so callers can render "N left" from
      // itemLimit - itemCount without guarding for a negative: an account
      // sitting over the cap (grandfathered, or Pro lapsed) shows the at-cap
      // message instead, via canAddItem.
      showItemWarning:
        itemLimit !== null &&
        itemCount >= Math.floor(itemLimit * ITEM_WARNING_RATIO) &&
        itemCount < itemLimit,
    };
  }, [closets.length, itemCount, isPro, isReady, isConfigured]);
};
