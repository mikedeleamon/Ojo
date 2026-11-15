import { COLORS } from '../colors/palettes';
import { SWATCH, swatchHex } from '../../views/InsightsPage/swatches';

describe('Insights color swatches', () => {
  it('gives every clothing color the app offers a real color, never the grey fallback', () => {
    for (const name of COLORS) {
      if (name === 'Multi' || name === 'Grey') continue;
      expect(swatchHex(name)).not.toBe('#9ca3af');
    }
  });

  it('keeps Insights’ own shades where it has them', () => {
    expect(SWATCH.White).toBe('#f0f0f0');
    expect(SWATCH['Dusty Rose']).toBeDefined();
    expect(SWATCH['Electric Blue']).toBeDefined();
  });
});
