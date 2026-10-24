/**
 * Outfit history and TripFit plans sync through an outbox (see syncOutbox.ts).
 *
 * Before it, each change was posted once and a one-time migration latched
 * after its first success, so anything saved while offline after that never
 * reached the server. These pin the outbox's promises: queued changes retry
 * until they land, and a local record the server lacks is only re-sent when
 * this device queued it (otherwise another device deleted it).
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
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import api from '../../api/client';
import { addHistoryEntry, clearHistory, deleteHistoryEntry, loadHistory, loadLocalHistory } from '../outfitHistory';
import { deletePlan, loadLocalPlans, loadPlans, upsertPlan } from '../tripStorage';
import type { OutfitHistoryEntry, SavedTripFitPlan } from '../../types';

const mockApi = api as unknown as { get: jest.Mock; post: jest.Mock; delete: jest.Mock };

const HISTORY = 'ojo_outfit_history_anon';
const HISTORY_OUTBOX = 'ojo_history_outbox_v1_anon';
const PLANS = 'ojo_tripfit_plans_anon';

const offline = () => Promise.reject(new Error('Network Error'));
const ok = () => Promise.resolve({ data: {} });

/** Lets fire-and-forget uploads and their confirmations finish. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise(r => setTimeout(r, 0));
};

const postedIds = () => mockApi.post.mock.calls.map(([, body]) => (body as { id: string }).id);
const deletedUrls = () => mockApi.delete.mock.calls.map(([url]) => url as string);

beforeEach(async () => {
  await settle();
  for (const k of Object.keys(mockStore)) delete mockStore[k];
  mockApi.get.mockReset();
  mockApi.post.mockReset().mockImplementation(ok);
  mockApi.delete.mockReset().mockImplementation(ok);
});

// ─── Outfit history ──────────────────────────────────────────────────────────

const wear = { closetId: 'c1', closetName: 'Main', articleIds: ['tee'], articleSummary: 'Tee' };

const entry = (id: string, wornAt = new Date(Date.now() - 3600_000).toISOString()): OutfitHistoryEntry =>
  ({ id, wornAt, ...wear });

const serverHistory = (entries: OutfitHistoryEntry[], clearedAt: string | null = null) =>
  mockApi.get.mockResolvedValue({ data: { entries, clearedAt } });

describe('outfit history sync', () => {
  it('retries an outfit logged offline after every load until the upload lands', async () => {
    mockApi.post.mockImplementation(offline);
    const logged = await addHistoryEntry(wear);
    await settle();
    expect(postedIds()).toEqual([logged.id]);

    serverHistory([]);
    expect((await loadHistory()).map(e => e.id)).toEqual([logged.id]);
    await settle();
    await loadHistory();
    await settle();
    // No latch: each load tries again.
    expect(postedIds()).toEqual([logged.id, logged.id, logged.id]);

    mockApi.post.mockImplementation(ok);
    await loadHistory();
    await settle();
    expect(JSON.parse(mockStore[HISTORY_OUTBOX]).push).toEqual({});

    serverHistory([logged]);
    await loadHistory();
    await settle();
    expect(postedIds()).toHaveLength(4);
  });

  it('keeps an entry deleted on another device deleted', async () => {
    serverHistory([]);
    await loadHistory(); // the sign-in load, which runs the one-time catch-up
    const logged = await addHistoryEntry(wear);
    await settle();

    serverHistory([]);
    expect(await loadHistory()).toEqual([]);
    await settle();
    expect(postedIds()).toEqual([logged.id]);
    expect(await loadLocalHistory()).toEqual([]);
  });

  it('keeps a delete made offline and retries it until it lands', async () => {
    const e = entry('e1');
    serverHistory([e]);
    await loadHistory();

    mockApi.delete.mockImplementation(offline);
    await deleteHistoryEntry('e1');
    // The server still has it, but this device deleted it.
    expect(await loadHistory()).toEqual([]);
    await settle();
    expect(deletedUrls()).toEqual(['/api/history/e1', '/api/history/e1']);

    mockApi.delete.mockImplementation(ok);
    await loadHistory();
    await settle();
    serverHistory([]);
    await loadHistory();
    await settle();
    expect(deletedUrls()).toHaveLength(3);
  });

  it('uploads entries the old one-time migration stranded, once', async () => {
    const a = entry('a');
    const b = entry('b');
    mockStore[HISTORY] = JSON.stringify([a, b]);
    mockStore.ojo_history_migrated_v1_anon = '1';

    serverHistory([a]);
    expect((await loadHistory()).map(e => e.id).sort()).toEqual(['a', 'b']);
    await settle();
    expect(postedIds()).toEqual(['b']);

    serverHistory([a, b]);
    await loadHistory();
    await settle();
    expect(postedIds()).toEqual(['b']);
  });

  it('drops a queued entry worn before a clear on another device', async () => {
    mockApi.post.mockImplementation(offline);
    await addHistoryEntry(wear);
    await settle();

    serverHistory([], new Date(Date.now() + 60_000).toISOString());
    expect(await loadHistory()).toEqual([]);
    await settle();
    expect(postedIds()).toHaveLength(1);
  });

  it('keeps an outfit logged while a load was in flight, even if its upload lands first', async () => {
    let respond: (v: unknown) => void = () => {};
    mockApi.get.mockReturnValue(new Promise(r => { respond = r; }));

    const loading = loadHistory();
    const logged = await addHistoryEntry(wear);
    await settle(); // the upload is confirmed before the (stale) list arrives

    respond({ data: { entries: [], clearedAt: null } });
    expect((await loading).map(e => e.id)).toEqual([logged.id]);
    expect((await loadLocalHistory()).map(e => e.id)).toEqual([logged.id]);
  });

  it('sends an offline clear before entries logged after it', async () => {
    serverHistory([entry('old')]);
    await loadHistory();

    mockApi.delete.mockImplementation(offline);
    mockApi.post.mockImplementation(offline);
    await clearHistory();
    const logged = await addHistoryEntry(wear);
    await settle();

    // The server hasn't seen the clear: its old entry stays hidden.
    expect((await loadHistory()).map(e => e.id)).toEqual([logged.id]);

    const order: string[] = [];
    mockApi.delete.mockImplementation(async (url: string) => { order.push(`delete ${url}`); return {}; });
    mockApi.post.mockImplementation(async (_url: string, body: { id: string }) => { order.push(`post ${body.id}`); return {}; });
    await loadHistory();
    await settle();
    expect(order).toEqual(['delete /api/history?confirm=true', `post ${logged.id}`]);
  });
});

// ─── TripFit plans ───────────────────────────────────────────────────────────

const plan = (over: Partial<SavedTripFitPlan> = {}): SavedTripFitPlan => ({
  id:          'trip-1',
  destination: 'Lisbon',
  lat:         38.7,
  lon:         -9.1,
  startDate:   '2026-11-02',
  endDate:     '2026-11-06',
  occasion:    'everyday',
  closetId:    'closet-1',
  days:        [],
  checkedIds:  [],
  createdAt:   '2026-10-01T00:00:00.000Z',
  updatedAt:   '2026-10-01T00:00:00.000Z',
  ...over,
});

const serverPlans = (plans: SavedTripFitPlan[]) => mockApi.get.mockResolvedValue({ data: plans });

describe('TripFit plan sync', () => {
  it('uploads an edit made offline and keeps it over the older server copy', async () => {
    serverPlans([plan()]);
    await loadPlans();

    mockApi.post.mockImplementation(offline);
    const edited = await upsertPlan(plan({ checkedIds: ['tee', 'jeans'] }));
    await settle();

    const loaded = await loadPlans();
    expect(loaded[0].checkedIds).toEqual(['tee', 'jeans']);
    await settle();
    expect(mockApi.post.mock.lastCall?.[1]).toMatchObject({ id: 'trip-1', checkedIds: ['tee', 'jeans'] });

    mockApi.post.mockImplementation(ok);
    await loadPlans();
    await settle();
    // Confirmed: the next load takes the server's copy, with no upload.
    serverPlans([{ ...edited, updatedAt: new Date().toISOString() }]);
    const posts = mockApi.post.mock.calls.length;
    await loadPlans();
    await settle();
    expect(mockApi.post.mock.calls).toHaveLength(posts);
  });

  it('keeps a plan deleted on another device deleted', async () => {
    serverPlans([]);
    await loadPlans(); // the first load, which runs the one-time catch-up
    await upsertPlan(plan());
    await settle();

    serverPlans([]);
    expect(await loadPlans()).toEqual([]);
    expect(await loadLocalPlans()).toEqual([]);
  });

  it('keeps a delete made offline and retries it', async () => {
    serverPlans([plan()]);
    await loadPlans();

    mockApi.delete.mockImplementation(offline);
    await deletePlan('trip-1');
    await settle();
    expect(await loadPlans()).toEqual([]);
    await settle();
    expect(deletedUrls()).toEqual(['/api/tripfit/trip-1', '/api/tripfit/trip-1']);
  });

  it('does not let an older edit\'s upload confirm a newer one, even in the same millisecond', async () => {
    serverPlans([]);
    await loadPlans();
    jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2026-10-22T12:00:00.000Z');
    let land: (v: unknown) => void = () => {};
    mockApi.post.mockReturnValueOnce(new Promise(r => { land = r; }));
    await upsertPlan(plan({ checkedIds: ['tee'] }));
    mockApi.post.mockImplementation(offline);
    await upsertPlan(plan({ checkedIds: ['tee', 'jeans'] }));

    land({ data: {} }); // the first edit's upload lands after the second edit
    await settle();
    jest.restoreAllMocks();

    serverPlans([plan({ checkedIds: ['tee'], updatedAt: new Date().toISOString() })]);
    expect((await loadPlans())[0].checkedIds).toEqual(['tee', 'jeans']);
  });

  it('uploads stranded plans and offline edits from before the outbox, once', async () => {
    const stranded = plan({ id: 'trip-2', startDate: '2026-12-01', endDate: '2026-12-03', destination: 'Oslo' });
    const editedOffline = plan({ checkedIds: ['coat'], updatedAt: '2026-10-05T00:00:00.000Z' });
    mockStore[PLANS] = JSON.stringify([editedOffline, stranded]);

    serverPlans([plan()]);
    const loaded = await loadPlans();
    expect(loaded.map(p => p.id)).toEqual(['trip-1', 'trip-2']);
    expect(loaded[0].checkedIds).toEqual(['coat']);
    await settle();
    expect(postedIds().sort()).toEqual(['trip-1', 'trip-2']);
  });
});
