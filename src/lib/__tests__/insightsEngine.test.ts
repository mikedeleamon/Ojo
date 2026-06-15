import { computeInsights } from '../insightsEngine';
import type { Closet, OutfitHistoryEntry } from '../../types';

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const article = (id: string) =>
  ({ _id: id, clothingType: 'Shirt', name: id } as any);

const closet: Closet = {
  _id: 'closet1',
  name: 'Main',
  userId: 'u1',
  isPreferred: true,
  articles: [
    article('a'), // worn 3x, last 5d ago
    article('b'), // worn 1x, 100d ago
    article('c'), // never worn
    article('d'), // worn 1x, 45d ago — the boundary case
  ],
};

const history: OutfitHistoryEntry[] = [
  { id: '1', wornAt: daysAgo(5),   closetId: 'closet1', closetName: 'Main', articleIds: ['a'], articleSummary: '' },
  { id: '2', wornAt: daysAgo(10),  closetId: 'closet1', closetName: 'Main', articleIds: ['a'], articleSummary: '' },
  { id: '3', wornAt: daysAgo(20),  closetId: 'closet1', closetName: 'Main', articleIds: ['a'], articleSummary: '' },
  { id: '4', wornAt: daysAgo(100), closetId: 'closet1', closetName: 'Main', articleIds: ['b'], articleSummary: '' },
  { id: '5', wornAt: daysAgo(45),  closetId: 'closet1', closetName: 'Main', articleIds: ['d'], articleSummary: '' },
];

describe('insightsEngine — wardrobe health', () => {
  it('counts all-time wears per article regardless of window', async () => {
    const data = await computeInsights([closet], history, 90);
    const wears = Object.fromEntries(data.articles.map(i => [i.article._id, i.totalWears]));
    expect(wears).toEqual({ a: 3, b: 1, d: 1, c: 0 });
  });

  // Regression: the range chip used to move only the "active" side while
  // "sleeping" stayed pinned at 90 days, so items in the gap vanished (30-day
  // window) or were double-counted (365-day window). active + sleeping must
  // always partition the wardrobe exactly.
  it.each([30, 90, 365])(
    'active + sleeping partitions the wardrobe at the %i-day window',
    async (win) => {
      const { activeArticles, sleepingArticles, totalArticles } =
        (await computeInsights([closet], history, win)).health;
      expect(activeArticles + sleepingArticles).toBe(totalArticles);
    },
  );

  it('moves an item between active and sleeping as the window changes', async () => {
    // Item `d` was worn 45 days ago: active at 90, sleeping at 30.
    const at30 = await computeInsights([closet], history, 30);
    const at90 = await computeInsights([closet], history, 90);
    expect(at30.health.activeArticles).toBe(1); // only `a` (5d)
    expect(at90.health.activeArticles).toBe(2); // `a` + `d`
  });
});
