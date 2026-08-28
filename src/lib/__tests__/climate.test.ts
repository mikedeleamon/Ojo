import { climateBandFor, climateBandLabel, CLIMATE_BANDS } from '../climate';

describe('climateBandFor', () => {
  it('bands real cities the way a wardrobe would expect', () => {
    const cases: [string, number, number, string][] = [
      ['Singapore',      1.35,  103.82, 'tropical'],
      ['Lagos',          6.52,    3.38, 'tropical'],
      ['Rio de Janeiro',-22.91,  -43.17, 'tropical'],
      ['Phoenix',       33.45, -112.07, 'arid'],
      ['Cairo',         30.04,   31.24, 'arid'],
      ['Dubai',         25.20,   55.27, 'arid'],
      ['Alice Springs',-23.70,  133.88, 'arid'],
      ['Los Angeles',   34.05, -118.24, 'arid'],
      ['Tokyo',         35.68,  139.65, 'temperate'],
      ['Atlanta',       33.75,  -84.39, 'temperate'],
      ['London',        51.51,   -0.13, 'temperate'],
      ['Seattle',       47.61, -122.33, 'temperate'],
      ['Auckland',     -36.85,  174.76, 'temperate'],
      ['Oslo',          59.91,   10.75, 'continental'],
      ['Moscow',        55.76,   37.62, 'continental'],
      ['Calgary',       51.05, -114.07, 'continental'],
      ['Tromsø',        69.65,   18.96, 'polar'],
      ['Utqiagvik',     71.29, -156.79, 'polar'],
    ];
    for (const [city, lat, lon, expected] of cases) {
      expect(`${city}:${climateBandFor(lat, lon)}`).toBe(`${city}:${expected}`);
    }
  });

  it('is pure and total — bad input falls back rather than throwing', () => {
    expect(climateBandFor(NaN, 0)).toBe('temperate');
    expect(climateBandFor(0, Infinity)).toBe('temperate');
    expect(climateBandFor(200, 400)).toBe('temperate');
  });

  it('is symmetric across the equator outside the override boxes', () => {
    expect(climateBandFor(40, -75)).toBe(climateBandFor(-40, -75));
  });

  it('labels every band', () => {
    for (const band of CLIMATE_BANDS) {
      expect(climateBandLabel(band).length).toBeGreaterThan(0);
    }
  });
});
