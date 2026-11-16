/**
 * pitch.ts — what the Ojo Pro paywall says, depending on why it was opened.
 *
 * Every gate opens `/account/upgrade?from=<source>`. The source picks the
 * headline, the line under it, and which feature row leads; the person's own
 * numbers (PaywallProof) fill in the copy where they make it concrete. Pure, so
 * the copy can be tested without rendering the screen.
 *
 * `from` is also recorded on the RevenueCat customer before a purchase
 * (`paywall_from`), so each gate's conversion can be read off the dashboard.
 */

import { FREE_ITEM_LIMIT } from '../../config/limits';

/** Where the paywall was opened from. The first five are gates, the last two
 *  are the quiet inline moments, kept apart so they can be measured apart. */
export type PaywallFrom =
  | 'items'
  | 'closets'
  | 'trips'
  | 'styledna'
  | 'settings'
  | 'learning'
  | 'recap';

const ALL_FROM: readonly PaywallFrom[] = [
  'items', 'closets', 'trips', 'styledna', 'settings', 'learning', 'recap',
];

/** The four things Pro adds, each a feature row on the paywall. */
export type ProFeature = 'items' | 'closets' | 'trips' | 'styledna';

/** The resting order: how often each gate is actually met. */
export const DEFAULT_FEATURE_ORDER: readonly ProFeature[] = ['items', 'closets', 'trips', 'styledna'];

/** A route param as the paywall received it, made safe. Anything unknown
 *  (an old deep link, a typo) gets the general pitch. */
export const parsePaywallFrom = (raw: unknown): PaywallFrom => {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return typeof v === 'string' && (ALL_FROM as readonly string[]).includes(v)
    ? (v as PaywallFrom)
    : 'settings';
};

/** The feature a source is about, or null for the general pitch. The two
 *  moments both lead to Style DNA, since that is what they talk about. */
export const featureFor = (from: PaywallFrom): ProFeature | null => {
  switch (from) {
    case 'items':
    case 'closets':
    case 'trips':
    case 'styledna':
      return from;
    case 'learning':
    case 'recap':
      return 'styledna';
    default:
      return null;
  }
};

/** Feature rows in display order: the one the person came for first, the rest
 *  in the resting order. */
export const featureOrder = (from: PaywallFrom): ProFeature[] => {
  const lead = featureFor(from);
  return lead ? [lead, ...DEFAULT_FEATURE_ORDER.filter((f) => f !== lead)] : [...DEFAULT_FEATURE_ORDER];
};

/** The person's own numbers. Every field may be missing while it loads. */
export interface PaywallProof {
  itemCount:    number;
  outfitCount:  number;
  closetNames:  string[];
  /** The saved trip that is next or current, by destination. */
  tripName:     string | null;
  tripCount:    number;
  /** Style DNA's top colors, by name; empty until the ranker is learning. */
  topColors:    string[];
}

export const EMPTY_PROOF: PaywallProof = {
  itemCount: 0, outfitCount: 0, closetNames: [], tripName: null, tripCount: 0, topColors: [],
};

export interface PaywallPitch {
  headline: string;
  subhead:  string;
}

/** The headline and the line under it. */
export const pitchFor = (from: PaywallFrom, proof: PaywallProof): PaywallPitch => {
  switch (featureFor(from)) {
    case 'items':
      return {
        headline: 'Every piece makes tomorrow’s pick better.',
        // An account can sit over the cap (kept from before the limit, or a
        // lapsed Pro): everything it has stays, it just can't add.
        subhead: proof.itemCount > FREE_ITEM_LIMIT
          ? `All ${proof.itemCount} of your pieces stay. Pro lets you keep adding.`
          : proof.itemCount > 0
            ? `You’ve added ${proof.itemCount} of your ${FREE_ITEM_LIMIT} free pieces. Pro keeps the room open.`
            : `Free covers ${FREE_ITEM_LIMIT} pieces. Pro keeps the room open.`,
      };
    case 'closets':
      return {
        headline: 'A closet for travel, work and each season.',
        subhead: 'Free includes one closet. Pro lets you split it the way you live.',
      };
    case 'trips':
      return {
        headline: 'Every trip packed and planned.',
        subhead: proof.tripName
          ? `Free keeps one trip at a time. Pro keeps ${proof.tripName} and whatever’s next.`
          : 'Free keeps one trip at a time. Pro keeps every trip you’re planning.',
      };
    case 'styledna':
      return {
        headline: 'See what Ojo has learned about you.',
        subhead: proof.topColors.length > 0
          ? `${proof.outfitCount} outfits in, Ojo knows your colors, fabrics and pairings.`
          : 'Top colors, fabrics and pairings, learned from what you actually wear.',
      };
    default:
      return {
        headline: 'The more you wear, the better it gets.',
        subhead: 'Ojo gets smarter every time you use it. Pro lifts the limits and opens up what it learns.',
      };
  }
};

export interface FeatureCopy {
  title: string;
  /** For the title-only tiles on the Duo cover, where the outcome line won't fit. */
  short: string;
  body:  string;
}

/** Each feature row: what Pro gets you, then the limit it lifts. */
export const FEATURE_COPY: Record<ProFeature, FeatureCopy> = {
  items: {
    title: 'Room for everything you own',
    short: 'Unlimited pieces',
    body: `Free covers ${FREE_ITEM_LIMIT} pieces. With Pro, every piece you own can be picked.`,
  },
  closets: {
    title: 'A closet for every part of life',
    short: 'Unlimited closets',
    body: 'Free includes one closet. Pro adds travel, work, each season, as many as you like.',
  },
  trips: {
    title: 'Every trip packed and planned',
    short: 'Unlimited saved trips',
    body: 'Free keeps 1 trip at a time. Pro keeps every trip you’re planning.',
  },
  styledna: {
    title: 'See what Ojo has learned about you',
    short: 'Your Style DNA',
    body: 'Top colors, fabrics and pairings, learned from what you actually wear.',
  },
};
