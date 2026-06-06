import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ScrollView,
    RefreshControl,
    Pressable,
    Linking,
    Animated as RNAnimated,
    Easing as RNEasing,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    withTiming,
    Easing as REasing,
} from 'react-native-reanimated';
import { useSpinAnimation } from '../../hooks/useSpinAnimation';
import { useTabBarPadding } from '../../hooks/useTabBarPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Path } from 'react-native-svg';
import { View, Text, GlassCard, GlassGroup } from '../primitives';
import GearIcon from '../icons/GearIcon';
import api from '../../api/client';
import weatherConstants from '../../constants/weatherConstants';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import ClearNightIconMoon from '../WeatherIcons/ClearNightIconMoon';
import StormIconLightning from '../WeatherIcons/StormIconLightning';
import SunnyIcon from '../WeatherIcons/SunnyIcon';
import Loading from '../Loading/Loading';
import WeatherDetails from '../WeatherDetails/WeatherDetails';
import MinimizedWeatherDisplay from '../MinimizedWeatherDisplay/MinimizedWeatherDisplay';
import SunEventTile from '../SunEventTile/SunEventTile';
import { useWeatherTheme } from '../../context/WeatherContext';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import {
    CurrentWeather,
    DailyForecast,
    Forecast,
    LocationCoords,
    Settings,
} from '../../types';
import { geocodeCity } from '../../lib/geocoding';
import { spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { flattenHsl, hslToHex, lerpHslFlat } from './colorMath';

// LinearGradient driven by a UI-thread worklet via useAnimatedProps. The
// gradient's colors prop is updated directly on the native view each frame,
// bypassing the JS thread (and React reconciliation) entirely.
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
import { gradientFor, footerBgFor, formatLastUpdated } from './weatherPalette';
import { fToC } from '../../lib/units';
import { humanizeCondition } from '../../lib/weather/humanizeCondition';
import { makeStyles } from './WeatherHUD.styles';

// ─── Sun-event helpers ────────────────────────────────────────────────────────
// WeatherKit's daily forecast embeds `sunrise` / `sunset` ISO timestamps per
// day. We flatten them into a chronological list so they can be merged with
// the hourly strip.

type SunEventKind = 'sunrise' | 'sunset';
interface SunEvent {
    kind: SunEventKind;
    time: string;
}

const extractSunEvents = (days: DailyForecast[]): SunEvent[] => {
    const out: SunEvent[] = [];
    for (const d of days) {
        if (d.sunrise) out.push({ kind: 'sunrise', time: d.sunrise });
        if (d.sunset) out.push({ kind: 'sunset', time: d.sunset });
    }
    return out;
};

// Linear interpolation of forecast temperature at an arbitrary ISO timestamp.
// Forecasts are returned in Fahrenheit; the caller converts to metric if needed.
const tempAtTime = (target: number, forecasts: Forecast[]): number | null => {
    if (forecasts.length === 0) return null;
    const sorted = [...forecasts].sort(
        (a, b) =>
            new Date(a.DateTime).getTime() - new Date(b.DateTime).getTime(),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
        const t0 = new Date(sorted[i].DateTime).getTime();
        const t1 = new Date(sorted[i + 1].DateTime).getTime();
        if (target >= t0 && target <= t1) {
            const r = (target - t0) / (t1 - t0);
            const v0 = sorted[i].Temperature.Value;
            const v1 = sorted[i + 1].Temperature.Value;
            return v0 + (v1 - v0) * r;
        }
    }
    // Clamp to nearest endpoint if outside the forecast window
    const first = sorted[0],
        last = sorted[sorted.length - 1];
    if (target < new Date(first.DateTime).getTime())
        return first.Temperature.Value;
    return last.Temperature.Value;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    location: string;
    settings: Settings;
    refreshKey?: number;
    onRefresh?: () => void;
    /**
     * Fired once the first load settles (weather resolved OR errored). Lets a
     * parent own a single loading gate instead of stacking a second spinner.
     */
    onReady?: () => void;
    /**
     * When false, the inline spinner overlay is not rendered — the parent is
     * showing its own loading screen. Defaults to true (standalone use).
     */
    showInlineLoader?: boolean;
}

const WeatherHUD = ({
    location,
    settings,
    refreshKey,
    onRefresh,
    onReady,
    showInlineLoader = true,
}: Props) => {
    const { colors } = useTheme();
    const st = useMemo(() => makeStyles(colors), [colors]);
    const { setFooterBg } = useWeatherTheme();
    const { top: topInset } = useSafeAreaInsets();
    const tabPad = useTabBarPadding();
    const nav = useAppNavigation();
    const [place, setPlace] = useState<LocationCoords | null>(null);
    const [weather, setWeather] = useState<CurrentWeather | null>(null);
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
    const [sunEvents, setSunEvents] = useState<SunEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [, setTick] = useState(0);

    // ── Pull-to-refresh buffering ───────────────────────────────────────────────
    // While a pull-to-refresh is in flight, incoming data is held in pendingRef
    // instead of being applied immediately. In finally() we flush pending + clear
    // the spinner atomically so new content and the dismissal happen in one render.
    const pendingRef = useRef<{
        weather: CurrentWeather;
        forecasts: Forecast[];
        sunEvents: SunEvent[];
    } | null>(null);
    const isRefreshRef = useRef(false);

    const flushPending = () => {
        if (pendingRef.current) {
            const {
                weather: w,
                forecasts: f,
                sunEvents: s,
            } = pendingRef.current;
            setWeather(w);
            setForecasts(f);
            setSunEvents(s);
            setFooterBg(footerBgFor(w.WeatherText, w.IsDayTime));
            setLastUpdated(new Date());
            pendingRef.current = null;
        }
    };

    useEffect(() => {
        if (!lastUpdated) return;
        const id = setInterval(() => setTick((n) => n + 1), 60_000);
        return () => clearInterval(id);
    }, [lastUpdated]);

    // ── Resolve location → coordinates (expo-location geocoder) ────────────────
    useEffect(() => {
        if (!location) {
            setError(
                'Location unavailable. Set a default city in Settings → Preferences.',
            );
            setLoading(false);
            setRefreshing(false);
            return;
        }
        setLoading(true);
        setError(null);
        let cancelled = false;
        geocodeCity(location).then((coords) => {
            if (cancelled) return;
            if (coords) {
                setPlace(coords);
            } else {
                setError('Location not found. Check your city name.');
                setLoading(false);
                setRefreshing(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [location, refreshKey]);

    // ── Fetch weather (WeatherKit via server proxy) ────────────────────────────
    useEffect(() => {
        if (!place) return;
        const params = { params: { lat: place.lat, lon: place.lon } };
        Promise.all([
            api.get<CurrentWeather>(weatherConstants.GET_CURRENT, params),
            api.get<Forecast[]>(weatherConstants.GET_HOURLY, params),
            api.get<DailyForecast[]>(weatherConstants.GET_DAILY, params),
        ])
            .then(([wRes, fRes, dRes]) => {
                const w = wRes.data;
                if (!w) throw new Error('Empty response');

                const events = extractSunEvents(dRes.data ?? []);

                if (isRefreshRef.current) {
                    // Pull-to-refresh in flight — buffer until finally() flushes atomically
                    pendingRef.current = {
                        weather: w,
                        forecasts: fRes.data ?? [],
                        sunEvents: events,
                    };
                } else {
                    setWeather(w);
                    setForecasts(fRes.data ?? []);
                    setSunEvents(events);
                    setFooterBg(footerBgFor(w.WeatherText, w.IsDayTime));
                    setLastUpdated(new Date());
                }
            })
            .catch((err) => {
                const status = err?.response?.status;
                setError(
                    status === 429
                        ? 'Weather API rate limit reached. Wait a few minutes and try again.'
                        : 'Could not load weather. Please try again later.',
                );
            })
            .finally(() => {
                flushPending();
                isRefreshRef.current = false;
                setLoading(false);
                setRefreshing(false);
            });
    }, [place]);

    // ── Animated gradient color interpolation ───────────────────────────────────
    // The "from" and "to" gradients live in shared values; a single progress
    // shared value drives the transition with withTiming on the UI thread. The
    // useAnimatedProps worklet recomputes interpolated colors per frame natively,
    // so the gradient stays smooth even while the JS thread is busy (image
    // decoding, fetch parsing, scroll handlers).
    const DEFAULT_GRADIENT: readonly string[] = useMemo(
        () => [colors.bgDefault, colors.bgDefault, colors.bgDefault],
        [colors.bgDefault],
    );

    // Hex parsing happens once when from/to change (JS thread). The worklet
    // only does numeric HSL interpolation + one hslToHex per stop per frame,
    // avoiding ~6 `parseInt` calls per stop per frame that previously ran on
    // the UI thread and were the dominant source of gradient jank.
    const defaultHsl = useMemo(
        () => flattenHsl(DEFAULT_GRADIENT),
        [DEFAULT_GRADIENT],
    );
    const fromHsl = useSharedValue<number[]>(defaultHsl);
    const toHsl = useSharedValue<number[]>(defaultHsl);
    const progress = useSharedValue(1);

    const loadingOpacity = useRef(new RNAnimated.Value(1)).current;

    // Compute target gradient from weather data. Memoised so the dependency
    // array gets a stable reference (was `.join(',')` on every render).
    const targetGradient = useMemo(
        () =>
            weather
                ? gradientFor(weather.WeatherText, weather.IsDayTime)
                : DEFAULT_GRADIENT,
        [weather?.WeatherText, weather?.IsDayTime, DEFAULT_GRADIENT],
    );

    const prevTargetRef = useRef<readonly string[]>(DEFAULT_GRADIENT);

    const animatedGradientProps = useAnimatedProps(() => {
        'worklet';
        const from = fromHsl.value;
        const to = toHsl.value;
        const t = progress.value;
        const stagger = 0.15;
        const stops = to.length / 3;
        const result: string[] = new Array(stops);
        for (let i = 0; i < stops; i++) {
            const offset = (i / Math.max(1, stops - 1)) * stagger;
            let stopT = (t - offset) / (1 - stagger);
            if (stopT < 0) stopT = 0;
            else if (stopT > 1) stopT = 1;
            const e =
                stopT < 0.5
                    ? 2 * stopT * stopT
                    : 1 - Math.pow(-2 * stopT + 2, 2) / 2;
            const b = i * 3;
            const h1 = from[b],
                s1 = from[b + 1],
                l1 = from[b + 2];
            const h2 = to[b],
                s2 = to[b + 1],
                l2 = to[b + 2];
            let dh = h2 - h1;
            if (dh > 180) dh -= 360;
            else if (dh < -180) dh += 360;
            const h = s1 < 0.05 ? h2 : h1 + dh * e;
            const s = s1 + (s2 - s1) * e;
            const l = l1 + (l2 - l1) * e;
            result[i] = hslToHex(h, s, l);
        }
        return { colors: result as unknown as [string, string, ...string[]] };
    });

    useEffect(() => {
        if (targetGradient === prevTargetRef.current) return;

        // Detect "first paint" (solid dark → vibrant weather) — use a longer
        // duration so the user really sees the colors shift through hue space.
        const isFirstPaint = prevTargetRef.current === DEFAULT_GRADIENT;
        prevTargetRef.current = targetGradient;

        // Snapshot the in-flight interpolation in HSL space so an interruption
        // mid-transition reads as a continuous shift, not a jump.
        const snapshot = lerpHslFlat(
            fromHsl.value,
            toHsl.value,
            progress.value,
        );
        fromHsl.value = snapshot;
        toHsl.value = flattenHsl(targetGradient);
        progress.value = 0;
        progress.value = withTiming(1, {
            duration: isFirstPaint ? 2500 : 2000,
            easing: REasing.inOut(REasing.cubic),
        });
    }, [targetGradient]);

    // Spinner fades out once weather data arrives; the content layer renders at
    // full opacity from the start so GlassView can sample the background
    // immediately — mounting inside opacity:0 prevents native blur initialisation.
    useEffect(() => {
        if (!loading && weather) {
            RNAnimated.timing(loadingOpacity, {
                toValue: 0,
                duration: 400,
                easing: RNEasing.out(RNEasing.cubic),
                useNativeDriver: true,
            }).start();
        } else if (loading) {
            loadingOpacity.setValue(1);
        }
    }, [loading, weather]);

    // Tell the parent the first load has settled (success or error), so it can
    // drop its single loading gate. Fires once.
    const readyFiredRef = useRef(false);
    useEffect(() => {
        if (!loading && !readyFiredRef.current) {
            readyFiredRef.current = true;
            onReady?.();
        }
    }, [loading, onReady]);

    // Spinner rotation for the inline loading indicator
    const spinRotate = useSpinAnimation(2_000);

    const isMetric = settings.temperatureScale === 'Metric';
    const tempVal = weather
        ? isMetric
            ? weather.Temperature.Metric.Value
            : weather.Temperature.Imperial.Value
        : 0;
    const feelsVal = weather
        ? isMetric
            ? weather.RealFeelTemperature.Metric.Value
            : weather.RealFeelTemperature.Imperial.Value
        : 0;

    // #1 — High / low from hourly forecast (forecast API always returns °F)
    const { hiTemp, loTemp } = useMemo(() => {
        if (forecasts.length === 0) return { hiTemp: null, loTemp: null };
        const temps = forecasts.map((f) =>
            isMetric ? fToC(f.Temperature.Value) : f.Temperature.Value,
        );
        return {
            hiTemp: Math.round(Math.max(...temps)),
            loTemp: Math.round(Math.min(...temps)),
        };
    }, [forecasts, isMetric]);

    // Merge hourly forecasts + sunrise/sunset events into a single chronological
    // list for the strip. Sun events outside the forecast window are dropped so
    // they don't add tiles for times not in view.
    type StripItem =
        | { kind: 'forecast'; time: string; data: Forecast }
        | { kind: 'sun'; time: string; sun: SunEvent; temp: number };
    const stripItems = useMemo<StripItem[]>(() => {
        if (forecasts.length === 0) return [];
        const sorted = [...forecasts].sort(
            (a, b) =>
                new Date(a.DateTime).getTime() - new Date(b.DateTime).getTime(),
        );
        const windowStart = new Date(sorted[0].DateTime).getTime();
        const windowEnd = new Date(
            sorted[sorted.length - 1].DateTime,
        ).getTime();
        const items: StripItem[] = sorted.map((f) => ({
            kind: 'forecast',
            time: f.DateTime,
            data: f,
        }));
        for (const ev of sunEvents) {
            const t = new Date(ev.time).getTime();
            if (Number.isNaN(t) || t < windowStart || t > windowEnd) continue;
            const tempF = tempAtTime(t, forecasts);
            if (tempF === null) continue;
            const temp = Math.round(isMetric ? fToC(tempF) : tempF);
            items.push({ kind: 'sun', time: ev.time, sun: ev, temp });
        }
        return items.sort(
            (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );
    }, [forecasts, sunEvents, isMetric]);

    // True for "Clear" / "Mostly Clear" at night — drives the full-screen star backdrop.
    const isClearNightBg = !!(
        weather &&
        !weather.IsDayTime &&
        weather.WeatherText.toLowerCase().includes('clear')
    );

    // True for thunderstorm conditions — drives the full-screen rain + sheet-flash backdrop.
    const isStormBg = !!(
        weather &&
        (weather.WeatherText.toLowerCase().includes('thunder') ||
            weather.WeatherText.toLowerCase().includes('t-storm'))
    );

    // ── Error state (#9: retry + check settings) ──────────────────────────────
    if (error && !weather)
        return (
            <View style={st.center}>
                <Text style={st.errorText}>
                    {error ?? 'Something went wrong.'}
                </Text>
                <Pressable
                    style={st.retryBtn}
                    onPress={() => onRefresh?.()}
                >
                    <Text style={st.retryBtnText}>Try again</Text>
                </Pressable>
                <Pressable onPress={() => nav.push('/account')}>
                    <Text style={st.settingsLink}>Check settings</Text>
                </Pressable>
            </View>
        );

    return (
        <AnimatedLinearGradient
            colors={
                DEFAULT_GRADIENT as unknown as [string, string, ...string[]]
            }
            animatedProps={animatedGradientProps}
            style={st.root}
        >
            {/* Full-screen star field — absolute layer behind all content */}
            {isClearNightBg && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                    }}
                    pointerEvents='none'
                >
                    <ClearNightIconMoon
                        fullWidth
                        fullHeight
                        showMoon={false}
                    />
                </View>
            )}

            {/* Full-screen storm backdrop — falling rain + occasional sheet flash */}
            {isStormBg && (
                <View
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                    }}
                    pointerEvents='none'
                >
                    <StormIconLightning
                        fullWidth
                        fullHeight
                        showCloud={false}
                        showBolts={false}
                        showRain
                        showFlash
                    />
                </View>
            )}

            {/* Transparent loading spinner — sits over the animating gradient.
                Suppressed when a parent owns the loading gate (showInlineLoader). */}
            {showInlineLoader && (
                <RNAnimated.View
                    style={[st.loadingOverlay, { opacity: loadingOpacity }]}
                    pointerEvents={loading ? 'auto' : 'none'}
                >
                    <RNAnimated.View
                        style={[
                            st.loadingIcon,
                            { transform: [{ rotate: spinRotate }] },
                        ]}
                    >
                        <SunnyIcon size={st.loadingIcon.width} />
                    </RNAnimated.View>
                </RNAnimated.View>
            )}

            {/* Content renders at full opacity so GlassView can initialise its
                native material correctly. The loading overlay sits on top and
                fades out, revealing the content beneath. */}
            {weather && (
                <View
                    style={st.contentLayer}
                    pointerEvents={loading ? 'none' : 'auto'}
                >
                    <ScrollView
                        contentContainerStyle={[
                            st.scroll,
                            { paddingBottom: tabPad },
                        ]}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    isRefreshRef.current = true;
                                    setRefreshing(true);
                                    onRefresh?.();
                                }}
                                tintColor={colors.textPrimary as string}
                            />
                        }
                    >
                        {/* Header */}
                        <View
                            style={[
                                st.header,
                                { paddingTop: spacing.lg + topInset },
                            ]}
                        >
                            <GlassCard
                                glassStyle='clear'
                                style={[st.gearBtn, { top: topInset + 8 }]}
                            >
                                <Pressable
                                    onPress={() => nav.push('/account')}
                                    accessibilityLabel='Account settings'
                                    style={({ pressed }) => [
                                        st.gearBtnInner,
                                        { opacity: pressed ? 0.6 : 1 },
                                    ]}
                                >
                                    <GearIcon />
                                </Pressable>
                            </GlassCard>
                            <Text style={st.city}>{place?.name}</Text>
                            <Text style={st.condition}>
                                {humanizeCondition(weather.WeatherText)}
                            </Text>
                            {lastUpdated && (
                                <Text style={st.lastUpdated}>
                                    {formatLastUpdated(lastUpdated)}
                                </Text>
                            )}
                        </View>

                        {/* Hero icon + temperature */}
                        <View style={st.hero}>
                            <WeatherIconDisplay
                                condition={weather.WeatherText}
                                isDay={weather.IsDayTime}
                                size='large'
                                temperature={tempVal}
                                feelsLike={feelsVal}
                            />
                            {hiTemp !== null && loTemp !== null && (
                                <Text style={st.hiLo}>
                                    H:{hiTemp}° L:{loTemp}°
                                </Text>
                            )}
                        </View>

                        {/* Hourly forecast strip — interleaves sunrise/sunset tiles */}
                        {stripItems.length > 0 && (
                            <GlassGroup spacing={8}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={st.forecastStrip}
                                >
                                    {stripItems.map((item, i) =>
                                        item.kind === 'forecast' ? (
                                            <MinimizedWeatherDisplay
                                                key={`f-${item.time}`}
                                                weather={item.data.IconPhrase}
                                                temperature={
                                                    isMetric
                                                        ? fToC(
                                                              item.data
                                                                  .Temperature
                                                                  .Value,
                                                          )
                                                        : item.data.Temperature
                                                              .Value
                                                }
                                                time={item.data.DateTime}
                                                tempUnit={
                                                    isMetric
                                                        ? 'C'
                                                        : item.data.Temperature
                                                              .Unit
                                                }
                                                isDay={item.data.IsDaylight}
                                                isNow={i === 0}
                                            />
                                        ) : (
                                            <SunEventTile
                                                key={`s-${item.sun.kind}-${item.time}`}
                                                time={item.time}
                                                temperature={item.temp}
                                                tempUnit={isMetric ? 'C' : 'F'}
                                            />
                                        ),
                                    )}
                                </ScrollView>
                            </GlassGroup>
                        )}

                        {/* Details + outfit */}
                        <GlassCard style={st.details}>
                            <WeatherDetails
                                weather={weather}
                                settings={settings}
                                forecasts={forecasts}
                            />
                        </GlassCard>
                        {/* WeatherKit attribution — required by Apple. */}
                        <View style={st.weatherAttribution}>
                            <Pressable
                                onPress={() =>
                                    Linking.openURL(
                                        'https://weatherkit.apple.com/legal-attribution.html',
                                    ).catch(() => {})
                                }
                                hitSlop={6}
                                accessibilityRole='link'
                                accessibilityLabel='Weather data provided by Apple Weather'
                            >
                                <Text style={st.lastUpdated}>
                                    {' '}
                                    Weather data provided by Apple Weather
                                </Text>
                            </Pressable>
                        </View>
                    </ScrollView>
                </View>
            )}
        </AnimatedLinearGradient>
    );
};

export default WeatherHUD;
