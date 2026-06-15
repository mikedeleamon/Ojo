import {
  derivePreferenceProfile,
  computeStyleDNA,
} from '../userPreferences';
import type { Closet, OutfitHistoryEntry } from '../../types';

const article = (id: string, color?: string, fabricType?: string, clothingCategory?: string) =>
  ({ _id: id, clothingType: 'x', color, fabricType, clothingCategory } as any);

const closet: Closet = {
  _id: 'c1',
  name: 'Main',
  userId: 'u1',
  isPreferred: true,
  articles: [
    article('shirt1', 'Navy', 'Cotton', 'Top'),
    article('pant1', 'Rust', 'Denim', 'Bottom'),
  ],
};

const entry = (id: string, articleIds: string[]): OutfitHistoryEntry => ({
  id, articleIds, wornAt: new Date().toISOString(),
  closetId: 'c1', closetName: 'Main', articleSummary: '',
});

describe('derivePreferenceProfile', () => {
  it('aggregates colour/fabric/category/pair counts from history', () => {
    const history = [
      entry('1', ['shirt1', 'pant1']),
      entry('2', ['shirt1']),
    ];
    const p = derivePreferenceProfile([closet], history);

    expect(p.totalOutfits).toBe(2);
    expect(p.colors).toEqual({ Navy: 2, Rust: 1 });
    expect(p.fabrics).toEqual({ Cotton: 2, Denim: 1 });
    expect(p.categories).toEqual({ Top: 2, Bottom: 1 });
    expect(p.colorPairs).toEqual({ 'Navy|Rust': 1 });
  });

  it('counts an outfit toward totalOutfits even when its articles were deleted', () => {
    // 'ghost' is not in any closet — its attributes can't be recovered, but the
    // outfit still happened, so the logged-outfit count must include it.
    const history = [entry('1', ['shirt1']), entry('2', ['ghost'])];
    const p = derivePreferenceProfile([closet], history);

    expect(p.totalOutfits).toBe(2);
    expect(p.colors).toEqual({ Navy: 1 }); // ghost contributes nothing
  });

  it('returns an empty profile for empty inputs', () => {
    const p = derivePreferenceProfile([], []);
    expect(p).toEqual({ colors: {}, fabrics: {}, categories: {}, colorPairs: {}, totalOutfits: 0 });
    expect(computeStyleDNA(p).level).toBe('none');
  });

  it('canonicalises colour pairs regardless of article order', () => {
    const p1 = derivePreferenceProfile([closet], [entry('1', ['shirt1', 'pant1'])]);
    const p2 = derivePreferenceProfile([closet], [entry('1', ['pant1', 'shirt1'])]);
    expect(Object.keys(p1.colorPairs)).toEqual(['Navy|Rust']);
    expect(Object.keys(p2.colorPairs)).toEqual(['Navy|Rust']);
  });
});
