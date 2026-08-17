import { DETECTED_COLOR_TO_FORM } from '../detection';
import { DETECTABLE_COLOR_NAMES } from '../../../services/colorUtils';
import { COLORS } from '../../../lib/colors/palettes';

describe('DETECTED_COLOR_TO_FORM', () => {
  // An unmapped detected name falls through to the raw string, which matches no
  // picker chip — so the article silently saves a color the user can't re-select.
  it('maps every color the extractor can detect', () => {
    const unmapped = DETECTABLE_COLOR_NAMES.filter((n) => !DETECTED_COLOR_TO_FORM[n]);
    expect(unmapped).toEqual([]);
  });

  it('only maps to values that exist in the picker palette', () => {
    const palette = new Set(COLORS);
    const invalid = Object.entries(DETECTED_COLOR_TO_FORM)
      .filter(([, formValue]) => !palette.has(formValue))
      .map(([detected, formValue]) => `${detected} → ${formValue}`);
    expect(invalid).toEqual([]);
  });
});
