import { currentSeason, SEASONAL_COLORS, seasonalBonus } from '../seasons';

describe('currentSeason', () => {
  it('returns a valid season for the current date', () => {
    expect(['spring', 'summer', 'autumn', 'winter']).toContain(currentSeason());
  });
});

describe('SEASONAL_COLORS', () => {
  it('has non-empty palettes for every season', () => {
    for (const s of ['spring', 'summer', 'autumn', 'winter'] as const) {
      expect(SEASONAL_COLORS[s].size).toBeGreaterThan(0);
    }
  });
});

describe('seasonalBonus', () => {
  it('returns 0 for empty input', () => {
    expect(seasonalBonus([])).toBe(0);
  });
  it('caps at 0.08', () => {
    // Pick from any season palette to guarantee matches
    const all = [...SEASONAL_COLORS[currentSeason()]];
    expect(seasonalBonus(all)).toBeLessThanOrEqual(0.08);
  });
  it('is monotonic in match count', () => {
    const season = currentSeason();
    const colors = [...SEASONAL_COLORS[season]];
    if (colors.length >= 2) {
      expect(seasonalBonus([colors[0]])).toBeLessThanOrEqual(
        seasonalBonus([colors[0], colors[1]]),
      );
    }
  });
});
