/**
 * insightsEngine.ts
 * -----------------
 * Pure computation layer for the Insights tab.
 * No UI — accepts closets + history + preferences, returns InsightsData.
 *
 * Designed to go deeper over time:
 *   - purchasePrice  → CPW, total wardrobe value
 *   - colorPairs     → style pair frequency (already tracked by userPreferences)
 *   - wornAt history → utilization rate, sleeping items, wear streaks
 */

import { Closet, ClothingArticle, OutfitHistoryEntry } from '../types';
import {
  UserPreferenceProfile,
  computeStyleDNA,
  StyleDNA,
} from './userPreferences';
import { getGapSuggestions, GapSuggestion } from './wardrobeGaps';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ArticleInsight {
  article:       ClothingArticle;
  closetId:      string;
  closetName:    string;
  totalWears:    number;
  lastWornAt:    string | null;   // ISO string or null if never worn
  daysSinceWorn: number | null;   // null if never worn
  costPerWear:   number | null;   // null if no price or totalWears === 0
  isSleeping:    boolean;         // never worn, or daysSinceWorn >= SLEEPING_THRESHOLD
}

export interface WardrobeHealth {
  totalArticles:    number;
  activeArticles:   number;         // worn within ACTIVE_WINDOW_DAYS
  sleepingArticles: number;         // isSleeping === true
  neverWorn:        number;         // totalWears === 0
  utilizationRate:  number;         // activeArticles / totalArticles, 0-1
  totalValue:       number | null;  // sum of purchasePrice; null if none set
  pricedCount:      number;         // how many articles have purchasePrice set
  bestCPW:          ArticleInsight | null;  // lowest CPW among items with a price + wears
  worstCPW:         ArticleInsight | null;  // highest CPW among items with a price + wears
  avgWearCount:     number;
}

export interface InsightsData {
  health:       WardrobeHealth;
  articles:     ArticleInsight[];                         // all articles, wear desc
  styleDNA:     StyleDNA;
  topWorn:      ArticleInsight[];                         // top 10 by totalWears
  sleeping:     ArticleInsight[];                         // isSleeping, daysSinceWorn desc
  neverWorn:    ArticleInsight[];                         // totalWears === 0
  colorPairs:   Array<{ pair: string; count: number }>;  // top 8 color combos
  gaps:         GapSuggestion[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Articles not worn in this many days are considered "sleeping". */
export const SLEEPING_THRESHOLD = 90;

/** Articles worn within this window count as "active" for utilization rate. */
export const ACTIVE_WINDOW_DAYS = 90;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const daysBetween = (isoA: string, isoB: Date = new Date()): number => {
  const ms = isoB.getTime() - new Date(isoA).getTime();
  return ms / (1000 * 60 * 60 * 24);
};

/**
 * Build a lookup map from article ID → { count, lastWornAt } by scanning
 * the full outfit history. O(total articleIds across all entries).
 */
const buildWearMap = (
  history: OutfitHistoryEntry[],
): Map<string, { count: number; lastWornAt: string }> => {
  const map = new Map<string, { count: number; lastWornAt: string }>();
  const now = new Date();

  for (const entry of history) {
    for (const id of entry.articleIds) {
      const existing = map.get(id);
      if (!existing) {
        map.set(id, { count: 1, lastWornAt: entry.wornAt });
      } else {
        existing.count += 1;
        // Keep the most recent wornAt
        if (new Date(entry.wornAt) > new Date(existing.lastWornAt)) {
          existing.lastWornAt = entry.wornAt;
        }
      }
    }
  }

  // Filter out future-dated entries (clock drift / test data)
  map.forEach((v, k) => {
    if (new Date(v.lastWornAt) > now) map.delete(k);
  });

  return map;
};

/** Enrich a single ClothingArticle with computed insight fields. */
const enrichArticle = (
  article: ClothingArticle,
  closetId: string,
  closetName: string,
  wearMap: Map<string, { count: number; lastWornAt: string }>,
  now: Date,
): ArticleInsight => {
  const stats = wearMap.get(article._id);

  const totalWears    = stats?.count ?? 0;
  const lastWornAt    = stats?.lastWornAt ?? null;
  const daysSinceWorn = lastWornAt ? daysBetween(lastWornAt, now) : null;

  const isSleeping =
    totalWears === 0 ||
    (daysSinceWorn !== null && daysSinceWorn >= SLEEPING_THRESHOLD);

  const costPerWear =
    article.purchasePrice != null && totalWears > 0
      ? parseFloat((article.purchasePrice / totalWears).toFixed(2))
      : null;

  return {
    article,
    closetId,
    closetName,
    totalWears,
    lastWornAt,
    daysSinceWorn,
    costPerWear,
    isSleeping,
  };
};

/** Build health stats from a flat list of enriched articles. */
const buildHealth = (insights: ArticleInsight[]): WardrobeHealth => {
  const now = new Date();
  const total = insights.length;

  const active = insights.filter(
    i =>
      i.lastWornAt !== null &&
      daysBetween(i.lastWornAt, now) < ACTIVE_WINDOW_DAYS,
  );

  const sleeping   = insights.filter(i => i.isSleeping);
  const neverWorn  = insights.filter(i => i.totalWears === 0);
  const priced     = insights.filter(i => i.article.purchasePrice != null);

  const totalValue =
    priced.length > 0
      ? priced.reduce((s, i) => s + (i.article.purchasePrice ?? 0), 0)
      : null;

  // CPW candidates — must have both a price and at least one wear
  const cpwCandidates = insights.filter(
    i => i.costPerWear !== null,
  );

  const bestCPW =
    cpwCandidates.length > 0
      ? cpwCandidates.reduce((best, i) =>
          (i.costPerWear ?? Infinity) < (best.costPerWear ?? Infinity) ? i : best,
        )
      : null;

  const worstCPW =
    cpwCandidates.length > 0
      ? cpwCandidates.reduce((worst, i) =>
          (i.costPerWear ?? 0) > (worst.costPerWear ?? 0) ? i : worst,
        )
      : null;

  const totalWears = insights.reduce((s, i) => s + i.totalWears, 0);

  return {
    totalArticles:    total,
    activeArticles:   active.length,
    sleepingArticles: sleeping.length,
    neverWorn:        neverWorn.length,
    utilizationRate:  total > 0 ? active.length / total : 0,
    totalValue,
    pricedCount:      priced.length,
    bestCPW,
    worstCPW,
    avgWearCount:     total > 0 ? totalWears / total : 0,
  };
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compute the full InsightsData snapshot.
 * Call once per screen focus; results are not cached (fast enough at scale).
 */
export const computeInsights = async (
  closets:     Closet[],
  history:     OutfitHistoryEntry[],
  preferences: UserPreferenceProfile,
): Promise<InsightsData> => {
  const now     = new Date();
  const wearMap = buildWearMap(history);

  // Flatten all articles across all closets, preserving closet context
  const allInsights: ArticleInsight[] = [];
  for (const closet of closets) {
    for (const article of closet.articles) {
      allInsights.push(
        enrichArticle(article, closet._id, closet.name, wearMap, now),
      );
    }
  }

  const health  = buildHealth(allInsights);
  const styleDNA = computeStyleDNA(preferences);

  // Top worn — descending by totalWears, take 10
  const topWorn = [...allInsights]
    .filter(i => i.totalWears > 0)
    .sort((a, b) => b.totalWears - a.totalWears)
    .slice(0, 10);

  // Sleeping — descending by daysSinceWorn (never-worn items go to the end)
  const sleeping = allInsights
    .filter(i => i.isSleeping)
    .sort((a, b) => {
      if (a.daysSinceWorn === null && b.daysSinceWorn === null) return 0;
      if (a.daysSinceWorn === null) return 1;
      if (b.daysSinceWorn === null) return -1;
      return b.daysSinceWorn - a.daysSinceWorn;
    });

  const neverWorn = allInsights.filter(i => i.totalWears === 0);

  // Color pairs — top 8 from userPreferences.colorPairs
  const colorPairs = Object.entries(preferences.colorPairs)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([pair, count]) => ({ pair, count }));

  const gaps = await getGapSuggestions();

  return {
    health,
    articles: [...allInsights].sort((a, b) => b.totalWears - a.totalWears),
    styleDNA,
    topWorn,
    sleeping,
    neverWorn,
    colorPairs,
    gaps,
  };
};

/** Format a CPW value as a display string, e.g. "$4.20 / wear" */
export const formatCPW = (cpw: number): string =>
  `$${cpw.toFixed(2)} / wear`;

/** Format total wardrobe value, e.g. "~$1,240" */
export const formatValue = (value: number): string =>
  `~$${Math.round(value).toLocaleString()}`;

/** Days since worn → human label */
export const dormantLabel = (days: number | null): string => {
  if (days === null) return 'Never worn';
  if (days < 1)   return 'Worn today';
  if (days < 7)   return `${Math.floor(days)}d ago`;
  if (days < 30)  return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
};
