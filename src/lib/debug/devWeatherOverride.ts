/**
 * devWeatherOverride — DEV TOOL. Forces the condition WeatherHUD's backdrop
 * draws, so every look (snow, sleet, fog, storm…) can be checked without
 * waiting for that weather somewhere real.
 *
 *   EXPO_PUBLIC_DEV_CONDITION="Snow" EXPO_PUBLIC_DEV_IS_DAY=false npx expo start --clear
 *
 * EXPO_PUBLIC_DEV_TEMP_F does the same for the temperature the weather glass
 * reacts to (devTempF below), and EXPO_PUBLIC_DEV_SUN_DEG for where the sun is
 * (devSun below).
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

/**
 * DEV TOOL: a whole consistent weather scene, for recording marketing footage.
 * EXPO_PUBLIC_DEV_SCENE=rain | freezing | hot rewrites the fetched current,
 * hourly and daily weather so every part of Home (icons, temperatures,
 * headline, outfit, backdrop, glass) agrees on one kind of day, rather than
 * only the backdrop changing. Read only under __DEV__.
 */
const SCENE = __DEV__ ? process.env.EXPO_PUBLIC_DEV_SCENE || null : null;

type ScenePreset = {
    text: string; precip: string | null; inchPerHr: number;
    temp: number; feels: number; hourly: number[]; hourlyText: [string, string];
    min: number; max: number; pop: number;
};

const SCENES: Record<string, ScenePreset> = {
    rain: { text: 'Rain', precip: 'Rain', inchPerHr: 0.12, temp: 46, feels: 42,
        hourly: [46, 47, 47, 46, 45, 44, 44, 43], hourlyText: ['Rain', 'Drizzle'], min: 41, max: 48, pop: 90 },
    freezing: { text: 'Snow', precip: 'Snow', inchPerHr: 0.05, temp: 18, feels: 9,
        hourly: [18, 19, 20, 20, 19, 17, 15, 14], hourlyText: ['Snow', 'Flurries'], min: 12, max: 21, pop: 70 },
    hot: { text: 'Clear', precip: null, inchPerHr: 0, temp: 96, feels: 101,
        hourly: [96, 97, 98, 98, 97, 95, 92, 89], hourlyText: ['Clear', 'MostlyClear'], min: 79, max: 98, pop: 0 },
};

const f2c = (f: number) => Math.round(((f - 32) * 5) / 9);

export function devScene<C extends {
    WeatherText: string; HasPrecipitation: boolean; PrecipitationType?: string | null;
    Precip1hr?: { Imperial?: { Value: number }; Metric?: { Value: number } };
    Temperature: { Imperial: { Value: number; Unit: string }; Metric: { Value: number; Unit: string } };
    RealFeelTemperature: { Imperial: { Value: number; Unit: string }; Metric: { Value: number; Unit: string } };
}, H extends { IconPhrase: string; Temperature: { Value: number; Unit: string } },
   D extends { minTempF: number; maxTempF: number; dayPhrase: string; hasPrecipitation: boolean; precipProbability?: number }>(
    current: C, hourly: H[], daily: D[],
): { current: C; hourly: H[]; daily: D[] } {
    const p = SCENE ? SCENES[SCENE] : undefined;
    if (!p) return { current, hourly, daily };
    const wet = p.precip !== null;
    return {
        current: {
            ...current,
            WeatherText: p.text, HasPrecipitation: wet, PrecipitationType: p.precip,
            Precip1hr: { Imperial: { Value: p.inchPerHr }, Metric: { Value: Math.round(p.inchPerHr * 25.4) } },
            Temperature: { Imperial: { Value: p.temp, Unit: 'F' }, Metric: { Value: f2c(p.temp), Unit: 'C' } },
            RealFeelTemperature: { Imperial: { Value: p.feels, Unit: 'F' }, Metric: { Value: f2c(p.feels), Unit: 'C' } },
        },
        hourly: hourly.map((h, i) => ({
            ...h,
            IconPhrase: i < 6 ? p.hourlyText[0] : p.hourlyText[1],
            Temperature: { ...h.Temperature, Value: h.Temperature.Unit === 'C' ? f2c(p.hourly[i % 8]) : p.hourly[i % 8] },
        })),
        daily: daily.map((d, i) => (i === 0
            ? { ...d, minTempF: p.min, maxTempF: p.max, dayPhrase: p.text, hasPrecipitation: wet, precipProbability: p.pop }
            : d)),
    };
}

const FORCED_SUN_DEG = __DEV__ ? Number(process.env.EXPO_PUBLIC_DEV_SUN_DEG || NaN) : NaN;
const FORCED_SUN_RISING = __DEV__ ? process.env.EXPO_PUBLIC_DEV_SUN_RISING === 'true' : false;

/**
 * DEV TOOL: where the sun is, for checking the skies that follow it (clear and
 * partly cloudy) at any hour: EXPO_PUBLIC_DEV_SUN_DEG=45 is midday, 2 golden
 * hour, -4 sunset, -30 night. EXPO_PUBLIC_DEV_SUN_RISING=true makes it the
 * morning side. Pair it with EXPO_PUBLIC_DEV_IS_DAY, which the cards and icons
 * read. Only the sky reads this.
 */
export function devSun<S extends { elevationDeg: number; isRising: boolean }>(actual: S): S {
    return Number.isFinite(FORCED_SUN_DEG)
        ? { ...actual, elevationDeg: FORCED_SUN_DEG, isRising: FORCED_SUN_RISING }
        : actual;
}
