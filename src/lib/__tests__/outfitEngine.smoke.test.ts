import { getWeatherBucket } from '../outfitEngine';

describe('outfitEngine — smoke', () => {
  const HI = 75;
  const LO = 55;

  it('buckets hot at or above the high threshold', () => {
    expect(getWeatherBucket(80, HI, LO)).toBe('hot');
    expect(getWeatherBucket(HI, HI, LO)).toBe('hot');
  });

  it('buckets warm between low and high thresholds', () => {
    expect(getWeatherBucket(70, HI, LO)).toBe('warm');
    expect(getWeatherBucket(LO, HI, LO)).toBe('warm');
  });

  it('buckets cool within 15F below the low threshold', () => {
    expect(getWeatherBucket(LO - 1, HI, LO)).toBe('cool');
    expect(getWeatherBucket(LO - 15, HI, LO)).toBe('cool');
  });

  it('buckets cold above freezing but below the cool window', () => {
    expect(getWeatherBucket(35, HI, LO)).toBe('cold');
    expect(getWeatherBucket(32, HI, LO)).toBe('cold');
  });

  it('buckets freezing below 32F', () => {
    expect(getWeatherBucket(31, HI, LO)).toBe('freezing');
    expect(getWeatherBucket(0, HI, LO)).toBe('freezing');
  });
});
