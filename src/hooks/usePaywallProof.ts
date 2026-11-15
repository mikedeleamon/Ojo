import { useEffect, useMemo, useState } from 'react';
import { useClosets } from './useClosets';
import { useTripPlans } from './useTripPlans';
import { loadLocalHistory } from '../lib/outfitHistory';
import { computeStyleDNA, derivePreferenceProfile } from '../lib/userPreferences';
import { toLocalISODate } from '../lib/tripMode';
import type { OutfitHistoryEntry } from '../types';
import type { PaywallProof } from '../lib/paywall/pitch';

/**
 * The person's own numbers for the paywall: items, outfits logged, closets,
 * the next saved trip and Style DNA's top colors.
 *
 * Everything comes from what is already on the device. History is read from
 * local storage rather than the server, so the paywall never waits on the
 * network to show a number; the copy on device is the same one Home and
 * Insights keep current.
 */
export const usePaywallProof = (): PaywallProof => {
  const { closets } = useClosets();
  const { plans } = useTripPlans();
  const [history, setHistory] = useState<OutfitHistoryEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadLocalHistory()
      .then((h) => { if (!cancelled) setHistory(h); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return useMemo(() => {
    const today = toLocalISODate();
    // The trip still ahead (or under way) that starts soonest. Past trips
    // are not something Pro would keep for you.
    const upcoming = plans
      .filter((p) => p.endDate >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

    // Style DNA only has colors to show once the ranker is learning (10
    // outfits); below that, an empty list tells the paywall to skip the preview.
    const dna = computeStyleDNA(derivePreferenceProfile(closets, history));

    return {
      itemCount: closets.reduce((sum, c) => sum + (c.articles?.length ?? 0), 0),
      outfitCount: history.length,
      closetNames: closets.map((c) => c.name),
      tripName: upcoming ? (upcoming.name?.trim() || upcoming.destination) : null,
      tripCount: plans.length,
      topColors: dna.level === 'none' ? [] : dna.topColors,
    };
  }, [closets, plans, history]);
};
