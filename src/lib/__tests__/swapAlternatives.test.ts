import { generateOutfits, swapAlternatives, SWAP_MAX_DROP, SWAP_MIN_SCORE } from '../outfitEngine';
import type { ClothingArticle, CurrentWeather, Settings } from '../../types';

const SETTINGS: Settings = {
  clothingStyles: ['Casual'],
  location: 'Test City',
  temperatureScale: 'Imperial',
  hiTempThreshold: 75,
  lowTempThreshold: 50,
  humidityPreference: 50,
};

const weather = (feelsLikeF: number): CurrentWeather => ({
  WeatherText: 'Cloudy',
  HasPrecipitation: false,
  PrecipitationType: null,
  IsDayTime: true,
  Temperature: { Imperial: { Value: feelsLikeF, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
  RealFeelTemperature: { Imperial: { Value: feelsLikeF, Unit: 'F' }, Metric: { Value: 0, Unit: 'C' } },
  Wind: { Speed: { Imperial: { Value: 3 }, Metric: { Value: 0 } } },
  RelativeHumidity: 60,
  UVIndexText: 'Low',
});

const a = (_id: string, clothingType: string, fabricType: string, color = 'Navy', extra: Partial<ClothingArticle> = {}): ClothingArticle =>
  ({ _id, clothingType, name: _id, color, fabricType, ...extra });

const closet = (): ClothingArticle[] => [
  a('Tee', 'T-Shirt', 'Cotton', 'White'),
  a('Oxford', 'Shirt', 'Cotton', 'Navy'),
  a('Polo', 'Shirt', 'Cotton', 'Grey'),
  a('Linen', 'Shirt', 'Linen', 'Beige'),
  a('Jeans', 'Jeans', 'Denim', 'Indigo'),
  a('Chinos', 'Pants', 'Cotton', 'Khaki'),
  a('Sneakers', 'Sneakers', 'Cotton', 'White'),
  a('Loafers', 'Shoes', 'Leather', 'Brown'),
  a('Cap', 'Cap', 'Cotton', 'Navy', { isAccessory: true }),
  a('Hat', 'Hat', 'Cotton', 'Beige', { isAccessory: true }),
  a('Belt', 'Belt', 'Leather', 'Brown', { isAccessory: true }),
];

const W = weather(68);
const best = () => generateOutfits(closet(), W, SETTINGS).results[0];

describe('swapAlternatives', () => {
  it('offers pieces of the same role, never one already in the outfit', () => {
    const outfit = best();
    const top = outfit.slots.find((s) => s.role === 'top')!;
    const options = swapAlternatives(outfit.slots, top.article._id, closet(), W, SETTINGS);
    expect(options.length).toBeGreaterThan(0);
    expect(options.length).toBeLessThanOrEqual(3);
    const inOutfit = new Set(outfit.slots.map((s) => s.article._id));
    for (const o of options) {
      expect(['T-Shirt', 'Shirt']).toContain(o.article.clothingType);
      expect(inOutfit.has(o.article._id)).toBe(false);
      // The swapped outfit has the stand-in in the same place.
      const swapped = o.outfit.slots.find((s) => s.role === 'top')!;
      expect(swapped.article._id).toBe(o.article._id);
      expect(o.outfit.slots).toHaveLength(outfit.slots.length);
    }
  });

  it('only offers alternatives that still score well, best first', () => {
    const outfit = best();
    for (const slot of outfit.slots) {
      const options = swapAlternatives(outfit.slots, slot.article._id, closet(), W, SETTINGS);
      for (const o of options) {
        expect(o.outfit.score).toBeGreaterThanOrEqual(SWAP_MIN_SCORE);
        expect(o.delta).toBeGreaterThanOrEqual(-SWAP_MAX_DROP);
      }
      const scores = options.map((o) => o.outfit.score);
      expect([...scores].sort((x, y) => y - x)).toEqual(scores);
    }
  });

  it('swaps an accessory only for one worn in the same place', () => {
    const slots = [
      ...best().slots.filter((s) => s.role !== 'accessory'),
      { role: 'accessory' as const, article: closet().find((x) => x._id === 'Cap')! },
    ];
    const options = swapAlternatives(slots, 'Cap', closet(), W, SETTINGS);
    for (const o of options) expect(['Hat', 'Cap']).toContain(o.article.clothingType);
    expect(options.some((o) => o.article._id === 'Belt')).toBe(false);
  });

  it("doesn't offer pieces ruled out for the weather (shorts in the cold)", () => {
    const cold = weather(25);
    const withShorts = [...closet(), a('Shorts', 'Shorts', 'Cotton', 'Khaki')];
    const outfit = generateOutfits(withShorts, cold, SETTINGS).results[0];
    const bottom = outfit.slots.find((s) => s.role === 'bottom')!;
    const ids = swapAlternatives(outfit.slots, bottom.article._id, withShorts, cold, SETTINGS, undefined, undefined, undefined, 10)
      .map((o) => o.article._id);
    expect(ids).not.toContain('Shorts');
  });

  it('returns nothing for a piece not in the outfit, or with no stand-ins', () => {
    const outfit = best();
    expect(swapAlternatives(outfit.slots, 'nope', closet(), W, SETTINGS)).toEqual([]);
    const lean = closet().filter((x) => !['Polo', 'Linen', 'Oxford', 'Tee'].includes(x._id) || outfit.slots.some((s) => s.article._id === x._id));
    const top = outfit.slots.find((s) => s.role === 'top')!;
    expect(swapAlternatives(outfit.slots, top.article._id, lean, W, SETTINGS)).toEqual([]);
  });

  it('rescores the whole outfit like generateOutfits does', () => {
    const outfit = best();
    const top = outfit.slots.find((s) => s.role === 'top')!;
    const [first] = swapAlternatives(outfit.slots, top.article._id, closet(), W, SETTINGS);
    // Swapping back to the original piece reproduces the original score.
    const back = swapAlternatives(first.outfit.slots, first.article._id, closet(), W, SETTINGS)
      .find((o) => o.article._id === top.article._id);
    if (back) expect(back.outfit.score).toBe(outfit.score);
    expect(Array.isArray(first.outfit.notes)).toBe(true);
    expect(first.outfit.headline).toBe(outfit.headline);
  });
});
