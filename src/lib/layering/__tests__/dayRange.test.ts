import { deriveDayRange } from '../dayRange';
import type { Forecast } from '../../../types';

const f = (val: number): Forecast => ({
  IconPhrase: 'Sunny',
  Temperature: { Value: val, Unit: 'F' },
  DateTime: new Date().toISOString(),
  IsDaylight: true,
});

describe('deriveDayRange', () => {
  it('returns zero-delta when no forecasts', () => {
    const { high, low, offset } = deriveDayRange([], 70, 75);
    expect(high).toBe(75);
    expect(low).toBe(75);
    expect(offset).toBe(5);
  });

  it('applies feels-like offset to forecast values', () => {
    const { high, low, offset } = deriveDayRange([f(60), f(70), f(50)], 65, 60);
    expect(offset).toBe(-5);
    expect(high).toBe(70 - 5);
    expect(low).toBe(50 - 5);
  });

  it('handles single-forecast input', () => {
    const { high, low } = deriveDayRange([f(72)], 70, 70);
    expect(high).toBe(low);
    expect(high).toBe(72);
  });
});
