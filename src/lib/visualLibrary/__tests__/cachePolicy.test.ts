import { cacheFileName, evictionPlan, libraryUrl, type CachedEntry } from '../cachePolicy';

describe('libraryUrl', () => {
  const asset = { path: 'plates/rain.day.3f9a1c2e.jpg', bytes: 1 };

  it('joins the base URL and path with exactly one slash', () => {
    expect(libraryUrl('https://cdn.example.com/library/v1', asset))
      .toBe('https://cdn.example.com/library/v1/plates/rain.day.3f9a1c2e.jpg');
    expect(libraryUrl('https://cdn.example.com/library/v1/', { ...asset, path: '/plates/x.00000000.jpg' }))
      .toBe('https://cdn.example.com/library/v1/plates/x.00000000.jpg');
  });

  it('returns null without a base URL, so dev builds fall back instead of failing', () => {
    expect(libraryUrl(undefined, asset)).toBeNull();
    expect(libraryUrl('', asset)).toBeNull();
    expect(libraryUrl('   ', asset)).toBeNull();
  });
});

describe('cacheFileName', () => {
  it('flattens a library path into one file name', () => {
    expect(cacheFileName('plates/rain.day.3f9a1c2e.jpg')).toBe('plates__rain.day.3f9a1c2e.jpg');
    expect(cacheFileName('/loops/rain.poster.1c0ffee2.jpg')).toBe('loops__rain.poster.1c0ffee2.jpg');
  });
});

describe('evictionPlan', () => {
  const entries: CachedEntry[] = [
    { name: 'newest', bytes: 40, modifiedAt: 300 },
    { name: 'oldest', bytes: 40, modifiedAt: 100 },
    { name: 'middle', bytes: 40, modifiedAt: 200 },
  ];

  it('evicts nothing while the cache is under the cap', () => {
    expect(evictionPlan(entries, 120)).toEqual([]);
  });

  it('evicts oldest downloads first, only until back under the cap', () => {
    expect(evictionPlan(entries, 80)).toEqual(['oldest']);
    expect(evictionPlan(entries, 40)).toEqual(['oldest', 'middle']);
  });

  it('never evicts a kept file, even if that leaves the cache over the cap', () => {
    expect(evictionPlan(entries, 40, new Set(['oldest']))).toEqual(['middle', 'newest']);
    expect(evictionPlan(entries, 0, new Set(['oldest', 'middle', 'newest']))).toEqual([]);
  });
});
