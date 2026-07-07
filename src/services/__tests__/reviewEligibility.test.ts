import { isEligibleForPrompt } from '../reviewEligibility';

const NOW = new Date('2026-07-07T12:00:00Z');

const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

const ELIGIBLE_STATE = {
  firstLaunchDate: daysAgo(10),
  appOpenCount: 7,
  successfulOutfitCount: 5,
  lastPromptDate: null,
  lastSuccessfulOutfitDate: null,
  hasRated: false,
};

describe('isEligibleForPrompt', () => {
  it('is eligible once every threshold is met', () => {
    expect(isEligibleForPrompt(ELIGIBLE_STATE, NOW)).toBe(true);
  });

  it('is not eligible once the user has rated', () => {
    expect(isEligibleForPrompt({ ...ELIGIBLE_STATE, hasRated: true }, NOW)).toBe(false);
  });

  it('is not eligible below the app-open threshold', () => {
    expect(isEligibleForPrompt({ ...ELIGIBLE_STATE, appOpenCount: 6 }, NOW)).toBe(false);
  });

  it('is not eligible below the successful-outfit threshold', () => {
    expect(isEligibleForPrompt({ ...ELIGIBLE_STATE, successfulOutfitCount: 4 }, NOW)).toBe(false);
  });

  it('is not eligible before the install is 7 days old', () => {
    expect(isEligibleForPrompt({ ...ELIGIBLE_STATE, firstLaunchDate: daysAgo(6) }, NOW)).toBe(false);
  });

  it('is not eligible with no recorded firstLaunchDate', () => {
    expect(isEligibleForPrompt({ ...ELIGIBLE_STATE, firstLaunchDate: null }, NOW)).toBe(false);
  });

  it('is not eligible within 120 days of the last prompt', () => {
    expect(isEligibleForPrompt({ ...ELIGIBLE_STATE, lastPromptDate: daysAgo(119) }, NOW)).toBe(false);
  });

  it('is eligible again once 120 days have passed since the last prompt', () => {
    expect(isEligibleForPrompt({ ...ELIGIBLE_STATE, lastPromptDate: daysAgo(120) }, NOW)).toBe(true);
  });
});
