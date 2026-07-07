/**
 * Pure eligibility logic for reviewManager.ts, split out so it can be unit
 * tested without pulling in AsyncStorage/expo-store-review — neither
 * transforms cleanly under this project's node-environment jest config.
 */

const MIN_APP_OPENS             = 7;
const MIN_SUCCESSFUL_OUTFITS    = 5;
const MIN_DAYS_SINCE_INSTALL    = 7;
const MIN_DAYS_BETWEEN_PROMPTS  = 120;

export interface ReviewState {
  firstLaunchDate: string | null;
  appOpenCount: number;
  successfulOutfitCount: number;
  lastPromptDate: string | null;
  // Not part of the original spec's persisted fields — needed so a single
  // outfit screen re-rendering repeatedly (weather refresh, preference
  // changes, etc.) doesn't inflate successfulOutfitCount past the threshold
  // in minutes.
  lastSuccessfulOutfitDate: string | null;
  hasRated: boolean;
}

export const DEFAULT_REVIEW_STATE: ReviewState = {
  firstLaunchDate: null,
  appOpenCount: 0,
  successfulOutfitCount: 0,
  lastPromptDate: null,
  lastSuccessfulOutfitDate: null,
  hasRated: false,
};

const daysSince = (isoDate: string, now: Date): number =>
  (now.getTime() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24);

export const isSameCalendarDay = (isoDate: string, now: Date): boolean =>
  new Date(isoDate).toDateString() === now.toDateString();

export const isEligibleForPrompt = (state: ReviewState, now: Date = new Date()): boolean => {
  if (state.hasRated) return false;
  if (state.appOpenCount < MIN_APP_OPENS) return false;
  if (state.successfulOutfitCount < MIN_SUCCESSFUL_OUTFITS) return false;
  if (!state.firstLaunchDate || daysSince(state.firstLaunchDate, now) < MIN_DAYS_SINCE_INSTALL) return false;
  if (state.lastPromptDate && daysSince(state.lastPromptDate, now) < MIN_DAYS_BETWEEN_PROMPTS) return false;
  return true;
};
