import { pairHarmony, COLOR_NEUTRALS, NEUTRAL_BASE_COLORS } from '../colorHarmony';

describe('pairHarmony', () => {
  it('returns 0.9 when one color is neutral', () => {
    expect(pairHarmony('Black', 'Red')).toBeCloseTo(0.9);
    expect(pairHarmony('Beige', 'Blue')).toBeCloseTo(0.9);
  });

  it('returns max harmony (1.0) for complementary colors', () => {
    // Red (0) ↔ Teal/Cyan (7): distance 5. Use opposite of red on 12-pos wheel: pos 6.
    // Position 0 Red ↔ Position 6 Green = complementary (d=6) → 1.0
    expect(pairHarmony('Red', 'Green')).toBeCloseTo(1.0);
  });

  it('returns lowest harmony for quarter-wheel pairs (d=3)', () => {
    expect(pairHarmony('Orange', 'Sage')).toBeCloseTo(0.35);
  });

  it('treats unknown colors as 0.7', () => {
    expect(pairHarmony('Made-Up-Color', 'Another-Fake')).toBeCloseTo(0.7);
  });

  it('is symmetric', () => {
    expect(pairHarmony('Blue', 'Orange')).toBe(pairHarmony('Orange', 'Blue'));
  });
});

describe('color sets', () => {
  it('includes metallics in COLOR_NEUTRALS', () => {
    expect(COLOR_NEUTRALS.has('Silver')).toBe(true);
    expect(COLOR_NEUTRALS.has('Gold')).toBe(true);
    expect(COLOR_NEUTRALS.has('Champagne')).toBe(true);
  });

  it('keeps simplicity base set tight', () => {
    expect(NEUTRAL_BASE_COLORS.has('Navy')).toBe(true);
    expect(NEUTRAL_BASE_COLORS.has('Silver')).toBe(false);
  });
});
