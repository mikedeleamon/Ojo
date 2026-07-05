import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
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
    useAnimatedScrollHandler,
    useAnimatedReaction,
    useAnimatedRef,
    runOnJS,
    FadeIn,
    withTiming,
    Easing as REasing,
} from 'react-native-reanimated';
import { useSpinAnimation } from '../../hooks/useSpinAnimation';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTabBarPadding } from '../../hooks/useTabBarPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Path } from 'react-native-svg';
import { View, Text, GlassCard, GlassGroup } from '../primitives';
import GearIcon from '../icons/GearIcon';
import LocationsIcon from '../icons/LocationsIcon';
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
import ShareToInstagramSheet from '../ShareCard/ShareToInstagramSheet';
import WeatherForecastShareCard from '../ShareCard/WeatherForecastShareCard';
import { weatherShareLink } from '../../lib/share/deepLinks';
import { useWeatherTheme } from '../../context/WeatherContext';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import {
    CurrentWeather,
    DailyForecast,
    Forecast,
    LocationCoords,
    Settings,
    WeatherSnapshot,
} from '../../types';
import { geocodeCity } from '../../lib/geocoding';
import { spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import { flattenHsl, hslToHex, lerpHslFlat } from './colorMath';

// LinearGradient driven by a UI-thread worklet via useAnimatedProps. The
// gradient's colors prop is updated directly on the native view each frame,
// bypassing the JS thread (and React reconciliation) entirely.
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
import { gradientFor, footerBgFor } from './weatherPalette';
import { isClearNight, isThunderstorm } from '../../lib/weather/conditions';
import LastUpdated from './LastUpdated';
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
// `sorted` must already be chronologically ordered (the caller sorts once).
const tempAtTime = (target: number, sorted: Forecast[]): number | null => {
    if (sorted.length === 0) return null;
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
    /**
     * Cached weather for this location, used to paint instantly (and offline)
     * while a fresh fetch happens in the background. Keyed by the caller per
     * active city, so it changes when the user switches cities.
     */
    seedSnapshot?: WeatherSnapshot | null;
    /** Fired with a fresh payload after each successful fetch, for caching. */
    onSnapshot?: (snap: WeatherSnapshot) => void;
    /** Opens the Locations switcher screen. */
    onOpenLocations?: () => void;
}

const WeatherHUD = ({
    location,
    settings,
    refreshKey,
    onRefresh,
    onReady,
    showInlineLoader = true,
    seedSnapshot,
    onSnapshot,
    onOpenLocations,
}: Props) => {
    const { colors } = useTheme();
    const st = useMemo(() => makeStyles(colors), [colors]);
    const reduceMotion = useReduceMotion();
    const { setFooterBg } = useWeatherTheme();
    const { top: topInset } = useSafeAreaInsets();
    const tabPad = useTabBarPadding();
    const nav = useAppNavigation();
    // Seed the resolved place (coords + city name) from the cached snapshot so
    // the city label paints immediately on a warm load, in lockstep with the
    // rest of the HUD — instead of lagging behind the async geocode below.
    const [place, setPlace] = useState<LocationCoords | null>(
        seedSnapshot?.place ?? null,
    );
    // Seed from the cached snapshot (if any) so a city switch paints instantly.
    const [weather, setWeather] = useState<CurrentWeather | null>(
        seedSnapshot?.weather ?? null,
    );
    const [forecasts, setForecasts] = useState<Forecast[]>(
        seedSnapshot?.forecasts ?? [],
    );
    const [sunEvents, setSunEvents] = useState<SunEvent[]>(
        seedSnapshot ? extractSunEvents(seedSnapshot.daily) : [],
    );
    // Kept for the "Share forecast" card (WeatherForecastShareCard) — the daily
    // payload was already being fetched for sun events, just not retained.
    const [daily, setDaily] = useState<DailyForecast[]>(seedSnapshot?.daily ?? []);
    const [loading, setLoading] = useState(!seedSnapshot);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(
        seedSnapshot ? new Date(seedSnapshot.fetchedAt) : null,
    );

    // ── Pull-to-refresh buffering ───────────────────────────────────────────────
    // While a pull-to-refresh is in flight, incoming data is held in pendingRef
    // instead of being applied immediately. In finally() we flush pending + clear
    // the spinner atomically so new content and the dismissal happen in one render.
    const pendingRef = useRef<{
        weather: CurrentWeather;
        forecasts: Forecast[];
        sunEvents: SunEvent[];
        daily: DailyForecast[];
    } | null>(null);
    const isRefreshRef = useRef(false);

    const flushPending = () => {
        if (pendingRef.current) {
            const {
                weather: w,
                forecasts: f,
                sunEvents: s,
                daily: d,
            } = pendingRef.current;
            setWeather(w);
            setForecasts(f);
            setSunEvents(s);
            setDaily(d);
            setFooterBg(footerBgFor(w.WeatherText, w.IsDayTime));
            setLastUpdated(new Date());
            pendingRef.current = null;
        }
    };

    // ── Re-seed on city switch ─────────────────────────────────────────────────
    // When the active city changes, its cached snapshot (if any) replaces the
    // current view immediately; the background fetch below then refreshes it.
    useEffect(() => {
        if (!seedSnapshot) return;
        setWeather(seedSnapshot.weather);
        setForecasts(seedSnapshot.forecasts);
        setSunEvents(extractSunEvents(seedSnapshot.daily));
        if (seedSnapshot.place) setPlace(seedSnapshot.place);
        setFooterBg(
            footerBgFor(
                seedSnapshot.weather.WeatherText,
                seedSnapshot.weather.IsDayTime,
            ),
        );
        setLastUpdated(new Date(seedSnapshot.fetchedAt));
        setLoading(false);
        setError(null);
    }, [seedSnapshot]);

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
        // Keep showing the cached snapshot (if any) while we re-geocode + fetch;
        // only show the spinner on a cold load with nothing cached.
        if (!seedSnapshot) setLoading(true);
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

                // Hand the fresh payload to the parent for per-city caching.
                onSnapshot?.({
                    weather: w,
                    forecasts: fRes.data ?? [],
                    daily: dRes.data ?? [],
                    fetchedAt: new Date().toISOString(),
                    place,
                });

                if (isRefreshRef.current) {
                    // Pull-to-refresh in flight — buffer until finally() flushes atomically
                    pendingRef.current = {
                        weather: w,
                        forecasts: fRes.data ?? [],
                        sunEvents: events,
                        daily: dRes.data ?? [],
                    };
                } else {
                    setWeather(w);
                    setForecasts(fRes.data ?? []);
                    setSunEvents(events);
                    setDaily(dRes.data ?? []);
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
        if (reduceMotion) {
            // Snap straight to the destination gradient — no animated hue sweep.
            progress.value = 1;
        } else {
            progress.value = withTiming(1, {
                duration: isFirstPaint ? 2500 : 2000,
                easing: REasing.inOut(REasing.cubic),
            });
        }
    }, [targetGradient, reduceMotion]);

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

    // ── Sticky mini header (drives the fade/slide as the hero scrolls away) ───
    // scrollY is updated on the UI thread by useAnimatedScrollHandler. The mini
    // header's style is computed inside a worklet that reads scrollY directly,
    // so the fade tracks the finger with no JS-thread involvement.
    const scrollY = useSharedValue(0);
    const [heroBottomY, setHeroBottomY] = useState(0);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            scrollY.value = e.contentOffset.y;
        },
    });

    const scrollRef = useAnimatedRef<Animated.ScrollView>();

    const scrollToTop = useCallback(() => {
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }, [scrollRef]);

    // NativeTabs resets scroll automatically on tab switches (UITabBarController
    // detaches the view). For push-route returns (e.g. Settings), the component
    // stays mounted so we need an explicit reset. We zero out the shared value
    // first so useAnimatedReaction hides the pill before the view moves —
    // no FadeOut fires because we also removed the exiting animation on the pill.
    useFocusEffect(useCallback(() => {
        scrollY.value = 0;
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, [scrollRef, scrollY]));


    // Bridges scroll position → JS-side visibility flag so the GlassCard pill
    // can be conditionally mounted/unmounted. Mounting fresh at opacity:1 lets
    // iOS UIVisualEffectView initialise its blur correctly every time — the
    // entering/exiting Reanimated animations handle the fade.
    const [miniVisible, setMiniVisible] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);

    useAnimatedReaction(
        () => heroBottomY > 0 && scrollY.value > heroBottomY - 40,
        (current, previous) => {
            if (current !== previous) runOnJS(setMiniVisible)(current);
        },
        [heroBottomY],
    );

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
            const tempF = tempAtTime(t, sorted);
            if (tempF === null) continue;
            const temp = Math.round(isMetric ? fToC(tempF) : tempF);
            items.push({ kind: 'sun', time: ev.time, sun: ev, temp });
        }
        return items.sort(
            (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
        );
    }, [forecasts, sunEvents, isMetric]);

    // Full-screen star backdrop for clear nights; storm backdrop for thunder.
    // Both derive from the shared classifier so they track the icon/gradient.
    const isClearNightBg = !!weather && isClearNight(weather.WeatherText, weather.IsDayTime);
    const isStormBg = !!weather && isThunderstorm(weather.WeatherText);

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
                    <Animated.ScrollView
                        ref={scrollRef}
                        contentContainerStyle={[
                            st.scroll,
                            { paddingBottom: tabPad },
                        ]}
                        showsVerticalScrollIndicator={false}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
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
                        {/* Header — only city/condition/lastUpdated live in the
                            scroll surface now. The Locations/Gear buttons + a
                            scroll-driven mini summary moved to the sticky bar
                            below. */}
                        <View
                            style={[
                                st.header,
                                { paddingTop: spacing.lg + topInset },
                            ]}
                        >
                            <Text style={st.city}>{place?.name}</Text>
                            <Text style={st.condition}>
                                {humanizeCondition(weather.WeatherText)}
                            </Text>
                            {lastUpdated && (
                                <LastUpdated
                                    date={lastUpdated}
                                    style={st.lastUpdated}
                                />
                            )}
                        </View>

                        {/* Hero icon + temperature. onLayout reports the bottom
                            edge so the sticky mini knows when to fade in. */}
                        <View
                            style={st.hero}
                            onLayout={(e) => {
                                const { y, height } = e.nativeEvent.layout;
                                setHeroBottomY(y + height);
                            }}
                        >
                            <WeatherIconDisplay
                                condition={weather.WeatherText}
                                isDay={weather.IsDayTime}
                                size='large'
                                temperature={tempVal}
                                feelsLike={feelsVal}
                                latitude={place?.lat}
                            />
                            {hiTemp !== null && loTemp !== null && (
                                <Text style={st.hiLo}>
                                    H:{hiTemp}° L:{loTemp}°
                                </Text>
                            )}
                        </View>

                        {/* Hourly forecast strip — interleaves sunrise/sunset tiles.
                            Each tile is an individual GlassCard so it picks up
                            colorScheme="dark" from ForceDarkPalette on MainPage,
                            keeping tiles consistent between light and dark mode.
                            (GlassGroup/GlassContainer has no colorScheme prop and
                            always follows UIWindow, which breaks consistency.) */}
                        {stripItems.length > 0 && (
                            <View>
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
                            </View>
                        )}

                        {/* Details + outfit */}
                        <GlassCard style={st.details}>
                            <WeatherDetails
                                weather={weather}
                                settings={settings}
                                forecasts={forecasts}
                            />
                        </GlassCard>

                        {daily.length > 0 && (
                            <Pressable
                                style={st.shareForecastBtn}
                                onPress={() => setShowShareSheet(true)}
                                accessibilityRole='button'
                                accessibilityLabel='Share forecast to Instagram'
                            >
                                <Text style={st.shareForecastBtnText}>
                                    📸  Share forecast
                                </Text>
                            </Pressable>
                        )}

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
                    </Animated.ScrollView>

                    {/* Sticky top bar — pinned buttons + scroll-driven mini
                        summary. Sits as a sibling of (and above) the scroll
                        view. pointerEvents="box-none" lets pulls/scrolls fall
                        through everywhere except the button hit areas. */}
                    <View
                        style={[st.stickyBar, { top: topInset + 8 }]}
                        pointerEvents='box-none'
                    >
                        {onOpenLocations ? (
                            <GlassCard
                                glassStyle='clear'
                                style={st.locationsBtn}
                            >
                                <Pressable
                                    onPress={onOpenLocations}
                                    accessibilityLabel='Switch location'
                                    style={({ pressed }) => [
                                        st.locationsBtnInner,
                                        { opacity: pressed ? 0.6 : 1 },
                                    ]}
                                >
                                    <LocationsIcon />
                                </Pressable>
                            </GlassCard>
                        ) : (
                            <View style={st.locationsBtnPlaceholder} />
                        )}
                        {miniVisible && (
                            <Animated.View
                                entering={FadeIn.duration(200)}
                                style={st.miniWrap}
                                pointerEvents='box-none'
                            >
                                <Pressable
                                    onPress={scrollToTop}
                                    accessibilityLabel='Scroll to top'
                                    accessibilityRole='button'
                                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                                >
                                    <GlassCard
                                        glassStyle='regular'
                                        style={st.miniPill}
                                    >
                                        <WeatherIconDisplay
                                            condition={weather.WeatherText}
                                            isDay={weather.IsDayTime}
                                            size='small'
                                            animate
                                            latitude={place?.lat}
                                        />
                                        <Text
                                            style={st.miniCity}
                                            numberOfLines={1}
                                        >
                                            {place?.name}
                                        </Text>
                                        <Text style={st.miniTemp}>{tempVal}°</Text>
                                    </GlassCard>
                                </Pressable>
                            </Animated.View>
                        )}
                        <GlassCard glassStyle='clear' style={st.gearBtn}>
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
                    </View>

                    <ShareToInstagramSheet
                        visible={showShareSheet}
                        onClose={() => setShowShareSheet(false)}
                        renderCard={(cardRef) => (
                            <WeatherForecastShareCard
                                ref={cardRef}
                                place={place?.name ?? 'My Location'}
                                weather={weather}
                                daily={daily}
                            />
                        )}
                        attributionURL={weatherShareLink()}
                        backgroundTopColor='#0C4A6E'
                        backgroundBottomColor='#0F172A'
                    />
                </View>
            )}
        </AnimatedLinearGradient>
    );
};

export default WeatherHUD;
