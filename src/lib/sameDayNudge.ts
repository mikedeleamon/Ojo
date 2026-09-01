/**
 * sameDayNudge.ts
 * ────────────────
 * Filtering + copy for the Same-Day Weather Nudge — a push fired at the actual
 * clock hour buildTimeline (layeringEngine.ts) flags a real same-day change,
 * rather than only mentioning it once, vaguely, in the morning brief.
 *
 * Pure and synchronous — no RN imports, no storage, no clock beyond what's
 * passed in — same shape as morningBrief.ts, so every branch is unit-testable.
 * Scheduling lives in lib/notifications.ts; the trigger hook lives in
 * hooks/useSameDayNudgeScheduler.ts.
 *
 * buildTimeline's action strings are already complete, garment-named
 * sentences ("Remove your denim jacket — warming up"), so this module selects
 * and formats rather than composing prose from scratch — same "let the engine's
 * own words win" principle morningBrief.ts follows for the brief body.
 */

import type { WidgetTimelineStep } from './widget/snapshot.types';

/** Below this much runway, a push reads as late rather than useful. */
export const NUDGE_MIN_LEAD_MINUTES = 90;

/** A push is a far more intrusive surface than a line of brief body text —
 *  capped well under buildTimeline's own 5-step limit. */
export const NUDGE_MAX_PER_DAY = 2;

/**
 * buildTimeline's fixed template set, minus "Keep your {layer} on" — that one
 * is a reassurance about *now* (derived from the first forecast hour), not a
 * change to interrupt someone about later. Mirrors the same prefix-matching
 * Snapshot.swift already does for icon selection (see WidgetTimelineStep's doc
 * comment in widget/snapshot.types.ts). If buildTimeline gains a new action
 * template, both places need updating — nothing shares this list across
 * TS/Swift today.
 */
const CHANGE_PREFIXES = ['Remove ', 'Add ', 'Rain starts', 'Rain clears'];

const isChangeStep = (step: WidgetTimelineStep): boolean =>
  CHANGE_PREFIXES.some(prefix => step.action.startsWith(prefix));

export interface NudgeCandidate {
  step:   WidgetTimelineStep;
  fireAt: Date;
}

/**
 * Filters today's timeline down to steps worth an actual push: real changes
 * only, far enough out to be useful, earliest first, capped at
 * NUDGE_MAX_PER_DAY.
 */
export function selectNudgeworthySteps(
  timeline: WidgetTimelineStep[] | undefined,
  now: Date,
): NudgeCandidate[] {
  if (!timeline || timeline.length === 0) return [];

  const minLeadMs = NUDGE_MIN_LEAD_MINUTES * 60_000;

  const candidates = timeline
    .filter(isChangeStep)
    .map((step): NudgeCandidate => {
      const fireAt = new Date(now);
      fireAt.setHours(step.hour, 0, 0, 0);
      return { step, fireAt };
    })
    .filter(({ fireAt }) => fireAt.getTime() - now.getTime() >= minLeadMs)
    .sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());

  return candidates.slice(0, NUDGE_MAX_PER_DAY);
}

// ─── Content ──────────────────────────────────────────────────────────────────

const HOUR_LABEL = (h: number): string => {
  const period = h < 12 ? 'AM' : 'PM';
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
};

/** "Brooklyn, NY" → "Brooklyn". Matches morningBrief.ts's shortCity. */
const shortCity = (city?: string): string => city?.split(',')[0].trim() ?? '';

export interface NudgeContentInput {
  step: WidgetTimelineStep;
  city?: string;
}

/** Clock time + place — holds the useful fact even if a lock screen truncates
 *  the rest. Falls back gracefully without a city. */
export function buildNudgeTitle({ step, city }: NudgeContentInput): string {
  const time = HOUR_LABEL(step.hour);
  const place = shortCity(city);
  return place ? `${time} in ${place}` : `${time} weather update`;
}

/** buildTimeline's own action text, verbatim — reused, not re-derived. */
export function buildNudgeBody({ step }: NudgeContentInput): string {
  const action = step.action.trim();
  return /[.!?]$/.test(action) ? action : `${action}.`;
}

export function buildNudgeContent(input: NudgeContentInput): { title: string; body: string } {
  return {
    title: buildNudgeTitle(input),
    body: buildNudgeBody(input),
  };
}
