import { rgbToColorName, rgbToLab, nearestColorNameFromLab } from '../colorUtils';

describe('rgbToLab', () => {
  it('maps white to L*≈100 with near-zero a*/b*', () => {
    const { l, a, b } = rgbToLab(255, 255, 255);
    expect(l).toBeCloseTo(100, 0);
    expect(a).toBeCloseTo(0, 0);
    expect(b).toBeCloseTo(0, 0);
  });

  it('maps black to L*≈0', () => {
    const { l } = rgbToLab(0, 0, 0);
    expect(l).toBeCloseTo(0, 0);
  });
});

describe('rgbToColorName', () => {
  // Self-consistency: feeding a table color's exact RGB back in must return
  // that same name — an exact match has Lab distance 0 to itself, which is
  // the unique minimum unless two table entries collide on the same RGB.
  it.each([
    ['white', 255, 255, 255],
    ['black', 28, 28, 28],
    ['navy', 31, 48, 94],
    ['denim blue', 21, 96, 189],
    ['forest green', 34, 139, 34],
    ['red', 204, 0, 0],
    ['mustard', 255, 219, 88],
    ['purple', 106, 13, 173],
  ] as const)('recognizes %s as its own table entry', (name, r, g, b) => {
    expect(rgbToColorName(r, g, b).name).toBe(name);
  });

  it('does not confuse a lightened navy with black', () => {
    // Under RGB-Euclidean distance this kind of mid-tone can snap to the
    // wrong neighbor; Lab distance should keep it reading as navy/blue.
    const { name } = rgbToColorName(45, 62, 110);
    expect(name).not.toBe('black');
  });
});

describe('nearestColorNameFromLab', () => {
  it('agrees with rgbToColorName for the same underlying color', () => {
    const [r, g, b] = [200, 30, 30];
    const lab = rgbToLab(r, g, b);
    expect(nearestColorNameFromLab(lab.l, lab.a, lab.b).name).toBe(
      rgbToColorName(r, g, b).name,
    );
  });
});
