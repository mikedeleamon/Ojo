/**
 * morningBrief.ts
 * ───────────────
 * Copy for the Morning Outfit Brief notification.
 *
 * Pure and synchronous — no RN imports, no storage, no clock beyond what's
 * passed in — so every branch is unit-testable. Scheduling lives in
 * lib/notifications.ts; generating the outfit lives in lib/outfit/dayOutfit.ts.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * The server used to build this string (server/src/services/notificationService.ts,
 * removed). It was titled "Morning Outfit Brief" and its body never named a
 * garment, because the outfit engine and the closet both live on the client and
 * the server could not see either. Its temperature ladder also had no branch
 * between 50°F and 75°F, so the most common weather in most cities produced
 * "Check your outfit suggestion in the app" — a daily push whose entire content
 * was an instruction to go find the content. The brief was disabled rather than
 * fixed, and the toggle kept shipping.
 *
 * Two rules follow from that, and both are load-bearing:
 *   1. Never claim an outfit that doesn't exist. `outfit: null` is a real state
 *      (empty closet, or nothing wearable for the weather) and it gets weather
 *      copy, not a nudge to open the app.
 *   2. Never leave a temperature hole. `weatherOnlyBody` covers the whole line
 *      with no gaps — that's the bug that killed the first version.
 *
 * ─── Where the words come from ──────────────────────────────────────────────
 * The engine already writes the best sentence available: `layering.recommendation`
 * interpolates real garment names via articleDisplayName and appends removability
 * caveats ("heavy to carry if you shed it"). It is also already timeline-aware —
 * when hourly data was supplied it produces the "shed it once temperatures climb"
 * phrasing on its own. So this module *selects* copy rather than competing with
 * it, and only writes prose where the engine has none to offer.
 */

import type { DailyForecast, Settings } from '../types';
import { articleDisplayName } from '../types';
import type { OutfitResult, OutfitRole } from './outfit/types';
import { getWeatherBucket } from './outfit/weatherBuckets';
import { humanizeConditionShort } from './weather/humanizeCondition';

/** Appending past roughly this much reads as a wall of text on a lock screen. */
const BODY_SOFT_LIMIT = 150;

export interface BriefInput {
  day: DailyForecast;
  /** Null when the closet can't dress this day — see buildDayOutfit. */
  outfit: OutfitResult | null;
  city?: string;
  settings: Settings;
  swing: { enabled: boolean; thresholdF: number };
}

export interface BriefContent {
  title: string;
  body: string;
}

// ─── Units ────────────────────────────────────────────────────────────────────

const isMetric = (settings: Settings) => settings.temperatureScale === 'Metric';

const fToC = (f: number) => Math.round((f - 32) * (5 / 9));

/** Bare number in the user's scale — the degree sign is added by the caller so
 *  ranges read "54°–72°" rather than "54°–72°°". */
const temp = (f: number, settings: Settings): number =>
  isMetric(settings) ? fToC(f) : Math.round(f);

/** A *difference* in degrees. Not the same conversion as a temperature: a 20°F
 *  spread is an 11°C spread, and running it through fToC would give -7. */
const tempDelta = (deltaF: number, settings: Settings): number =>
  isMetric(settings) ? Math.round(deltaF * (5 / 9)) : Math.round(deltaF);

/** "Brooklyn, NY" → "Brooklyn". Matches how the old server copy read. */
const shortCity = (city?: string): string => city?.split(',')[0].trim() ?? '';

// ─── Title ────────────────────────────────────────────────────────────────────

/**
 * Weather, glanceable, one line. The outfit goes in the body — a lock screen
 * shows the title in bold and truncates it hard, so it holds the fact that's
 * useful even when everything after it is cut off.
 *
 * Every brief fires on the morning of the day it describes, whatever day it was
 * scheduled on, so it always reads as "today". No weekday label is needed and
 * adding one ("Tue · …") would make an arriving notification look stale.
 */
export function buildBriefTitle({ day, city, settings }: BriefInput): string {
  const condition = humanizeConditionShort(day.dayPhrase);
  const lo = temp(day.minTempF, settings);
  const hi = temp(day.maxTempF, settings);
  const range = lo === hi ? `${hi}°` : `${lo}°–${hi}°`;

  const place = shortCity(city);
  const where = condition
    ? place ? `${condition} in ${place}` : condition
    : place || 'Today';

  return `${where} · ${range}`;
}

// ─── Body ─────────────────────────────────────────────────────────────────────

/**
 * Named garments, most significant first, when there's no layering sentence to
 * use instead. Outer layers lead because they're the decision the user is
 * actually making at 7am; footwear and accessories are dropped rather than
 * padding the line.
 */
const ITEM_ROLE_ORDER: OutfitRole[] = ['outerwear', 'midLayer', 'fullBody', 'top', 'bottom'];

function itemSentence(outfit: OutfitResult): string {
  const names = ITEM_ROLE_ORDER
    .map(role => outfit.slots.find(s => s.role === role))
    .filter((slot): slot is NonNullable<typeof slot> => !!slot)
    .slice(0, 2)
    .map(slot => articleDisplayName(slot.article));

  if (names.length === 0) return '';
  if (names.length === 1) return `${names[0]} today.`;
  return `${names[0]} over your ${names[1].toLowerCase()}.`;
}

/**
 * The fallback when there is no wearable outfit — an empty closet, or a closet
 * with nothing appropriate for the weather.
 *
 * Deliberately full-coverage: every temperature lands on a branch. The version
 * this replaces had no case between 50°F and 75°F and fell through to telling
 * the user to open the app, which is how the whole feature ended up disabled.
 */
function weatherOnlyBody(day: DailyForecast, settings: Settings): string {
  const condition = day.dayPhrase.toLowerCase();
  const hi = day.maxTempF;
  const lo = day.minTempF;

  if (/snow|sleet|flurr|blizzard/.test(condition)) return 'Snow on the way — dress for it.';
  if (day.hasPrecipitation)                        return 'Rain in the forecast — plan on getting wet.';

  if (hi >= 88) return 'A hot one — keep it light and breathable.';
  if (hi >= 75) return 'Warm out — light fabrics will do it.';
  if (lo < 20)  return 'Bitterly cold — full winter gear.';
  if (lo < 32)  return 'Freezing this morning — bundle up.';
  if (lo < 45)  return 'Cold start — you will want a real coat.';
  if (hi >= 60) return 'Mild all day — nothing dramatic needed.';
  return 'Cool out — worth a layer.';
}

/**
 * Layers you can shed, when the day moves enough to be worth mentioning.
 *
 * Skipped when the engine produced a timeline, because a timeline means
 * `layering.recommendation` already said this in better words ("you can drop the
 * jacket as the day warms up") and repeating it in degrees reads like a bug.
 *
 * A wide raw-degree spread isn't enough on its own: an 83°-106° day swings 23°F
 * but never leaves the user's "hot" bucket, so there's no layer to shed in the
 * first place. This only fires when the morning low actually sits in a bucket
 * that wants a layer (cool/cold/freezing, per the user's own hi/lo thresholds)
 * and the afternoon high climbs into a bucket where that layer comes off
 * (warm/hot) — i.e. the day crosses the user's own comfort line, not just any
 * numeric gap.
 */
function swingSuffix({ day, outfit, settings, swing }: BriefInput): string {
  if (!swing.enabled) return '';
  if (outfit?.layering?.timeline?.length) return '';

  const swingF = day.maxTempF - day.minTempF;
  if (swingF < swing.thresholdF) return '';

  const { hiTempThreshold, lowTempThreshold } = settings;
  const loBucket = getWeatherBucket(day.minTempF, hiTempThreshold, lowTempThreshold);
  const hiBucket = getWeatherBucket(day.maxTempF, hiTempThreshold, lowTempThreshold);
  const morningNeedsLayer = loBucket === 'cool' || loBucket === 'cold' || loBucket === 'freezing';
  const afternoonShedsLayer = hiBucket === 'warm' || hiBucket === 'hot';
  if (!morningNeedsLayer || !afternoonShedsLayer) return '';

  const unit = isMetric(settings) ? 'C' : 'F';
  return ` ${tempDelta(swingF, settings)}°${unit} swing — wear layers you can shed.`;
}

export function buildBriefBody(input: BriefInput): string {
  const { outfit, day, settings } = input;

  // The engine's own sentence wins whenever it exists: it names real garments,
  // carries removability caveats, and is already timeline-aware.
  const base =
    outfit?.layering?.recommendation?.trim() ||
    (outfit ? itemSentence(outfit) : '') ||
    weatherOnlyBody(day, settings);

  const suffix = swingSuffix(input);
  if (!suffix) return base;

  // Drop the suffix rather than run past the point where a lock screen stops
  // showing it — a half-visible sentence is worse than one fact fewer.
  return base.length + suffix.length > BODY_SOFT_LIMIT ? base : base + suffix;
}

/** Title + body for one day's brief. */
export function buildBriefContent(input: BriefInput): BriefContent {
  return {
    title: buildBriefTitle(input),
    body: buildBriefBody(input),
  };
}
