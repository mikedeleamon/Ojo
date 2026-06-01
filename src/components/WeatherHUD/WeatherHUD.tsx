import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ScrollView,
    RefreshControl,
    Pressable,
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
import SunnyIcon from '../WeatherIcons/SunnyIcon';
import Loading from '../Loading/Loading';
import WeatherDetails from '../WeatherDetails/WeatherDetails';
import MinimizedWeatherDisplay from '../MinimizedWeatherDisplay/MinimizedWeatherDisplay';
import { useWeatherTheme } from '../../context/WeatherContext';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { CityData, CurrentWeather, Forecast, Settings } from '../../types';
import { spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { flattenHsl, hslToHex, lerpHslFlat } from './colorMath';

// LinearGradient driven by a UI-thread worklet via useAnimatedProps. The
// gradient's colors prop is updated directly on the native view each frame,
// bypassing the JS thread (and React reconciliation) entirely.
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
import { gradientFor, footerBgFor, formatLastUpdated } from './weatherPalette';
import { fToC } from '../../lib/units';
import { makeStyles } from './WeatherHUD.styles';

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    location: string;
    settings: Settings;
    refreshKey?: number;
    onRefresh?: () => void;
}


const WeatherHUD = ({ location, settings, refreshKey, onRefresh }: Props) => {
    const { colors } = useTheme();
    const st = useMemo(() => makeStyles(colors), [colors]);
    const { setFooterBg } = useWeatherTheme();
    const { top: topInset } = useSafeAreaInsets();
    const tabPad = useTabBarPadding();
    const nav = useAppNavigation();
    const [city, setCity] = useState<CityData | null>(null);
    const [weather, setWeather] = useState<CurrentWeather | null>(null);
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
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
    } | null>(null);
    const isRefreshRef = useRef(false);

    const flushPending = () => {
        if (pendingRef.current) {
            const { weather: w, forecasts: f } = pendingRef.current;
            setWeather(w);
            setForecasts(f);
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

    // ── Fetch city ──────────────────────────────────────────────────────────────
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
        api.get(weatherConstants.GET_CITY, { params: { q: location } })
            .then(({ data }) => {
                if (data?.Key) {
                    setCity(data);
                } else {
                    setError('Location not found. Check your city name.');
                    setLoading(false);
                    setRefreshing(false);
                }
            })
            .catch((err) => {
                const status = err?.response?.status;
                setError(
                    status === 429
                        ? 'Weather API rate limit reached. Wait a few minutes and try again.'
                        : 'Could not resolve location. Please try again later.',
                );
                setLoading(false);
                setRefreshing(false);
            });
    }, [location, refreshKey]);

    // ── Fetch weather ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!city?.Key) return;
        Promise.all([
            api.get(`${weatherConstants.GET_CURRENT_WEATHER}/${city.Key}`, {
                params: { details: true },
            }),
            api.get(`${weatherConstants.GET_CURRENT_FORECAST}/${city.Key}`),
        ])
            .then(([wRes, fRes]) => {
                const raw = wRes.data?.[0];
                if (!raw) throw new Error('Empty response');

                // Parse AirAndPollen (present when details: true)
                const airPollen: { Name: string; Value: number; Category: string }[] =
                    raw.AirAndPollen ?? [];
                const airQuality = airPollen.find((e: any) => e.Name === 'AirQuality');
                const POLLEN_NAMES = new Set(['Tree', 'Grass', 'Ragweed', 'Weed']);
                const POLLEN_ORDER = ['Low', 'Moderate', 'High', 'Very High'];
                const pollenEntries = airPollen.filter((e: any) => POLLEN_NAMES.has(e.Name));
                const worstPollen = pollenEntries.reduce(
                    (worst: any, e: any) =>
                        POLLEN_ORDER.indexOf(e.Category) > POLLEN_ORDER.indexOf(worst?.Category ?? 'Low')
                            ? e : worst,
                    null,
                );
                const w = {
                    ...raw,
                    AirQualityText:  airQuality?.Category ?? undefined,
                    AirQualityIndex: airQuality?.Value    ?? undefined,
                    PollenCategory:  worstPollen?.Category ?? undefined,
                };

                if (isRefreshRef.current) {
                    // Pull-to-refresh in flight — buffer until finally() flushes atomically
                    pendingRef.current = {
                        weather: w,
                        forecasts: fRes.data ?? [],
                    };
                } else {
                    setWeather(w);
                    setForecasts(fRes.data ?? []);
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
    }, [city]);

    // ── Animated gradient color interpolation ───────────────────────────────────
    // The "from" and "to" gradients live in shared values; a single progress
    // shared value drives the transition with withTiming on the UI thread. The
    // useAnimatedProps worklet recomputes interpolated colors per frame natively,
    // so the gradient stays smooth even while the JS thread is busy (image
    // decoding, fetch parsing, scroll handlers).
    const DEFAULT_GRADIENT: readonly string[] = useMemo(() => [
        colors.bgDefault,
        colors.bgDefault,
        colors.bgDefault,
    ], [colors.bgDefault]);

    // Hex parsing happens once when from/to change (JS thread). The worklet
    // only does numeric HSL interpolation + one hslToHex per stop per frame,
    // avoiding ~6 `parseInt` calls per stop per frame that previously ran on
    // the UI thread and were the dominant source of gradient jank.
    const defaultHsl = useMemo(() => flattenHsl(DEFAULT_GRADIENT), [DEFAULT_GRADIENT]);
    const fromHsl = useSharedValue<number[]>(defaultHsl);
    const toHsl = useSharedValue<number[]>(defaultHsl);
    const progress = useSharedValue(1);

    const loadingOpacity = useRef(new RNAnimated.Value(1)).current;

    // Compute target gradient from weather data. Memoised so the dependency
    // array gets a stable reference (was `.join(',')` on every render).
    const targetGradient = useMemo(
        () => (weather
            ? gradientFor(weather.WeatherText, weather.IsDayTime)
            : DEFAULT_GRADIENT),
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
            const e = stopT < 0.5 ? 2 * stopT * stopT : 1 - Math.pow(-2 * stopT + 2, 2) / 2;
            const b = i * 3;
            const h1 = from[b],     s1 = from[b + 1], l1 = from[b + 2];
            const h2 = to[b],       s2 = to[b + 1],   l2 = to[b + 2];
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
        const snapshot = lerpHslFlat(fromHsl.value, toHsl.value, progress.value);
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
        return { hiTemp: Math.round(Math.max(...temps)), loTemp: Math.round(Math.min(...temps)) };
    }, [forecasts, isMetric]);

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
            colors={DEFAULT_GRADIENT as unknown as [string, string, ...string[]]}
            animatedProps={animatedGradientProps}
            style={st.root}
        >
            {/* Transparent loading spinner — sits over the animating gradient */}
            <RNAnimated.View
                style={[st.loadingOverlay, { opacity: loadingOpacity }]}
                pointerEvents={loading ? 'auto' : 'none'}
            >
                <RNAnimated.View
                    style={[st.loadingIcon, { transform: [{ rotate: spinRotate }] }]}
                >
                    <SunnyIcon size={st.loadingIcon.width} />
                </RNAnimated.View>
            </RNAnimated.View>

            {/* Content renders at full opacity so GlassView can initialise its
                native material correctly. The loading overlay sits on top and
                fades out, revealing the content beneath. */}
            {weather && (
                <View
                    style={st.contentLayer}
                    pointerEvents={loading ? 'none' : 'auto'}
                >
                    <ScrollView
                        contentContainerStyle={[st.scroll, { paddingBottom: tabPad }]}
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
                                glassStyle="clear"
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
                            <Text style={st.city}>{city?.LocalizedName}</Text>
                            <Text style={st.condition}>
                                {weather.WeatherText}
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

                        {/* Hourly forecast strip */}
                        {forecasts.length > 0 && (
                            <GlassGroup spacing={8}>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={st.forecastStrip}
                                >
                                    {forecasts.map((f, i) => (
                                        <MinimizedWeatherDisplay
                                            key={i}
                                            weather={f.IconPhrase}
                                            temperature={isMetric ? fToC(f.Temperature.Value) : f.Temperature.Value}
                                            time={f.DateTime}
                                            tempUnit={isMetric ? 'C' : f.Temperature.Unit}
                                            isDay={f.IsDaylight}
                                            isNow={i === 0}
                                        />
                                    ))}
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
                    </ScrollView>
                </View>
            )}
        </AnimatedLinearGradient>
    );
};

export default WeatherHUD;
