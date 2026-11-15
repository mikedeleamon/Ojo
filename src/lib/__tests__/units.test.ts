import { fToC, cToF, formatTemp } from '../units';

describe('fToC / cToF', () => {
  it('is symmetric near typical air temps', () => {
    expect(fToC(32)).toBe(0);
    expect(fToC(212)).toBe(100);
    expect(cToF(0)).toBe(32);
    expect(cToF(100)).toBe(212);
  });

  it('rounds to the nearest integer', () => {
    expect(fToC(70)).toBe(21);
    expect(cToF(21)).toBe(70);
  });
});

describe('formatTemp', () => {
  it('defaults to imperial', () => {
    expect(formatTemp(72)).toBe('72°F');
  });
  it('renders metric on request', () => {
    expect(formatTemp(72, 'metric')).toBe('22°C');
  });
});

describe('temperature scale helpers', () => {
  const { tempScaleOf, degreesIn, formatTempRange } = require('../units');

  it("reads the user's scale from settings", () => {
    expect(tempScaleOf({ temperatureScale: 'Metric' })).toBe('metric');
    expect(tempScaleOf({ temperatureScale: 'Imperial' })).toBe('imperial');
    expect(tempScaleOf({})).toBe('imperial');
  });

  it('shows Fahrenheit readings in the chosen scale', () => {
    expect(degreesIn(64.4, 'imperial')).toBe(64);
    expect(degreesIn(64.4, 'metric')).toBe(18);
    expect(degreesIn(32, 'metric')).toBe(0);
  });

  it('formats a low–high range with its unit', () => {
    expect(formatTempRange(41.2, 55.6, 'imperial')).toBe('41°–56°F');
    expect(formatTempRange(41.2, 55.6, 'metric')).toBe('5°–13°C');
  });
});
