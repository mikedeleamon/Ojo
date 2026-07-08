/**
 * recapEngine.ts
 * --------------
 * Pure computation layer for the Weekly Wardrobe Recap.
 * No UI, no storage — accepts closets + history (+ optional trip plans and
 * gap suggestions), returns the 4–6 RecapCards for the week. Copy and
 * selection rules live in WEEKLY_RECAP_TEMPLATES.md; every slot below is
 * derived from data the app already tracks.
 *
 * Callers fetch async inputs (getGapSuggestions, loadPlans) themselves so
 * this stays synchronous and unit-testable, mirroring insightsEngine.
 */

import {
  Closet,
  ClothingArticle,
  OutfitHistoryEntry,
  SavedTripFitPlan,
} from '../types';
import { computeStyleDNA, derivePreferenceProfile } from './userPreferences';
import { SLEEPING_THRESHOLD } from './insightsEngine';
import { GapSuggestion, GapType } from './wardrobeGaps';
import { toLocalISODate } from './tripMode';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecapSection = 'opener' | 'color' | 'items' | 'habits' | 'context' | 'closer';
export type RecapCta = 'share' | 'shop';

export interface RecapCard {
  templateId: string;
  section:    RecapSection;
  headline:   string;
  body:       string;
  cta?:       RecapCta;
  /** Set on gap_nudge so the UI can route the shop CTA like the Wardrobe Gap Card. */
  gapType?:   GapType;
}

/** A template shown in a previous recap, for cooldown suppression. */
export interface ShownRecord {
  templateId: string;
  shownAt:    string;  // ISO timestamp of the recap it appeared in
}

export interface RecapInput {
  closets:  Closet[];
  history:  OutfitHistoryEntry[];
  plans?:   SavedTripFitPlan[];
  gaps?:    GapSuggestion[];
  now?:     Date;
  /** Stable per-user salt so two users don't get identical variant picks. */
  seed?:    string;
  previouslyShown?: ShownRecord[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS = 7;
const DAY_MS    = 24 * 60 * 60 * 1000;

/** Dormancy for a "back from the bench" comeback — same bar as Insights. */
const WOKE_THRESHOLD_DAYS = SLEEPING_THRESHOLD;
/** still_sleeping needs a longer nap than the generic sleeping bar. */
const STILL_SLEEPING_MIN_DAYS = 120;
const STREAK_MIN_DAYS = 4;
const CPW_THRESHOLDS  = [10, 5, 1];
const MILESTONES      = [250, 100, 50, 30, 10];
const MAX_CARDS       = 6;
const MAX_MIDDLE      = 4;

/** "Shown last week" cooldown, with slack for recaps that fire a day late. */
const DEFAULT_COOLDOWN_DAYS = 10;
/** still_sleeping is a tease, not a nag — once a month at most. */
const STILL_SLEEPING_COOLDOWN_DAYS = 31;

/** Salience when more templates fire than fit (WEEKLY_RECAP_TEMPLATES.md §rules). */
const SALIENCE = [
  'milestone', 'trip_week', 'dna_plot_twist', 'woke_up', 'streak',
  'color_story', 'mvp_item', 'debut', 'color_pair', 'cpw_win',
  'dna_consistent', 'still_sleeping',
];

const SECTION_ORDER: Record<RecapSection, number> = {
  opener: 0, color: 1, items: 2, habits: 3, context: 4, closer: 5,
};

const GAP_LABELS: Record<GapType, string> = {
  missing_coat:       'a coat',
  missing_jacket:     'a light jacket',
  missing_boots:      'boots',
  missing_mid_layer:  'a mid layer',
  missing_rain_layer: 'a rain layer',
  missing_footwear:   'weather-ready shoes',
};

// ─── Deterministic variant RNG ────────────────────────────────────────────────

/** ISO-8601 week key, e.g. "2026-W28" — also handy as a storage-key suffix. */
export const isoWeekKey = (d: Date): string => {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const hashSeed = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};

const mulberry32 = (a: number) => (): number => {
  a |= 0; a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/**
 * Variant pick seeded per (week, user, template) — reopening the same recap
 * always renders identical copy, and one template dropping out of eligibility
 * doesn't reshuffle the others' variants.
 */
const pickVariant = <T>(variants: T[], weekSeed: string, templateId: string): T => {
  const rnd = mulberry32(hashSeed(`${weekSeed}|${templateId}`));
  return variants[Math.floor(rnd() * variants.length)];
};

// ─── Slot helpers ─────────────────────────────────────────────────────────────

const articleLabel = (a: ClothingArticle): string =>
  a.name?.trim() || [a.color, a.clothingType].filter(Boolean).join(' ');

const nOutfits = (count: number): string =>
  count === 1 ? '1 outfit' : `${count} outfits`;

const ucfirst = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Weekday name for dates within the week, "Jun 29" for anything older. */
const dayLabel = (d: Date, now: Date): string =>
  now.getTime() - d.getTime() < WEEK_DAYS * DAY_MS
    ? d.toLocaleDateString('en-US', { weekday: 'long' })
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

// ─── Week stats ───────────────────────────────────────────────────────────────

interface ArticleWeekStats {
  article:          ClothingArticle;
  weekWears:        number;
  totalWears:       number;             // all-time, including this week
  firstWearThisWeek: Date;
  lastWearBeforeWeek: Date | null;
}

interface WeekStats {
  outfitCount:  number;
  daysLogged:   number;
  weekHistory:  OutfitHistoryEntry[];
  /** color → number of THIS WEEK'S OUTFITS containing it (per-outfit presence,
   *  not the per-article counts derivePreferenceProfile keeps). */
  colorOutfits: Map<string, number>;
  /** "A|B" (distinct colors, canonical order) → outfits containing the pair. */
  pairOutfits:  Map<string, number>;
  perArticle:   Map<string, ArticleWeekStats>;
  /** Articles NOT worn this week, with days since their last wear. */
  dormant:      Array<{ article: ClothingArticle; dormantDays: number }>;
  loggedDates:  Set<string>;            // local ISO dates across ALL history
}

const buildWeekStats = (
  closets: Closet[],
  history: OutfitHistoryEntry[],
  now: Date,
): WeekStats => {
  const weekStartMs = now.getTime() - WEEK_DAYS * DAY_MS;

  const byId = new Map<string, ClothingArticle>();
  for (const closet of closets) {
    for (const article of closet.articles) byId.set(article._id, article);
  }

  const weekHistory: OutfitHistoryEntry[] = [];
  const loggedDates = new Set<string>();
  // articleId → wear timestamps split around the week boundary
  const weekWears  = new Map<string, number[]>();
  const priorWears = new Map<string, number[]>();

  for (const entry of history) {
    const t = new Date(entry.wornAt).getTime();
    if (Number.isNaN(t) || t > now.getTime()) continue;  // future/garbage entries
    loggedDates.add(toLocalISODate(new Date(t)));
    const bucket = t > weekStartMs ? weekWears : priorWears;
    if (t > weekStartMs) weekHistory.push(entry);
    for (const id of entry.articleIds) {
      const list = bucket.get(id);
      if (list) list.push(t);
      else bucket.set(id, [t]);
    }
  }
  weekHistory.sort((a, b) => a.wornAt.localeCompare(b.wornAt));

  const colorOutfits = new Map<string, number>();
  const pairOutfits  = new Map<string, number>();
  const daySet       = new Set<string>();

  for (const entry of weekHistory) {
    daySet.add(toLocalISODate(new Date(entry.wornAt)));
    const colors = new Set<string>();
    for (const id of entry.articleIds) {
      const c = byId.get(id)?.color;
      if (c) colors.add(c);
    }
    const sorted = [...colors].sort();
    for (let i = 0; i < sorted.length; i++) {
      colorOutfits.set(sorted[i], (colorOutfits.get(sorted[i]) ?? 0) + 1);
      for (let j = i + 1; j < sorted.length; j++) {
        const key = `${sorted[i]}|${sorted[j]}`;
        pairOutfits.set(key, (pairOutfits.get(key) ?? 0) + 1);
      }
    }
  }

  const perArticle = new Map<string, ArticleWeekStats>();
  weekWears.forEach((times, id) => {
    const article = byId.get(id);
    if (!article) return;  // deleted garments can't be named
    const prior = priorWears.get(id) ?? [];
    perArticle.set(id, {
      article,
      weekWears:  times.length,
      totalWears: times.length + prior.length,
      firstWearThisWeek:  new Date(Math.min(...times)),
      lastWearBeforeWeek: prior.length ? new Date(Math.max(...prior)) : null,
    });
  });

  const dormant: WeekStats['dormant'] = [];
  byId.forEach((article, id) => {
    if (weekWears.has(id)) return;
    const prior = priorWears.get(id);
    if (!prior?.length) return;  // never worn — different story than dormant
    dormant.push({
      article,
      dormantDays: Math.floor((now.getTime() - Math.max(...prior)) / DAY_MS),
    });
  });
  dormant.sort((a, b) => b.dormantDays - a.dormantDays);

  return {
    outfitCount: weekHistory.length,
    daysLogged:  daySet.size,
    weekHistory,
    colorOutfits,
    pairOutfits,
    perArticle,
    dormant,
    loggedDates,
  };
};

/** Longest run of consecutive logged days ending on the most recent logged day. */
const currentStreak = (loggedDates: Set<string>, now: Date): { length: number; start: Date } | null => {
  // Find the most recent logged day within the week window
  let cursor: Date | null = null;
  for (let i = 0; i < WEEK_DAYS; i++) {
    const d = new Date(now.getTime() - i * DAY_MS);
    if (loggedDates.has(toLocalISODate(d))) { cursor = d; break; }
  }
  if (!cursor) return null;

  let length = 0;
  let start = cursor;
  let d = cursor;
  while (loggedDates.has(toLocalISODate(d))) {
    length++;
    start = d;
    d = new Date(d.getTime() - DAY_MS);
  }
  return { length, start };
};

// ─── Candidate templates ──────────────────────────────────────────────────────

interface Candidate {
  id:        string;
  section:   RecapSection;
  headlines: string[];
  bodies:    string[];
  cta?:      RecapCta;
  gapType?:  GapType;
}

const buildCandidates = (
  stats: WeekStats,
  input: Required<Pick<RecapInput, 'closets' | 'history'>> & RecapInput,
  now: Date,
): Candidate[] => {
  const { outfitCount } = stats;
  const out: Candidate[] = [];

  const allProfile = derivePreferenceProfile(input.closets, input.history);
  const dna = computeStyleDNA(allProfile);

  // Week's top color by per-outfit presence; ties broken alphabetically.
  const topColorEntry = [...stats.colorOutfits.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const [topColor, topColorCount] = topColorEntry ?? [null, 0];

  // milestone — highest all-time threshold crossed this week
  const totalBefore = allProfile.totalOutfits - outfitCount;
  const milestone = MILESTONES.find(
    m => totalBefore < m && allProfile.totalOutfits >= m,
  );
  if (milestone) {
    const body =
      milestone === 10
        ? "Ojo's officially learning your style now — suggestions start bending your way."
        : milestone === 30
          ? 'Personalization unlocked: your suggestions are now fully tuned to you.'
          : `Most people can't name ${milestone} outfits they've worn. You have receipts.`;
    out.push({
      id: 'milestone', section: 'habits',
      headlines: [`Outfit #${milestone}, logged.`, `That's ${milestone} outfits.`],
      bodies: [body],
    });
  }

  // trip_week — a saved trip's dates overlap the week AND outfits were logged in them
  const windowStart = toLocalISODate(new Date(now.getTime() - (WEEK_DAYS - 1) * DAY_MS));
  const windowEnd   = toLocalISODate(now);
  let bestTrip: { plan: SavedTripFitPlan; count: number } | null = null;
  for (const plan of input.plans ?? []) {
    if (plan.startDate > windowEnd || plan.endDate < windowStart) continue;
    const count = stats.weekHistory.filter(e => {
      const d = toLocalISODate(new Date(e.wornAt));
      return d >= plan.startDate && d <= plan.endDate;
    }).length;
    if (count > 0 && (!bestTrip || count > bestTrip.count)) bestTrip = { plan, count };
  }
  if (bestTrip) {
    const { plan, count } = bestTrip;
    out.push({
      id: 'trip_week', section: 'context',
      headlines: [`The ${plan.destination} week.`, 'You packed. It worked.'],
      bodies: [
        `${nOutfits(count)} logged during your ${plan.destination} trip — planned before you even left.`,
        `Your ${plan.destination} TripFit met the real world this week. ${ucfirst(nOutfits(count))} made the log.`,
      ],
    });
  }

  // dna_plot_twist / dna_consistent
  if (topColor && dna.level === 'active' && topColorCount >= 3 &&
      !dna.topColors.includes(topColor) && dna.topColors.length >= 2) {
    out.push({
      id: 'dna_plot_twist', section: 'habits',
      headlines: ['A plot twist.', 'New color in the lead.'],
      bodies: [
        `${topColor} isn't in your usual top three (${dna.topColors[0]}, ${dna.topColors[1]}) — but it owned this week.`,
        `Your Style DNA says ${dna.topColors[0]}. This week said ${topColor}. We'll see who wins.`,
      ],
    });
  } else if (topColor && dna.level !== 'none' && dna.topColors.includes(topColor)) {
    out.push({
      id: 'dna_consistent', section: 'habits',
      headlines: ['On brand, as ever.', 'Your Style DNA holds.'],
      bodies: [
        `${topColor} again — the same signature Ojo has learned from ${dna.totalOutfits} logged outfits.`,
        `Some things don't change: ${topColor} stays at the top of your rotation.`,
      ],
    });
  }

  // woke_up — biggest comeback past the sleeping threshold
  let woke: { label: string; dormantDays: number } | null = null;
  for (const s of stats.perArticle.values()) {
    if (!s.lastWearBeforeWeek) continue;
    const gap = Math.floor(
      (s.firstWearThisWeek.getTime() - s.lastWearBeforeWeek.getTime()) / DAY_MS,
    );
    if (gap >= WOKE_THRESHOLD_DAYS && (!woke || gap > woke.dormantDays)) {
      woke = { label: articleLabel(s.article), dormantDays: gap };
    }
  }
  if (woke) {
    const { label, dormantDays } = woke;
    out.push({
      id: 'woke_up', section: 'items',
      headlines: ['Back from the bench.', `The ${label} awakens.`],
      bodies: [
        `After ${dormantDays} days off, your ${label} got its moment. Welcome back.`,
        `${dormantDays} days of silence, then this week happened. Comebacks look good on you.`,
      ],
    });
  }

  // streak
  const streak = currentStreak(stats.loggedDates, now);
  if (streak && streak.length >= STREAK_MIN_DAYS) {
    out.push({
      id: 'streak', section: 'habits',
      headlines: [`${streak.length} days straight.`, 'A streak is forming.'],
      bodies: [
        `An outfit logged every day since ${dayLabel(streak.start, now)}. The algorithm is taking notes — literally.`,
        `${streak.length} days in a row. Your Style DNA is getting sharper by the outfit.`,
      ],
    });
  }

  // color_story
  if (topColor && topColorCount >= 3 && topColorCount / outfitCount >= 0.4) {
    out.push({
      id: 'color_story', section: 'color',
      headlines: [
        `${topColor} ran the week.`,
        `A ${topColor} kind of week.`,
        `All signs point to ${topColor}.`,
      ],
      bodies: [
        `It showed up in ${topColorCount} of your ${outfitCount} outfits. That's a favorite, not a phase.`,
        `${topColorCount} appearances in seven days — at this point it's a personality trait.`,
      ],
    });
  }

  // mvp_item
  const mvp = [...stats.perArticle.values()]
    .filter(s => s.weekWears >= 3)
    .sort((a, b) => b.weekWears - a.weekWears ||
                    articleLabel(a.article).localeCompare(articleLabel(b.article)))[0];
  if (mvp) {
    const label = articleLabel(mvp.article);
    out.push({
      id: 'mvp_item', section: 'items',
      headlines: [`MVP: your ${label}.`, 'One item did the heavy lifting.'],
      bodies: [
        `${mvp.weekWears} appearances in seven days — someone's earning their hanger space.`,
        `Your ${label} clocked in ${mvp.weekWears} times this week. Give it the weekend off.`,
      ],
    });
  }

  // debut — first-ever wear happened this week
  const debut = [...stats.perArticle.values()]
    .filter(s => s.totalWears === s.weekWears)
    .sort((a, b) => b.weekWears - a.weekWears ||
                    a.firstWearThisWeek.getTime() - b.firstWearThisWeek.getTime())[0];
  if (debut) {
    const label = articleLabel(debut.article);
    const day = dayLabel(debut.firstWearThisWeek, now);
    out.push({
      id: 'debut', section: 'items',
      headlines: ['A debut this week.', 'First time out.'],
      bodies: [
        `Your ${label} finally left the closet — logged for the first time on ${day}.`,
        `Welcome to the rotation, ${label}. First wear: ${day}.`,
      ],
    });
  }

  // color_pair — same distinct-color pair in ≥2 outfits
  const topPair = [...stats.pairOutfits.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (topPair) {
    const [colorA, colorB] = topPair[0].split('|');
    const pairCount = topPair[1];
    const bodies = [
      `That pairing landed ${pairCount} times this week. The color wheel agrees with you.`,
    ];
    // "Twice is a coincidence — 2 times is a signature" contradicts itself
    if (pairCount > 2) {
      bodies.push(`Twice is a coincidence — ${pairCount} times is a signature.`);
    }
    out.push({
      id: 'color_pair', section: 'color',
      headlines: [`${colorA} + ${colorB}, again.`, "You've found your combo."],
      bodies,
    });
  }

  // cpw_win — cost-per-wear crossed below a round threshold this week
  let cpwWin: { label: string; cpw: number } | null = null;
  for (const s of stats.perArticle.values()) {
    const price = s.article.purchasePrice;
    if (price == null || price <= 0) continue;
    const before = s.totalWears - s.weekWears;
    const cpwBefore = before > 0 ? price / before : Infinity;
    const cpwNow = price / s.totalWears;
    const crossed = CPW_THRESHOLDS.some(t => cpwNow <= t && cpwBefore > t);
    if (crossed && (!cpwWin || cpwNow < cpwWin.cpw)) {
      cpwWin = { label: articleLabel(s.article), cpw: cpwNow };
    }
  }
  if (cpwWin) {
    const { label, cpw } = cpwWin;
    const dollars = `$${cpw.toFixed(2)}`;
    out.push({
      id: 'cpw_win', section: 'habits',
      headlines: ['Money well worn.', `Your ${label} just got cheaper.`],
      bodies: [
        `Every wear counts — it's down to ${dollars} per wear after this week.`,
        `${dollars} a wear and falling. That's what a good buy looks like.`,
      ],
    });
  }

  // still_sleeping — only when no comeback stole the narrative
  if (!woke && stats.dormant[0] && stats.dormant[0].dormantDays >= STILL_SLEEPING_MIN_DAYS) {
    const { article, dormantDays } = stats.dormant[0];
    const label = articleLabel(article);
    out.push({
      id: 'still_sleeping', section: 'items',
      headlines: ['Meanwhile, in the back…', 'Someone misses you.'],
      bodies: [
        `Your ${label} hasn't been out in ${dormantDays} days. No pressure — it remembers you, though.`,
        `${dormantDays} days and counting for your ${label}. Just leaving that here.`,
      ],
    });
  }

  return out;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Build the week's recap cards. Deterministic for a given (input, now, seed):
 * reopening the recap renders identical copy.
 */
export const buildWeeklyRecap = (input: RecapInput): RecapCard[] => {
  const now = input.now ?? new Date();
  const weekSeed = `${isoWeekKey(now)}|${input.seed ?? ''}`;

  const render = (c: Candidate): RecapCard => ({
    templateId: c.id,
    section:    c.section,
    headline:   ucfirst(pickVariant(c.headlines, weekSeed, `${c.id}.h`)),
    body:       ucfirst(pickVariant(c.bodies, weekSeed, `${c.id}.b`)),
    ...(c.cta ? { cta: c.cta } : {}),
    ...(c.gapType ? { gapType: c.gapType } : {}),
  });

  const stats = buildWeekStats(input.closets, input.history, now);

  if (stats.outfitCount === 0) {
    return [render({
      id: 'empty_week', section: 'opener',
      headlines: ['A week off the record.', 'The closet kept quiet.'],
      bodies: [
        "No outfits logged this week. Tap 'Wore this' on your next one and the recap gets interesting.",
        'Nothing logged — even Ojo takes a week off sometimes. See you next Sunday.',
      ],
    })];
  }

  const opener = render(
    stats.outfitCount >= 3
      ? {
          id: 'hero_week', section: 'opener',
          headlines: [
            `Seven days, ${stats.outfitCount} outfits.`,
            'Your week, worn well.',
            `${stats.outfitCount} outfits later…`,
          ],
          bodies: [
            `You got dressed with intent on ${stats.daysLogged} of 7 days. Here's how it went.`,
            `Logged across ${stats.daysLogged} days — your closet showed up this week.`,
          ],
        }
      : {
          id: 'hero_light', section: 'opener',
          headlines: ['Quality over quantity.', 'A short story this week.'],
          bodies: [
            `${ucfirst(nOutfits(stats.outfitCount))} logged — few enough to remember, good enough to recap.`,
            'Not a busy week for the log, but the details below still earned a mention.',
          ],
        },
  );

  // Cooldowns — a template shown recently sits this week out
  const onCooldown = (id: string): boolean => {
    const days = id === 'still_sleeping' ? STILL_SLEEPING_COOLDOWN_DAYS : DEFAULT_COOLDOWN_DAYS;
    return (input.previouslyShown ?? []).some(
      r => r.templateId === id &&
           now.getTime() - new Date(r.shownAt).getTime() < days * DAY_MS,
    );
  };

  const candidates = buildCandidates(stats, input, now)
    .filter(c => !onCooldown(c.id));
  const byId = new Map(candidates.map(c => [c.id, c]));

  const gap = input.gaps?.[0];
  const gapCard: RecapCard | null =
    gap && !onCooldown('gap_nudge')
      ? render({
          id: 'gap_nudge', section: 'context',
          cta: 'shop', gapType: gap.type,
          headlines: ['One gap keeps showing up.', 'Your closet has a wishlist.'],
          bodies: [
            `${GAP_LABELS[gap.type]} would've completed ${gap.count} outfits this month. Just saying.`,
            `Ojo keeps reaching for ${GAP_LABELS[gap.type]} that isn't there — ${gap.count} times and counting.`,
          ],
        })
      : null;

  // Walk salience order; max one card per section except milestone
  const middleBudget = Math.min(
    MAX_MIDDLE,
    MAX_CARDS - 2 - (gapCard ? 1 : 0),  // opener + closer always reserved
  );
  const picked: Candidate[] = [];
  const usedSections = new Set<RecapSection>();
  for (const id of SALIENCE) {
    if (picked.length >= middleBudget) break;
    const c = byId.get(id);
    if (!c) continue;
    if (usedSections.has(c.section) && c.id !== 'milestone') continue;
    picked.push(c);
    usedSections.add(c.section);
  }
  picked.sort((a, b) =>
    SECTION_ORDER[a.section] - SECTION_ORDER[b.section] ||
    SALIENCE.indexOf(a.id) - SALIENCE.indexOf(b.id));

  const cards: RecapCard[] = [opener, ...picked.map(render)];
  if (gapCard) cards.push(gapCard);

  if (cards.length >= 3) {
    cards.push(render({
      id: 'share_cta', section: 'closer', cta: 'share',
      headlines: ['That was your week.', 'Worn. Logged. Recapped.'],
      bodies: [
        'Share it, or let next week top it.',
        'Seven days, fully accounted for. Next week starts tomorrow.',
      ],
    }));
  }

  return cards;
};
