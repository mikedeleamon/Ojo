import { recordGaps, getGapSuggestions, clearGapHistory } from '../wardrobeGaps';

const mockStore = new Map<string, string>();

jest.mock('../storage', () => ({
  storage: {
    getItem:    async (k: string) => mockStore.get(k) ?? null,
    setItem:    async (k: string, v: string) => { mockStore.set(k, v); },
    removeItem: async (k: string) => { mockStore.delete(k); },
  },
  storageGetJSON: async <T,>(s: { getItem: (k: string) => Promise<string | null> }, k: string, fallback: T) => {
    const raw = await s.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  },
}));

const onDay = (day: number) => jest.setSystemTime(new Date(2026, 9, day, 9, 0));

beforeEach(() => {
  mockStore.clear();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'queueMicrotask', 'setImmediate'] });
  onDay(1);
});

afterEach(() => jest.useRealTimers());

describe('wardrobeGaps', () => {
  it('records nothing for an empty list', async () => {
    await recordGaps([]);
    expect(mockStore.size).toBe(0);
  });

  it('counts a gap once per day, however many outfits report it', async () => {
    for (let i = 0; i < 5; i++) await recordGaps(['missing_coat']);
    expect(await getGapSuggestions()).toEqual([]);
  });

  it('suggests a gap once it has fired on four days', async () => {
    for (const day of [1, 3, 5]) {
      onDay(day);
      await recordGaps(['missing_coat', 'missing_mid_layer']);
    }
    expect(await getGapSuggestions()).toEqual([]);

    onDay(7);
    await recordGaps(['missing_coat']);
    const suggestions = await getGapSuggestions();
    expect(suggestions.map(s => [s.type, s.count])).toEqual([['missing_coat', 4]]);
    expect(suggestions[0].message).toMatch(/coat/);
  });

  it('ignores events from the old note-matching key', async () => {
    const stale = [1, 2, 3, 4, 5].map(d => ({ type: 'missing_rain_layer', date: new Date(2026, 9, d).toISOString() }));
    mockStore.set('ojo_wardrobe_gaps', JSON.stringify(stale));
    onDay(6);
    expect(await getGapSuggestions()).toEqual([]);
  });

  it('clearing history removes the old key too', async () => {
    mockStore.set('ojo_wardrobe_gaps', '[]');
    await recordGaps(['missing_boots']);
    await clearGapHistory();
    expect(mockStore.size).toBe(0);
  });
});
