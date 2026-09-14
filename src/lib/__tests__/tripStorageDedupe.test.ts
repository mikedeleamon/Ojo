/**
 * `upsertPlan` is idempotent by trip, not just by id.
 *
 * A planner session that didn't open a saved plan mints a fresh id, so planning
 * a trip the user already had saved used to write a second record for it — and
 * two records for one trip means two identical Trip Mode nudges every morning
 * of it.
 */

const mockStore: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem:    jest.fn(async (k: string) => mockStore[k] ?? null),
    setItem:    jest.fn(async (k: string, v: string) => { mockStore[k] = v; }),
    removeItem: jest.fn(async (k: string) => { delete mockStore[k]; }),
    clear:      jest.fn(async () => {}),
  },
}));

jest.mock('../../api/client', () => ({
  __esModule: true,
  default: {
    get:    jest.fn(async () => ({ data: [] })),
    post:   jest.fn(async () => ({ data: {} })),
    delete: jest.fn(async () => ({})),
  },
}));

import { upsertPlan, loadLocalPlans, findTwinPlan } from '../tripStorage';
import type { SavedTripFitPlan } from '../../types';

const plan = (over: Partial<SavedTripFitPlan> = {}): SavedTripFitPlan => ({
  id:          'id-1',
  destination: 'Ocho Rios',
  lat:         18.4,
  lon:         -77.1,
  startDate:   '2026-09-08',
  endDate:     '2026-09-11',
  occasion:    'everyday',
  closetId:    'closet-1',
  days:        [],
  checkedIds:  [],
  createdAt:   '2026-09-01T00:00:00.000Z',
  updatedAt:   '2026-09-01T00:00:00.000Z',
  ...over,
});

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
});

describe('upsertPlan de-duplication', () => {
  it('folds a freshly-minted id into the saved trip for the same city and dates', async () => {
    await upsertPlan(plan({ id: 'first' }));
    const saved = await upsertPlan(plan({ id: 'second-session' }));

    expect(saved.id).toBe('first');
    expect(await loadLocalPlans()).toHaveLength(1);
  });

  it('keeps the original creation date when it adopts a record', async () => {
    await upsertPlan(plan({ id: 'first', createdAt: '2026-08-01T00:00:00.000Z' }));
    const saved = await upsertPlan(
      plan({ id: 'second-session', createdAt: '2026-09-05T00:00:00.000Z' }),
    );

    expect(saved.createdAt).toBe('2026-08-01T00:00:00.000Z');
  });

  it('still writes the new session’s content onto the adopted record', async () => {
    await upsertPlan(plan({ id: 'first', name: 'Old name' }));
    await upsertPlan(plan({ id: 'second-session', name: 'New name' }));

    const stored = await loadLocalPlans();
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('New name');
  });

  it('ignores case and padding in the destination', async () => {
    await upsertPlan(plan({ id: 'first', destination: 'Ocho Rios' }));
    const saved = await upsertPlan(plan({ id: 'second', destination: '  ocho rios  ' }));

    expect(saved.id).toBe('first');
    expect(await loadLocalPlans()).toHaveLength(1);
  });

  it('treats a different city as a different trip', async () => {
    await upsertPlan(plan({ id: 'first' }));
    const saved = await upsertPlan(plan({ id: 'second', destination: 'Kingston' }));

    expect(saved.id).toBe('second');
    expect(await loadLocalPlans()).toHaveLength(2);
  });

  it('treats different dates as a different trip', async () => {
    await upsertPlan(plan({ id: 'first' }));
    const saved = await upsertPlan(
      plan({ id: 'second', startDate: '2026-10-08', endDate: '2026-10-11' }),
    );

    expect(saved.id).toBe('second');
    expect(await loadLocalPlans()).toHaveLength(2);
  });

  // Editing a saved plan is never a duplicate of anything: the id is already
  // known, so it updates in place even if the user retyped its dates to match
  // another trip's. Merging two existing records would silently destroy one.
  it('updates in place without adopting when the id is already known', async () => {
    await upsertPlan(plan({ id: 'first' }));
    await upsertPlan(plan({ id: 'second', destination: 'Kingston' }));

    const saved = await upsertPlan(plan({ id: 'second', destination: 'Ocho Rios' }));

    expect(saved.id).toBe('second');
    expect(await loadLocalPlans()).toHaveLength(2);
  });

  it('stamps updatedAt on every write', async () => {
    const saved = await upsertPlan(plan({ updatedAt: '2020-01-01T00:00:00.000Z' }));
    expect(saved.updatedAt).not.toBe('2020-01-01T00:00:00.000Z');
  });
});

/**
 * `findTwinPlan` is no longer private to `upsertPlan`: the free-tier trip cap
 * calls it to decide whether a save would actually create a record before it
 * charges a slot for it (TripPlanner's `blockedByFreeLimit`). A wrong answer
 * here now paywalls a user out of their own saved trip, so the lookup is
 * pinned directly rather than only through upsertPlan.
 */
describe('findTwinPlan', () => {
  const saved = [plan({ id: 'a', destination: 'Ocho Rios' })];

  it('finds the record a re-planned trip would be folded into', () => {
    expect(
      findTwinPlan(saved, {
        destination: 'Ocho Rios',
        startDate:   '2026-09-08',
        endDate:     '2026-09-11',
      })?.id,
    ).toBe('a');
  });

  it('matches the same city typed with different case and padding', () => {
    expect(
      findTwinPlan(saved, {
        destination: '  ocho rios ',
        startDate:   '2026-09-08',
        endDate:     '2026-09-11',
      })?.id,
    ).toBe('a');
  });

  it('returns undefined for a different city', () => {
    expect(
      findTwinPlan(saved, {
        destination: 'Kingston',
        startDate:   '2026-09-08',
        endDate:     '2026-09-11',
      }),
    ).toBeUndefined();
  });

  it('returns undefined when either date differs', () => {
    expect(
      findTwinPlan(saved, {
        destination: 'Ocho Rios',
        startDate:   '2026-09-08',
        endDate:     '2026-09-12',
      }),
    ).toBeUndefined();
  });

  it('returns undefined against an empty library', () => {
    expect(
      findTwinPlan([], {
        destination: 'Ocho Rios',
        startDate:   '2026-09-08',
        endDate:     '2026-09-11',
      }),
    ).toBeUndefined();
  });
});
