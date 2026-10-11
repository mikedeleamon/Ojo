// Settings fields PUT /api/user/settings accepts, and validation for the ones
// that need more than a whitelist. Kept out of routes/user.ts so tests can
// import them without loading the route's R2 and auth dependencies.

export const SETTINGS_EDITABLE_FIELDS = [
  'clothingStyle',
  'clothingStyles',
  'location',
  'lat',
  'lon',
  'temperatureScale',
  'hiTempThreshold',
  'lowTempThreshold',
  'humidityPreference',
  'gender',
  'savedLocations',
  'tripModeEnabled',
  'tripModeRadiusMi',
] as const;

const MAX_CLOTHING_STYLES = 20;
const MAX_STYLE_LENGTH = 40;

/** Trimmed, de-duplicated style names, or null when the value isn't a string array. */
export const sanitizeClothingStyles = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return null;
  const styles = [...new Set(value.map((v: string) => v.trim()).filter(Boolean))];
  if (styles.length > MAX_CLOTHING_STYLES || styles.some((v) => v.length > MAX_STYLE_LENGTH)) {
    return null;
  }
  return styles;
};
