import { extractLayers } from '../extractLayers';
import type { OutfitSlot } from '../../outfit/types';
import type { ClothingArticle } from '../../../types';

const article = (id: string, clothingType = 'T-Shirt'): ClothingArticle => ({
  _id: id,
  clothingType,
});

const slot = (role: OutfitSlot['role'], id: string): OutfitSlot => ({
  role,
  article: article(id),
});

describe('extractLayers', () => {
  it('returns nulls for an empty outfit', () => {
    expect(extractLayers([])).toEqual({ base: null, mid: null, outer: null });
  });

  it('picks the first top as base and ignores second top', () => {
    const slots = [slot('top', 'a'), slot('top', 'b')];
    const { base } = extractLayers(slots);
    expect(base?.article._id).toBe('a');
  });

  it('treats fullBody as base', () => {
    const slots = [slot('fullBody', 'd')];
    expect(extractLayers(slots).base?.article._id).toBe('d');
  });

  it('separates mid and outer', () => {
    const slots = [
      slot('top', 'tee'),
      slot('midLayer', 'hood'),
      slot('outerwear', 'coat'),
      slot('bottom', 'jeans'),
      slot('footwear', 'shoes'),
    ];
    const { base, mid, outer } = extractLayers(slots);
    expect(base?.article._id).toBe('tee');
    expect(mid?.article._id).toBe('hood');
    expect(outer?.article._id).toBe('coat');
  });

  it('ignores bottom/footwear/accessory roles', () => {
    const slots = [
      slot('bottom', 'b'),
      slot('footwear', 'f'),
      slot('accessory', 'a'),
    ];
    expect(extractLayers(slots)).toEqual({ base: null, mid: null, outer: null });
  });
});
