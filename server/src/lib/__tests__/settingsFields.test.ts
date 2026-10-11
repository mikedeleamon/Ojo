import User from '../../models/User';
import { SETTINGS_EDITABLE_FIELDS, sanitizeClothingStyles } from '../settingsFields';

describe('clothingStyles persistence', () => {
  it('is writable through PUT /settings', () => {
    expect(SETTINGS_EDITABLE_FIELDS).toContain('clothingStyles');
  });

  it('exists on the settings schema, so strict mode keeps it', () => {
    expect(User.schema.path('settings.clothingStyles')).toBeDefined();
  });
});

describe('sanitizeClothingStyles', () => {
  it('trims, drops empties and de-duplicates', () => {
    expect(sanitizeClothingStyles([' Casual ', 'Formal', '', 'Casual'])).toEqual(['Casual', 'Formal']);
  });

  it('keeps an empty list', () => {
    expect(sanitizeClothingStyles([])).toEqual([]);
  });

  it('rejects anything that is not a string array', () => {
    expect(sanitizeClothingStyles('Casual')).toBeNull();
    expect(sanitizeClothingStyles(['Casual', 3])).toBeNull();
    expect(sanitizeClothingStyles({ 0: 'Casual' })).toBeNull();
  });

  it('rejects oversized input', () => {
    expect(sanitizeClothingStyles(Array.from({ length: 21 }, (_, i) => `Style ${i}`))).toBeNull();
    expect(sanitizeClothingStyles(['x'.repeat(41)])).toBeNull();
  });
});
