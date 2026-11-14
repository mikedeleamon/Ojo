/**
 * devWeatherOverride — DEV TOOL. Forces the condition WeatherHUD's backdrop
 * draws, so every look (snow, sleet, fog, storm…) can be checked without
 * waiting for that weather somewhere real.
 *
 *   EXPO_PUBLIC_DEV_CONDITION="Snow" EXPO_PUBLIC_DEV_IS_DAY=false npx expo start --clear
 *
 * EXPO_PUBLIC_DEV_TEMP_F does the same for the temperature the weather glass
 * reacts to (devTempF below).
 *
 * Any condition text classifyCondition understands works. Both variables are
 * inlined at bundle time, hence --clear when changing them. Read only under
 * __DEV__, so a release build ignores them even if they're set.
 */

const FORCED_CONDITION = __DEV__ ? process.env.EXPO_PUBLIC_DEV_CONDITION || null : null;
const FORCED_IS_DAY = __DEV__ ? process.env.EXPO_PUBLIC_DEV_IS_DAY || null : null;

export function devCondition(actual: string): string {
    return FORCED_CONDITION ?? actual;
}

export function devIsDay(actual: boolean): boolean {
    return FORCED_IS_DAY === null ? actual : FORCED_IS_DAY !== 'false';
}

const FORCED_TEMP_F = __DEV__ ? Number(process.env.EXPO_PUBLIC_DEV_TEMP_F || NaN) : NaN;

/**
 * Air temperature (°F) the weather glass reacts to, for checking frost and heat
 * without waiting for them: EXPO_PUBLIC_DEV_TEMP_F=18. Only the glass reads it;
 * the temperatures on screen stay real.
 */
export function devTempF(actual: number): number {
    return Number.isFinite(FORCED_TEMP_F) ? FORCED_TEMP_F : actual;
}
