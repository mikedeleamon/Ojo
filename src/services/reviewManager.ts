/**
 * Decides *when* to ask for a review; reviewService.ts decides *how*.
 * All state is device-global (not scoped per user) — a rating prompt is about
 * the install, not the account, and this must survive logout/login.
 */

import { storage, storageGetJSON, storageSetJSON } from '../lib/storage';
import { canRequestReview, requestReview } from './reviewService';
import {
  ReviewState,
  DEFAULT_REVIEW_STATE,
  isEligibleForPrompt,
  isSameCalendarDay,
} from './reviewEligibility';

const STORAGE_KEY = 'ojo_review_manager_state_v1';

const loadState = (): Promise<ReviewState> =>
  storageGetJSON<ReviewState>(storage, STORAGE_KEY, DEFAULT_REVIEW_STATE);

const saveState = (state: ReviewState): Promise<void> =>
  storageSetJSON(storage, STORAGE_KEY, state);

export const recordAppOpen = async (): Promise<void> => {
  const state = await loadState();
  await saveState({
    ...state,
    firstLaunchDate: state.firstLaunchDate ?? new Date().toISOString(),
    appOpenCount: state.appOpenCount + 1,
  });
};

export const recordSuccessfulOutfit = async (): Promise<void> => {
  const state = await loadState();
  const now = new Date();
  if (state.lastSuccessfulOutfitDate && isSameCalendarDay(state.lastSuccessfulOutfitDate, now)) {
    return;
  }
  await saveState({
    ...state,
    successfulOutfitCount: state.successfulOutfitCount + 1,
    lastSuccessfulOutfitDate: now.toISOString(),
  });
};

export const markRated = async (): Promise<void> => {
  const state = await loadState();
  await saveState({ ...state, hasRated: true });
};

export const maybeRequestReview = async (): Promise<void> => {
  try {
    const state = await loadState();
    if (!isEligibleForPrompt(state)) return;
    if (!(await canRequestReview())) return;

    const invoked = await requestReview();
    if (!invoked) return;

    // Neither platform reports whether the user actually rated, so a
    // successful invocation is treated as the one and only automatic ask.
    await saveState({ ...state, lastPromptDate: new Date().toISOString(), hasRated: true });
  } catch {}
};
