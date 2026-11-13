/**
 * "Wore this" kept for the day, so a background widget refresh can't replace
 * the outfit the user committed to with the top suggestion.
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

import { clearWornToday, readWornToday, saveWornToday } from '../wornToday';
import type { OutfitResult } from '../../outfit/types';

const KEY = 'ojo_widget_worn_today';
const outfit = { headline: 'Navy tee + jeans', slots: [{ role: 'top' }], score: 80 } as unknown as OutfitResult;

beforeEach(() => {
  for (const k of Object.keys(mockStore)) delete mockStore[k];
});

describe('wornToday', () => {
  it('returns what was logged today', async () => {
    await saveWornToday(outfit);
    expect(await readWornToday()).toEqual(outfit);
  });

  it('stops counting once the day it was logged has passed', async () => {
    mockStore[KEY] = JSON.stringify({ dateISO: '2020-01-01', outfit });
    expect(await readWornToday()).toBeNull();
  });

  it('is cleared by an undo and by sign-out', async () => {
    await saveWornToday(outfit);
    await saveWornToday(null);
    expect(await readWornToday()).toBeNull();

    await saveWornToday(outfit);
    await clearWornToday();
    expect(await readWornToday()).toBeNull();
  });

  it('ignores an outfit with nothing in it', async () => {
    await saveWornToday({ ...outfit, slots: [] } as unknown as OutfitResult);
    expect(await readWornToday()).toBeNull();
  });
});
