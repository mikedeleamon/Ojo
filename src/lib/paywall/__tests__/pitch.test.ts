import {
  DEFAULT_FEATURE_ORDER,
  EMPTY_PROOF,
  FEATURE_COPY,
  featureFor,
  featureOrder,
  parsePaywallFrom,
  pitchFor,
} from '../pitch';
import { FREE_ITEM_LIMIT } from '../../../config/limits';

describe('parsePaywallFrom', () => {
  it('accepts every known source', () => {
    for (const v of ['items', 'closets', 'trips', 'styledna', 'settings', 'learning', 'recap']) {
      expect(parsePaywallFrom(v)).toBe(v);
    }
  });

  it('falls back to the general pitch for missing, unknown or odd values', () => {
    expect(parsePaywallFrom(undefined)).toBe('settings');
    expect(parsePaywallFrom('')).toBe('settings');
    expect(parsePaywallFrom('ITEMS')).toBe('settings');
    expect(parsePaywallFrom(42)).toBe('settings');
  });

  it('takes the first value when expo-router hands over an array', () => {
    expect(parsePaywallFrom(['trips', 'items'])).toBe('trips');
  });
});

describe('featureOrder', () => {
  it('leads with the feature the person came for and keeps the rest in order', () => {
    expect(featureOrder('trips')).toEqual(['trips', 'items', 'closets', 'styledna']);
    expect(featureOrder('styledna')).toEqual(['styledna', 'items', 'closets', 'trips']);
  });

  it('sends both moments to Style DNA', () => {
    expect(featureFor('learning')).toBe('styledna');
    expect(featureFor('recap')).toBe('styledna');
  });

  it('keeps the resting order for the general pitch', () => {
    expect(featureOrder('settings')).toEqual([...DEFAULT_FEATURE_ORDER]);
  });

  it('always lists all four features once', () => {
    for (const from of ['items', 'closets', 'trips', 'styledna', 'settings', 'learning', 'recap'] as const) {
      expect([...featureOrder(from)].sort()).toEqual([...DEFAULT_FEATURE_ORDER].sort());
    }
  });
});

describe('pitchFor', () => {
  it('uses the real item count when there is one', () => {
    const p = pitchFor('items', { ...EMPTY_PROOF, itemCount: 38 });
    expect(p.subhead).toContain(`38 of your ${FREE_ITEM_LIMIT} free pieces`);
  });

  it('never claims more free items than the limit for an account over the cap', () => {
    const p = pitchFor('items', { ...EMPTY_PROOF, itemCount: FREE_ITEM_LIMIT + 13 });
    expect(p.subhead).not.toContain(`of your ${FREE_ITEM_LIMIT} free`);
    expect(p.subhead).toContain(`${FREE_ITEM_LIMIT + 13} of your pieces stay`);
  });

  it('never shows a zero count', () => {
    expect(pitchFor('items', EMPTY_PROOF).subhead).not.toMatch(/\b0 of\b/);
    expect(pitchFor('styledna', EMPTY_PROOF).subhead).not.toMatch(/\b0 outfits\b/);
  });

  it('names the saved trip when there is one', () => {
    expect(pitchFor('trips', { ...EMPTY_PROOF, tripName: 'Lisbon' }).subhead).toContain('Lisbon');
    expect(pitchFor('trips', EMPTY_PROOF).subhead).not.toContain('null');
  });

  it('mentions the outfit count only once Style DNA has colors', () => {
    const learned = { ...EMPTY_PROOF, outfitCount: 86, topColors: ['navy'] };
    expect(pitchFor('styledna', learned).subhead).toContain('86 outfits');
    expect(pitchFor('recap', learned).headline).toBe(pitchFor('styledna', learned).headline);
  });

  it('gives every source a headline and subhead', () => {
    for (const from of ['items', 'closets', 'trips', 'styledna', 'settings', 'learning', 'recap'] as const) {
      const p = pitchFor(from, EMPTY_PROOF);
      expect(p.headline.length).toBeGreaterThan(0);
      expect(p.subhead.length).toBeGreaterThan(0);
    }
  });
});

describe('FEATURE_COPY', () => {
  it('states the free limit it lifts', () => {
    expect(FEATURE_COPY.items.body).toContain(String(FREE_ITEM_LIMIT));
  });
});
