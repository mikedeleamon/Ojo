import { roleOf, zoneOf, articleZoneLabel, buildAccCombos } from '../roles';
import type { ClothingArticle } from '../../../types';

const a = (clothingType: string, extra: Partial<ClothingArticle> = {}): ClothingArticle => ({
  _id: clothingType,
  clothingType,
  ...extra,
});

describe('roleOf', () => {
  it('maps known types correctly', () => {
    expect(roleOf(a('T-Shirt'))).toBe('top');
    expect(roleOf(a('Jeans'))).toBe('bottom');
    expect(roleOf(a('Dress'))).toBe('fullBody');
    expect(roleOf(a('Hoodie'))).toBe('midLayer');
    expect(roleOf(a('Coat'))).toBe('outerwear');
    expect(roleOf(a('Sneakers'))).toBe('footwear');
    expect(roleOf(a('Hat'))).toBe('accessory');
  });

  it('falls back to top for unknown non-accessory, accessory for isAccessory', () => {
    expect(roleOf(a('Cape'))).toBe('top');
    expect(roleOf(a('Cape', { isAccessory: true }))).toBe('accessory');
  });
});

describe('zoneOf / articleZoneLabel', () => {
  it('uses bodyZone when set', () => {
    expect(zoneOf(a('Hat', { bodyZone: 'Neck' }))).toBe('Neck');
  });
  it('falls back to clothingType heuristic', () => {
    expect(zoneOf(a('Watch'))).toBe('Wrist');
    expect(zoneOf(a('Belt'))).toBe('Waist');
  });
  it('articleZoneLabel returns Extra for unknown items', () => {
    expect(articleZoneLabel(a('MysteryItem'))).toBe('Extra');
  });
});

describe('buildAccCombos', () => {
  it('always includes the empty combo', () => {
    const combos = buildAccCombos([]);
    expect(combos).toEqual([[]]);
  });

  it('includes singles and non-competing pairs', () => {
    const items = [a('Hat'), a('Watch'), a('Cap')]; // Hat+Cap share Head zone
    const combos = buildAccCombos(items);
    // empty + 3 singles + Hat/Watch + Watch/Cap (Hat/Cap excluded — same zone)
    expect(combos).toHaveLength(1 + 3 + 2);
  });

  it('caps at 4 items', () => {
    const items = Array.from({ length: 10 }, (_, i) => a(`Watch${i}`));
    // All share Wrist zone, so no pairs survive — only empty + 4 singles.
    const combos = buildAccCombos(items);
    expect(combos).toHaveLength(1 + 4);
  });
});
