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
