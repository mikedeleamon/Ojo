import { coarsenSettingsField } from '../coarseLocation';

describe('coarsenSettingsField', () => {
  it('rounds the current location', () => {
    expect(coarsenSettingsField('lat', 30.267153)).toBe(30.27);
    expect(coarsenSettingsField('lon', -97.743061)).toBe(-97.74);
  });

  it('rounds every saved city and keeps its other fields', () => {
    const saved = [
      { id: 'a', name: 'Austin', lat: 30.267153, lon: -97.743061 },
      { id: 'b', name: 'London', lat: 51.507351, lon: -0.127758 },
    ];
    expect(coarsenSettingsField('savedLocations', saved)).toEqual([
      { id: 'a', name: 'Austin', lat: 30.27, lon: -97.74 },
      { id: 'b', name: 'London', lat: 51.51, lon: -0.13 },
    ]);
  });

  it('does not add coordinates a saved entry never had', () => {
    const out = coarsenSettingsField('savedLocations', [{ id: 'x', name: 'Nowhere' }]) as object[];
    expect(out[0]).toEqual({ id: 'x', name: 'Nowhere' });
    expect(out[0]).not.toHaveProperty('lat');
  });

  it('passes through anything that is not a finite number', () => {
    expect(coarsenSettingsField('lat', null)).toBeNull();
    expect(coarsenSettingsField('lat', '30.2671')).toBe('30.2671');
    expect(coarsenSettingsField('lon', Number.NaN)).toBeNaN();
    expect(coarsenSettingsField('savedLocations', 'not an array')).toBe('not an array');
  });

  it('leaves non-location fields alone', () => {
    expect(coarsenSettingsField('hiTempThreshold', 85.123)).toBe(85.123);
    expect(coarsenSettingsField('location', 'Austin, TX')).toBe('Austin, TX');
  });
});
