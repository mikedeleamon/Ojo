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

  // ── Regression: muted fabric must not collapse to a neutral ──────────────
  //
  // Real garments photographed in real light sit at chroma ~10–25, nowhere near
  // the saturation of a CSS color keyword. Under plain Lab-Euclidean distance
  // every one of these landed on whichever gray shared its lightness, because
  // neutral anchors cover the whole L* axis at chroma 0 while the chromatic
  // anchors were all fully saturated. That is the "everything in my closet is
  // grey" bug — these cases must keep resolving to a hue.
  const NEUTRALS = new Set(['white', 'off-white', 'light gray', 'gray', 'charcoal', 'dark gray', 'black']);

  it.each([
    ['sky blue shirt shot indoors', 150, 180, 200],
    ['washed-out dusty blue',       110, 130, 155],
    ['light-wash denim',            125, 145, 170],
    ['muted olive tee',             110, 115, 90 ],
    ['forest green in shadow',      45,  70,  55 ],
    ['lavender sweater',            175, 160, 200],
    ['dusty rose top',              190, 150, 150],
    ['dark brown boot',             75,  55,  42 ],
  ] as const)('names %s by its hue, not as a neutral', (_label, r, g, b) => {
    expect(NEUTRALS.has(rgbToColorName(r, g, b).name)).toBe(false);
  });

  // The flip side: genuinely neutral garments must still read as neutral, so
  // the chroma-aware distance isn't just inventing hues everywhere.
  it.each([
    ['gray',       140, 140, 142],
    ['light gray', 190, 190, 190],
    ['black',      38,  34,  30 ],
    ['white',      245, 245, 245],
  ] as const)('still names a true %s correctly', (expected, r, g, b) => {
    expect(rgbToColorName(r, g, b).name).toBe(expected);
  });

  it('picks a plausible hue family for common garment colors', () => {
    expect(rgbToColorName(150, 180, 200).name).toBe('sky blue');
    expect(rgbToColorName(110, 115, 90).name).toBe('olive');
    expect(rgbToColorName(50, 90, 200).name).toBe('blue');
    expect(rgbToColorName(20, 140, 90).name).toBe('green');
    expect(rgbToColorName(185, 150, 110).name).toBe('camel');
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
