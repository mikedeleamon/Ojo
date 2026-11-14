import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useIsFocused } from 'expo-router';
import {
    ScrollView,
    RefreshControl,
    Pressable,
    Linking,
    AppState,
    Animated as RNAnimated,
    Easing as RNEasing,
    StyleSheet,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedProps,
    useAnimatedScrollHandler,
    useAnimatedReaction,
    useAnimatedRef,
    useAnimatedStyle,
    runOnJS,
    FadeIn,
    withTiming,
    Easing as REasing,
    type SharedValue,
} from 'react-native-reanimated';
import { useSpinAnimation } from '../../hooks/useSpinAnimation';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { useTabBarPadding } from '../../hooks/useTabBarPadding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { View, Text, GlassCard } from '../primitives';
import GearIcon from '../icons/GearIcon';
import LocationsIcon from '../icons/LocationsIcon';
import CameraIcon from '../icons/CameraIcon';
import api from '../../api/client';
import { authHeaders } from '../../lib/auth';
import weatherConstants from '../../constants/weatherConstants';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import ClearNightIconMoon from '../WeatherIcons/ClearNightIconMoon';
import StormIconLightning from '../WeatherIcons/StormIconLightning';
import SunnyIcon from '../WeatherIcons/SunnyIcon';
import WeatherDetails, { WeatherStats, WeatherStatsLine } from '../WeatherDetails/WeatherDetails';
import { useFoldLayout } from '../../context/FoldLayoutContext';
import { useSideRail } from '../../hooks/useSideRail';
import { useStackedHome } from '../../hooks/useStackedHome';
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
import { useTheme, ThemeOverride } from '../../theme/ThemeContext';
import { blendHsl, flattenHsl, hslToHex, lerpHslFlat } from './colorMath';

// LinearGradient driven by a UI-thread worklet via useAnimatedProps. The
// gradient's colors prop is updated directly on the native view each frame,
// bypassing the JS thread (and React reconciliation) entirely.
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
import { gradientFor, footerBgFor } from './weatherPalette';
import { accentFromGradient } from '../../lib/weather/accentColor';
import { backdropLayersFor, NO_LAYERS } from '../../lib/weather/backdropLayers';
import { SNOW_GROUPS } from '../../lib/weather/backdropSpec';
import { devCondition, devIsDay, devTempF } from '../../lib/debug/devWeatherOverride';
import { edgeSplashes, glassEffectFor } from '../../lib/weather/weatherGlass';
import WeatherGlassOverlay from '../WeatherGlass/WeatherGlassOverlay';
import RainEdgeSplash, { SPLASH_RISE } from '../WeatherGlass/RainEdgeSplash';
import FlakeFall from './FlakeFall';
import FogDrift from './FogDrift';
import ShootingStar from './ShootingStar';
import SunGlare from './SunGlare';
import { solarPosition, type SolarPosition } from '../../lib/solarPosition';
import { lookFor } from '../../lib/visualLibrary/looks';
import { rainAngleFor } from '../../lib/weather/windSlant';
import BackdropLayer, { SCROLL_RANGE } from './BackdropLayer';
import PerfPanel from '../debug/PerfPanel';
import { usePerfFlags } from '../../lib/debug/perfFlags';
import LastUpdated from './LastUpdated';
import {
    HAZY_BACKDROP_LIFT,
    isLightSky,
    lightSkyFade,
    STACKED_HOME_TEXT_BAND,
    LIGHT_SKY_CARD_TEXT,
    LIGHT_SKY_CARD_TINT,
    LIGHT_SKY_INNER_TINT,
    LIGHT_SKY_SCRIM,
    LIGHT_SKY_TEXT,
    PARTICLE_BACKDROP_LIFT,
} from '../../lib/weather/skyContrast';
import { fToC } from '../../lib/units';
import { humanizeCondition } from '../../lib/weather/humanizeCondition';
import { makeStyles } from './WeatherHUD.styles';
import type { ScrollViewRef } from '../../types/nativeRefs';

/**
 * Rotated Duo: the row under the status bar that holds Location, the city and
 * Settings, measured down from the top inset. These are the HUD's own buttons,
 * not native bar items as on the Duo's other poses: iOS would put those level
 * with the clock, beside it rather than under it.
 */
const STACKED_NAV_ROW_TOP = 3;

/**
 * Two panes: the clear space above the capitals of the 36 pt city name. The
 * outfit card's top edge sits this far below the hero's top, so it lines up with
 * the letters rather than with the line box around them.
 */
const CITY_CAP_OFFSET = 10;

/** Long enough for the loading overlay to fade before the scroll bar shows. */
const CARD_SCROLL_BAR_FLASH_DELAY_MS = 500;

/** Keeps the card's scroll bar clear of its rounded corners. */
const CARD_SCROLL_BAR_INSETS = { top: 10, bottom: 10 };

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

// ─── Wall-clock helpers ───────────────────────────────────────────────────────
// Forecast hours land on UTC hour boundaries, so bucketing by whole hours since
// the epoch identifies "which hour is this" without any timezone reasoning.

const HOUR_MS = 3_600_000;
const hourBucketOf = (t: string | number): number =>
    Math.floor(new Date(t).getTime() / HOUR_MS);

/** How often the solar position is resampled. See the note at its useEffect. */
const SUN_TICK_MS = 300_000;

// ─── Animated gradient colours ────────────────────────────────────────────────
// Interpolates a flattened HSL gradient on the UI thread and returns it as the
// `colors` prop for a LinearGradient. Hex parsing happens on the JS thread when
// from/to change; the worklet only does numeric HSL interpolation plus one
// hslToHex per stop per frame.
const useInterpolatedGradient = (
    fromHsl: SharedValue<number[]>,
    toHsl: SharedValue<number[]>,
    progress: SharedValue<number>,
) =>
    useAnimatedProps(() => {
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
            const [h, s, l] = blendHsl(h1, s1, l1, h2, s2, l2, e);
            result[i] = hslToHex(h, s, l);
        }
        return { colors: result as unknown as [string, string, ...string[]] };
    });

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
    // Dev-only bisection switches; every flag is `true` in a release build, so
    // this reads as the current behaviour everywhere but the perf panel.
    const perf = usePerfFlags();
    const { setFooterBg, setAccent } = useWeatherTheme();
    const { top: topInset, right: rightInset } = useSafeAreaInsets();
    const tabPad = useTabBarPadding();
    const fold = useFoldLayout();
    // iPhone Duo: Location and Settings are nav-bar items in the side column
    // (MainPage), so the sticky bar drops its own buttons and the hero moves up.
    const sideRail = useSideRail();
    // Duo inner screen turned upright: weather above the fold, outfit below it.
    const stacked = useStackedHome();
    const isStacked = stacked !== null;
    const twoPane = fold.mode === 'two-pane' && fold.axis === 'row' && fold.panes !== null;
    // Where the weather has its own pane, pull to refresh starts from it.
    const refreshFromWeather = twoPane || isStacked;
    const paneHeight = fold.window.height;
    const paneHeroTop = (sideRail ? 40 : 64) + topInset;
    const outfitCardTop = paneHeroTop + CITY_CAP_OFFSET;
    // Two panes: the card stops at the bottom margin the page keeps anyway, and
    // anything taller scrolls inside it.
    const outfitCardMaxHeight = paneHeight - outfitCardTop - tabPad;
    const weatherPaneStyle = twoPane && fold.panes
        ? { width: fold.panes.primary.width, height: paneHeight, paddingRight: fold.gutter / 2 }
        : null;
    const outfitPaneStyle = twoPane && fold.panes
        ? {
              width: fold.panes.secondary.width - rightInset,
              paddingLeft: fold.gutter / 2,
              paddingTop: outfitCardTop,
          }
        : null;
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
    // Kept as state (not just flattened into sunEvents) so today's High/Low,
    // rain chance and sunset can flow down to the outfit card + widget snapshot.
    const [daily, setDaily] = useState<DailyForecast[]>(
        seedSnapshot?.daily ?? [],
    );
    const [sunEvents, setSunEvents] = useState<SunEvent[]>(
        seedSnapshot ? extractSunEvents(seedSnapshot.daily) : [],
    );
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
        daily: DailyForecast[];
        sunEvents: SunEvent[];
    } | null>(null);
    const isRefreshRef = useRef(false);

    const flushPending = () => {
        if (pendingRef.current) {
            const {
                weather: w,
                forecasts: f,
                daily: d,
                sunEvents: s,
            } = pendingRef.current;
            setWeather(w);
            setForecasts(f);
            setDaily(d);
            setSunEvents(s);
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
        setDaily(seedSnapshot.daily);
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
                "We can't find your location. Allow location access, or add a city to see its weather.",
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

    // ── Keep the view on the wall clock ────────────────────────────────────────
    // The fetch below is keyed on `place`, which only changes on mount, a city
    // switch or a pull-to-refresh. Nothing else re-ran it, so a screen left
    // mounted — open on the desk, or backgrounded and resumed, since RN keeps
    // MainPage alive — kept rendering the same twelve timestamps indefinitely:
    // the hourly strip appeared frozen at whatever hour the app was opened.
    //
    // Bucketing rather than a plain interval is what makes this cheap: the
    // 60s tick calls setState with an unchanged value for 59 of every 60
    // minutes and React bails out, so exactly one re-fetch happens per hour —
    // the rate at which the data can actually change.
    const [hourBucket, setHourBucket] = useState(() => hourBucketOf(Date.now()));

    useEffect(() => {
        const sync = () => setHourBucket(hourBucketOf(Date.now()));
        const timer = setInterval(sync, 60_000);
        // Timers are suspended while backgrounded, so a resume can't wait for
        // the next tick to notice that hours have passed.
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') sync();
        });
        return () => {
            clearInterval(timer);
            sub.remove();
        };
    }, []);

    // ── Fetch weather (WeatherKit via server proxy) ────────────────────────────
    // `cancelled` (same idiom as the geocode effect above) guards against a
    // fetch for a superseded `place` resolving AFTER a newer one and clobbering
    // fresh data with stale — MainPage's refresh sequencing closes the specific
    // GPS-refresh race that motivated this, but nothing here depends on THAT
    // fix: this is the general "ignore a stale response" guard, so any other
    // path that makes `place` change twice in quick succession stays correct
    // too. Only the fetch instance for the CURRENT `place` ever writes state.
    useEffect(() => {
        if (!place) return;
        let cancelled = false;
        // The weather routes require a signed-in user. Without the header each
        // of these three requests 401'd, ran a token refresh in the axios
        // interceptor, and only then succeeded on the retry: three refreshes
        // and six extra round trips on every Home load.
        const params = { params: { lat: place.lat, lon: place.lon }, ...authHeaders() };
        Promise.all([
            api.get<CurrentWeather>(weatherConstants.GET_CURRENT, params),
            api.get<Forecast[]>(weatherConstants.GET_HOURLY, params),
            api.get<DailyForecast[]>(weatherConstants.GET_DAILY, params),
        ])
            .then(([wRes, fRes, dRes]) => {
                if (cancelled) return;
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
                        daily: dRes.data ?? [],
                        sunEvents: events,
                    };
                } else {
                    setWeather(w);
                    setForecasts(fRes.data ?? []);
                    setDaily(dRes.data ?? []);
                    setSunEvents(events);
                    setFooterBg(footerBgFor(w.WeatherText, w.IsDayTime));
                    setLastUpdated(new Date());
                }
            })
            .catch((err) => {
                if (cancelled) return;
                const status = err?.response?.status;
                setError(
                    status === 429
                        ? 'Weather API rate limit reached. Wait a few minutes and try again.'
                        : 'Could not load weather. Please try again later.',
                );
            })
            .finally(() => {
                // A superseded fetch skips the flush/spinner-clear entirely — that's
                // left to the newer fetch's own finally(), which always runs (its
                // `cancelled` only flips true if a THIRD place comes in behind it).
                if (cancelled) return;
                flushPending();
                isRefreshRef.current = false;
                setLoading(false);
                setRefreshing(false);
            });
        return () => {
            cancelled = true;
        };
        // `hourBucket` re-runs this silently once an hour: nothing here sets
        // `loading`, and a failure only reaches the UI when there's no weather
        // to show, so a background refresh can't flash a spinner or an error
        // over good data.
    }, [place, hourBucket]);

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

    // ── Solar elevation (drives the time-of-day sky) ──────────────────────────
    // Recomputed on a timer rather than continuously: feeding it from a
    // per-frame shared value would keep the gradient worklet alive forever
    // instead of only during the ~2s transitions — turning a free change into a
    // permanent per-frame cost.
    //
    // The interval was 60s, which was finer than the gradient could express
    // anyway (the sun moves ~0.25°/min) and cost a full WeatherHUD re-render
    // every minute, since solarPosition returns a fresh object each call. At
    // 300s the sun moves ~1.25° between samples — still well inside the width
    // of a single gradient band — for a fifth of the re-renders.
    const [sun, setSun] = useState<SolarPosition | undefined>(undefined);

    useEffect(() => {
        if (!place) return;
        const update = () => setSun(solarPosition(place.lat, place.lon));
        update();
        const timer = setInterval(update, SUN_TICK_MS);

        // Timers are suspended while backgrounded, so at a 300s tick a resume
        // could otherwise land on a sky up to five minutes stale — most visible
        // around sunrise/sunset, where the gradient moves fastest.
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') update();
        });
        return () => {
            clearInterval(timer);
            sub.remove();
        };
    }, [place?.lat, place?.lon]);

    // Compute target gradient from weather data. Memoised so the dependency
    // array gets a stable reference (was `.join(',')` on every render).
    //
    // Keyed on the *joined colours*, not the elevation: between stops the
    // palette is identical for long stretches (all of midday, all of night), and
    // without this a new array every 60s would retrigger a 2s hue sweep each
    // minute for no visible change.
    // `sun` is a fresh object each tick, but the memo below keys on the joined
    // colours, so that identity churn never reaches the gradient animation.
    // The condition the backdrop (gradient + particle layers) draws. Always the
    // real one outside dev; see lib/debug/devWeatherOverride.
    const bgCondition = weather ? devCondition(weather.WeatherText) : '';
    const bgIsDay = weather ? devIsDay(weather.IsDayTime) : true;
    const rawGradient = weather
        ? gradientFor(
              bgCondition,
              bgIsDay,
              sun?.elevationDeg,
              sun?.isRising,
          )
        : DEFAULT_GRADIENT;
    const gradientKey = rawGradient.join(',');
    const targetGradient = useMemo(
        () => rawGradient,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [gradientKey],
    );
    // Pale skies (snow, sunny days, sunrise and sunset, hot, fog, haze) need
    // darker tiles and haloed text to stay readable; see lib/weather/skyContrast.
    const lightSky = useMemo(() => isLightSky(targetGradient), [targetGradient]);
    const skyText = lightSky ? LIGHT_SKY_TEXT : null;

    // Publish the tab-bar accent off the same memoised gradient. Deliberately
    // *not* driven from the animated gradient above: `tintColor` is a native
    // UITabBarController property, so a per-frame value would mean a bridge
    // round trip and a native re-tint every frame of the 2s sweep. Keying on
    // `targetGradient` instead makes it one discrete update per palette change,
    // which is a snap rather than a crossfade — and the right trade, since the
    // tab bar needs to stay legible more than it needs to animate.
    useEffect(() => {
        setAccent(accentFromGradient(targetGradient));
    }, [targetGradient, setAccent]);

    const prevTargetRef = useRef<readonly string[]>(DEFAULT_GRADIENT);

    const animatedGradientProps = useInterpolatedGradient(
        fromHsl,
        toHsl,
        progress,
    );


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
    // Kept mounted for the length of the fade, then unmounted — the same
    // mount-through-the-fade pattern BackdropLayer uses, and for the same
    // reason its comment gives: a full-screen layer parked at opacity 0 still
    // costs fill rate on every frame. This one is worse than most, since it
    // sits at zIndex 10 above the entire screen.
    const [loaderMounted, setLoaderMounted] = useState(true);

    useEffect(() => {
        if (!loading && weather) {
            RNAnimated.timing(loadingOpacity, {
                toValue: 0,
                duration: 400,
                easing: RNEasing.out(RNEasing.cubic),
                useNativeDriver: true,
            }).start(({ finished }) => {
                // Only unmount on a fade that ran to completion; an interrupted
                // one means loading restarted behind it.
                if (finished) setLoaderMounted(false);
            });
        } else if (loading) {
            loadingOpacity.setValue(1);
            setLoaderMounted(true);
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

    // Spinner rotation for the inline loading indicator.
    //
    // Gated on `loading`, which it previously wasn't: the hook's effect keys on
    // [reduceMotion, durationMs], so a constant duration meant the Animated.loop
    // started at mount and ran for the life of the screen — an invisible icon
    // rotating at display rate long after the overlay had faded out. Passing 0
    // takes the hook's stop-and-reset path.
    const spinRotate = useSpinAnimation(loading ? 2_000 : 0);

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
    const cardScrollRef = useRef<ScrollViewRef>(null);

    // Rotated Duo: the weather and the outfit are separate scroll views, so a pull
    // only moves the one being dragged. The outfit half follows the weather by the
    // same distance, so the whole screen comes down together. Only a transform, so
    // nothing remounts and the outfit keeps its own scrolling and fold clip.
    const weatherPull = useSharedValue(0);
    const weatherPullHandler = useAnimatedScrollHandler({
        onScroll: (e) => {
            weatherPull.value = Math.max(0, -e.contentOffset.y);
        },
    });
    const followWeatherPullStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: weatherPull.value }],
    }));
    useEffect(() => {
        weatherPull.value = 0;
    }, [isStacked, weatherPull]);

    // In two panes the page holds still and the outfit scrolls inside its card;
    // on every other pose the page scrolls and the card's scroll view is switched
    // off. Folding changes which one moves, so neither may keep an offset that
    // the other layout has no room for.
    useEffect(() => {
        scrollY.value = 0;
        scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
        cardScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, [twoPane, scrollRef, scrollY]);

    // The card's edge doesn't show that there's more below it, so the scroll bar
    // appears once when the card is first on screen.
    const cardOnScreen = twoPane && !loading;
    useEffect(() => {
        if (!cardOnScreen) return;
        const timer = setTimeout(
            () => cardScrollRef.current?.flashScrollIndicators(),
            CARD_SCROLL_BAR_FLASH_DELAY_MS,
        );
        return () => clearTimeout(timer);
    }, [cardOnScreen]);

    const handlePullToRefresh = () => {
        isRefreshRef.current = true;
        setRefreshing(true);
        onRefresh?.();
    };

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
        cardScrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
    }, [scrollRef, scrollY]));


    // Bridges scroll position → JS-side visibility flag so the GlassCard pill is
    // conditionally MOUNTED (not just faded). This matters: iOS only samples a
    // UIVisualEffectView's backdrop when it's created while visible — a pill kept
    // mounted at opacity 0 from first paint renders with no blur until a later
    // relayout (leaving/returning the tab). Mounting fresh at opacity 1 when it
    // crosses the threshold, with FadeIn handling the fade, initialises the blur
    // correctly every time.
    const [miniVisible, setMiniVisible] = useState(false);
    const [showShareSheet, setShowShareSheet] = useState(false);

    useAnimatedReaction(
        () => heroBottomY > 0 && scrollY.value > heroBottomY - 40,
        (current, previous) => {
            if (current !== previous) runOnJS(setMiniVisible)(current);
        },
        [heroBottomY],
    );

    // Freeze point for the clear-night twinkle. Deliberately deeper than
    // `miniVisible`: stopping the animation snaps every star to full opacity
    // (progress 0 is the bright end of TWINKLE_RANGE), so a star caught mid-dim
    // jumps from 0.15 to 1.0. Firing that at the hero boundary put the pop where
    // the field was still near full brightness and plainly visible.
    //
    // SCROLL_RANGE is where BackdropLayer's dim bottoms out at MIN_DIM, so by
    // here the field is at its faintest and well behind the content — the same
    // snap lands at roughly half the amplitude, against a sky the eye has
    // already left.
    const [twinkleFrozen, setTwinkleFrozen] = useState(false);

    useAnimatedReaction(
        () => scrollY.value >= SCROLL_RANGE,
        (current, previous) => {
            if (current !== previous) runOnJS(setTwinkleFrozen)(current);
        },
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

    // Full-screen star backdrop for clear nights; storm backdrop for thunder;
    // light-rain backdrop for plain rain; drizzle backdrop for drizzle. All
    // derive from the shared classifier so they track the icon/gradient.
    // Snow and fog get flat particle layers too (FlakeFall, FogDrift); sleet
    // is a rain variant with ice pellets.
    // lib/weather/backdropLayers is the single decision — the story-loop
    // renderer runs it too, so shared stories match what's on screen.
    const layers = weather ? backdropLayersFor(bgCondition, bgIsDay) : NO_LAYERS;
    const isClearNightBg = layers.stars;
    const isStormBg = layers.rain === 'storm';
    const isRainBg = layers.rain === 'light';
    const isDrizzleBg = layers.rain === 'drizzle';
    const isSnowBg = layers.flakes === 'snow';
    const isSleetBg = layers.rain === 'sleet';
    const isFogBg = layers.fog;
    const isGlareBg = layers.glare;
    // What the weather does to the outfit card's glass: beads in rain, frost
    // at or below freezing, shimmer from 90°F. Always the °F reading, whatever
    // units the screen shows. See lib/weather/weatherGlass.
    const airTempF = weather ? devTempF(weather.Temperature.Imperial.Value) : null;
    const glassEffect = useMemo(
        () => (perf.weatherGlass ? glassEffectFor(layers.rain, airTempF) : null),
        [perf.weatherGlass, layers.rain, airTempF],
    );
    // Rain sits behind the card's content, frost and heat over it (see below).
    const rainBehind = glassEffect?.kind === 'rain' ? glassEffect : null;
    const onTheGlass = glassEffect?.kind === 'rain' ? null : glassEffect;
    const splashing = !!rainBehind && edgeSplashes(bgCondition);
    // Glare and fog drift lighten the sky behind the header more than falling
    // snow or rain does, so the fade allows for more of it under them.
    const skyFade = useMemo(
        () =>
            lightSky
                ? lightSkyFade(
                      targetGradient,
                      isGlareBg || isFogBg ? HAZY_BACKDROP_LIFT : PARTICLE_BACKDROP_LIFT,
                      isStacked ? STACKED_HOME_TEXT_BAND : undefined,
                  )
                : null,
        [lightSky, targetGradient, isGlareBg, isFogBg, isStacked],
    );

    // ── Backdrop animation gate ──────────────────────────────────────────────
    //
    // NativeTabs is a UITabBarController: switching tabs detaches this view but
    // keeps the component MOUNTED (that's why the focus effect above has to
    // reset scroll by hand). Without this gate the sky kept animating on every
    // other tab, inside the camera modal, and behind every pushed route — the
    // whole backdrop's per-frame cost was being paid on screens that can't see
    // a single pixel of it.
    //
    // That cost is not the fill rate this file usually worries about; it's main
    // thread CPU in RCTNativeAnimatedNodesManager. Its CADisplayLink runs in
    // NSRunLoopCommonModes, and `updateAnimations` walks EVERY animated node
    // each frame, then pushes each dirty props node through
    // `synchronouslyUpdateViewOnUIThread` — one folly::dynamic conversion and
    // one full `cloneProps` per animated view, per frame. The clear-night field
    // is 32 independently-animated stars, so that is 32 prop clones a frame,
    // forever, on whatever screen the user is actually looking at. When the
    // main thread spikes for any other reason the display link overruns its
    // interval, re-fires immediately, and starves the run loop — which is what
    // an "App Hang Non Fully Blocked" report with stepAnimations: on the stack
    // actually is.
    //
    // Focus is the correct axis: backgrounding already pauses CADisplayLink,
    // but leaving the tab did not.
    const isFocused = useIsFocused();
    const backdropAnimate = perf.twinkle && isFocused;

    // Shared by both star-field parallax layers below, so the near and far
    // bands freeze on scroll together rather than drifting out of sync.
    const starsAnimate =
        backdropAnimate && !(perf.freezeTwinkleOnScroll && twinkleFrozen);

    // Precipitation slant from the reported wind. Gust is preferred when present
    // — it's what makes a squall look like a squall rather than steady drizzle.
    // Both fields are optional (older cached snapshots predate them), and
    // rainAngleFor falls back to the previous fixed rightward drift.
    const rainAngle = useMemo(
        () =>
            rainAngleFor(
                weather?.Wind.Gust?.Imperial.Value ??
                    weather?.Wind.Speed.Imperial.Value,
                weather?.Wind.Direction,
            ),
        [
            weather?.Wind.Gust?.Imperial.Value,
            weather?.Wind.Speed.Imperial.Value,
            weather?.Wind.Direction,
        ],
    );

    // Opaque weather-matched fill for the details card (dev flag only, for now).
    // The palette's footer colours stop at 0.97 alpha — visually solid, but the
    // compositor still treats them as translucent and so still draws the
    // animating sky underneath. Forcing alpha to 1 is what lets that region be
    // skipped entirely.
    const opaqueCardBg = useMemo(() => {
        if (!weather) return undefined;
        const c = footerBgFor(weather.WeatherText, weather.IsDayTime);
        const m = /^rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)$/.exec(c.trim());
        return m ? `rgb(${m[1].trim()},${m[2].trim()},${m[3].trim()})` : c;
    }, [weather?.WeatherText, weather?.IsDayTime]);

    // ── Error state (#9: retry + check settings) ──────────────────────────────
    // With no location at all (GPS denied, no default city), retrying alone
    // can't help: offer a city, or the system settings to allow location.
    if (error && !weather && !location)
        return (
            <View style={st.center}>
                <Text style={st.errorText}>{error}</Text>
                {onOpenLocations && (
                    <Pressable
                        style={st.retryBtn}
                        onPress={onOpenLocations}
                        accessibilityRole='button'
                        accessibilityLabel='Add a city'
                    >
                        <Text style={st.retryBtnText}>Add a city</Text>
                    </Pressable>
                )}
                <Pressable
                    onPress={() => { Linking.openSettings().catch(() => {}); }}
                    accessibilityRole='button'
                    accessibilityLabel='Open Settings'
                >
                    <Text style={st.settingsLink}>Open Settings</Text>
                </Pressable>
                <Pressable
                    onPress={() => onRefresh?.()}
                    accessibilityRole='button'
                    accessibilityLabel='Try again'
                >
                    <Text style={st.settingsLink}>Try again</Text>
                </Pressable>
            </View>
        );

    if (error && !weather)
        return (
            <View style={st.center}>
                <Text style={st.errorText}>
                    {error ?? 'Something went wrong.'}
                </Text>
                <Pressable
                    style={st.retryBtn}
                    onPress={() => onRefresh?.()}
                    accessibilityRole='button'
                    accessibilityLabel='Try again'
                >
                    <Text style={st.retryBtnText}>Try again</Text>
                </Pressable>
                <Pressable
                    onPress={() => nav.push('/account')}
                    accessibilityRole='button'
                    accessibilityLabel='Check settings'
                >
                    <Text style={st.settingsLink}>Check settings</Text>
                </Pressable>
            </View>
        );

    // Below the outfit in one column, at the foot of the weather pane in two.
    const shareAndAttribution = (
        <>
                        {forecasts.length > 0 && (
                            <Pressable
                                style={[st.shareForecastBtn, lightSky && st.shareForecastBtnLight]}
                                onPress={() => setShowShareSheet(true)}
                                accessibilityRole='button'
                                accessibilityLabel='Share forecast to Instagram'
                            >
                                <View style={st.shareForecastBtnRow}>
                                    <CameraIcon size={15} color={lightSky ? colors.textPrimary : colors.textSecondary} decorative />
                                    <Text style={[st.shareForecastBtnText, lightSky && st.shareForecastBtnTextLight]}>
                                        Share forecast
                                    </Text>
                                </View>
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
                                <Text style={[st.lastUpdated, skyText]}>
                                    {' '}
                                    Weather data provided by Apple Weather
                                </Text>
                            </Pressable>
                        </View>
        </>
    );

    // A const so it can sit in either place. Stacked, it lives outside the scroll
    // view so the outfit can clip at the fold; otherwise it sits inside it. Only
    // this pane moves, so a rotation doesn't remount OutfitSuggestion and lose the
    // selected outfit.
    const weatherPane = weather ? (
        <Animated.ScrollView
            // Stacked: only large text outgrows the half, and it scrolls in
            // place instead of running across the fold.
            scrollEnabled={refreshFromWeather}
            style={stacked ? st.weatherHalfScroll : undefined}
            onScroll={stacked ? weatherPullHandler : undefined}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={twoPane ? { paddingBottom: tabPad } : undefined}
            // Swapping this on a fold can only remount this pane, never the outfit.
            refreshControl={
                refreshFromWeather ? (
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handlePullToRefresh}
                        tintColor={colors.textPrimary as string}
                    />
                ) : undefined
            }
        >
        {/* Header — only city/condition/lastUpdated live in the
            scroll surface now. The Locations/Gear buttons + a
            scroll-driven mini summary moved to the sticky bar
            below. */}
        {stacked ? (
            // The city sits in the row with Location and Settings (the sticky
            // bar below), then one big temperature.
            <View
                style={[st.stackedHero, { paddingTop: topInset + STACKED_NAV_ROW_TOP }]}
                onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    setHeroBottomY(y + height);
                }}
            >
                <View style={st.stackedCityRow}>
                    <Text
                        style={[st.stackedCity, skyText]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                    >
                        {place?.name}
                    </Text>
                </View>
                <View style={st.stackedStatus}>
                    <Text style={[st.stackedStatusText, skyText]} numberOfLines={1}>
                        {humanizeCondition(weather.WeatherText)}
                        {lastUpdated ? ' · ' : ''}
                    </Text>
                    {lastUpdated && (
                        <LastUpdated
                            date={lastUpdated}
                            style={[st.stackedStatusText, skyText]}
                        />
                    )}
                </View>
                <View style={st.stackedTempRow}>
                    <WeatherIconDisplay
                        condition={weather.WeatherText}
                        isDay={weather.IsDayTime}
                        size='medium'
                        latitude={place?.lat}
                    />
                    {/* Already display-sized. Growing with Dynamic Type only pushes
                        the hours out of the half. */}
                    <Text style={[st.stackedTemp, skyText]} maxFontSizeMultiplier={1}>
                        {tempVal}°
                    </Text>
                </View>
                <Text style={[st.stackedFeels, skyText]} numberOfLines={1}>
                    Feels like {feelsVal}°
                    {hiTemp !== null && loTemp !== null
                        ? ` · H:${hiTemp}° L:${loTemp}°`
                        : ''}
                </Text>
            </View>
        ) : twoPane ? (
            // Weather pane: the place reads first, then the icon
            // beside the temperature, centred over the hours and
            // stats, so they fit the pane instead of sitting under
            // a tall hero.
            // On the Duo the buttons live in the side column, so
            // the place starts 40 pt down, level with the outfit
            // pane's first row; otherwise 64 clears the sticky buttons.
            <View
                style={[st.paneHero, { paddingTop: paneHeroTop }]}
                onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    setHeroBottomY(y + height);
                }}
            >
                <Text
                    style={[st.city, skyText]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.6}
                >
                    {place?.name}
                </Text>
                <Text style={[st.condition, skyText]} numberOfLines={1}>
                    {humanizeCondition(weather.WeatherText)}
                </Text>
                {lastUpdated && (
                    <LastUpdated
                        date={lastUpdated}
                        style={[st.lastUpdated, skyText]}
                    />
                )}
                <View style={st.paneTempRow}>
                    <WeatherIconDisplay
                        condition={weather.WeatherText}
                        isDay={weather.IsDayTime}
                        size='medium'
                        latitude={place?.lat}
                    />
                    <Text style={[st.paneTemp, skyText]}>{tempVal}°</Text>
                </View>
                <Text style={[st.coverFeels, st.paneFeels, skyText]}>
                    Feels like {feelsVal}°
                    {hiTemp !== null && loTemp !== null
                        ? ` · H:${hiTemp}° L:${loTemp}°`
                        : ''}
                </Text>
            </View>
        ) : fold.mode === 'compact-short' ? (
            // The Duo cover is short, so the place and the
            // temperature share one row and the outfit starts
            // higher up. With the buttons in the side column
            // (Duo) 40 pt keeps it off the edge; otherwise 60
            // clears the sticky buttons.
            <View
                style={[st.coverHero, { paddingTop: (sideRail ? 40 : 60) + topInset }]}
                onLayout={(e) => {
                    const { y, height } = e.nativeEvent.layout;
                    setHeroBottomY(y + height);
                }}
            >
                <View style={st.coverHeroPlace}>
                    <Text
                        style={[st.city, skyText]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
                    >
                        {place?.name}
                    </Text>
                    <Text style={[st.condition, skyText]} numberOfLines={1}>
                        {humanizeCondition(weather.WeatherText)}
                    </Text>
                    {lastUpdated && (
                        <LastUpdated
                            date={lastUpdated}
                            style={[st.lastUpdated, skyText]}
                        />
                    )}
                </View>
                <View style={st.coverHeroTemps}>
                    <View style={st.coverTempRow}>
                        <WeatherIconDisplay
                            condition={weather.WeatherText}
                            isDay={weather.IsDayTime}
                            animate
                            latitude={place?.lat}
                        />
                        <Text style={[st.coverTemp, skyText]}>{tempVal}°</Text>
                    </View>
                    <Text style={[st.coverFeels, skyText]}>Feels like: {feelsVal}°</Text>
                    {hiTemp !== null && loTemp !== null && (
                        <Text style={[st.coverHiLo, skyText]}>
                            H:{hiTemp}° L:{loTemp}°
                        </Text>
                    )}
                </View>
            </View>
        ) : (
            <>
            <View
                style={[
                    st.header,
                    { paddingTop: spacing.lg + topInset },
                ]}
            >
                <Text style={[st.city, skyText]}>{place?.name}</Text>
                <Text style={[st.condition, skyText]}>
                    {humanizeCondition(weather.WeatherText)}
                </Text>
                {lastUpdated && (
                    <LastUpdated
                        date={lastUpdated}
                        style={[st.lastUpdated, skyText]}
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
                    onLightSky={lightSky}
                    temperature={tempVal}
                    feelsLike={feelsVal}
                    latitude={place?.lat}
                />
                {hiTemp !== null && loTemp !== null && (
                    <Text style={[st.hiLo, skyText]}>
                        H:{hiTemp}° L:{loTemp}°
                    </Text>
                )}
            </View>
            </>
        )}

        {/* Hourly forecast strip — interleaves sunrise/sunset tiles.
            Each tile is an individual GlassCard so it picks up
            colorScheme="dark" from ForceDarkPalette on MainPage,
            keeping tiles consistent between light and dark mode.
            (GlassGroup/GlassContainer has no colorScheme prop and
            always follows UIWindow, which breaks consistency.)

            These were briefly consolidated into one card spanning
            the strip, on the theory that surface COUNT was the
            cost. Measured worse on an iPhone 16: the ScrollView
            clips offscreen tiles so only ~5 ever blur anything,
            and the gaps between them aren't blurred either, so
            one contiguous full-width surface covers more animated
            sky than the tiles it replaced. */}
        {stripItems.length > 0 && (
            <View>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[st.forecastStrip, stacked && st.forecastStripStacked]}
                >
                    {stripItems.map((item) =>
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
                                // Derived from the clock, not
                                // from position: index 0 is only
                                // "now" while the data is fresh,
                                // and mislabelling a past hour
                                // "Now" is what hid the staleness.
                                isNow={
                                    hourBucketOf(
                                        item.data.DateTime,
                                    ) === hourBucket
                                }
                                disableGlass={!perf.glass}
                                onLightSky={lightSky}
                            />
                        ) : (
                            <SunEventTile
                                key={`s-${item.sun.kind}-${item.time}`}
                                time={item.time}
                                temperature={item.temp}
                                tempUnit={isMetric ? 'C' : 'F'}
                                disableGlass={!perf.glass}
                                onLightSky={lightSky}
                            />
                        ),
                    )}
                </ScrollView>
            </View>
        )}

        {stacked && (
            <WeatherStatsLine weather={weather} settings={settings} textStyle={skyText} />
        )}

        {twoPane && (
            <GlassCard
                style={st.details}
                disableGlass={!perf.outfitCardGlass}
                glassTint={lightSky ? LIGHT_SKY_CARD_TINT : undefined}
            >
                <ThemeOverride
                    colors={lightSky ? LIGHT_SKY_CARD_TEXT : undefined}
                    innerGlassTint={lightSky ? LIGHT_SKY_INNER_TINT : undefined}
                >
                    <WeatherStats weather={weather} settings={settings} showAll />
                </ThemeOverride>
            </GlassCard>
        )}
        {twoPane && shareAndAttribution}
        </Animated.ScrollView>
    ) : null;

    return (
        <AnimatedLinearGradient
            colors={
                DEFAULT_GRADIENT as unknown as [string, string, ...string[]]
            }
            animatedProps={animatedGradientProps}
            style={st.root}
        >
            {/* Sun glare on clear and sunny days. The sun is the farthest
                thing in the sky, so it barely tracks the scroll. */}
            <BackdropLayer
                visible={isGlareBg && perf.backdrop}
                scrollY={scrollY}
                depth={0.1}
                parallax={perf.parallax}
            >
                <SunGlare animate={backdropAnimate} />
            </BackdropLayer>

            {/* Full-screen star field — two absolute layers behind all content,
                split by depth rather than doubled in star count (see
                `starLayer` on ClearNightIconMoon). BackdropLayer cross-fades
                instead of mounting/unmounting, so a condition change no
                longer costs a commit + re-rasterization on the frame the
                weather updates.

                `depth` sets the parallax rate. The far layer (most of the
                field, small and dim) sits close to infinity and barely
                drifts; the near layer (fewer, bigger, brighter stars) tracks
                the scroll more — that gap in travel is what reads as the sky
                having depth instead of being one flat sheet. Storm rain is
                right in front of you and tracks harder still. */}
            <BackdropLayer
                visible={isClearNightBg && perf.backdrop}
                scrollY={scrollY}
                depth={0.15}
                parallax={perf.parallax}
            >
                {/* Option H — the twinkle stops once scrolled past
                    SCROLL_RANGE. Six looping opacity drivers on near-coprime
                    durations mean this sky never settles, so anything blurring
                    it re-samples forever; by that offset it's dimmed to MIN_DIM
                    and nobody is looking at the stars. See `twinkleFrozen` above
                    for why the threshold is that deep rather than the hero
                    boundary.

                    Clear night ONLY. The rain, drizzle and storm backdrops
                    below keep animating unconditionally — they aren't what
                    stutters, and their motion is the entire point of them. */}
                <ClearNightIconMoon
                    fullWidth
                    fullHeight
                    showMoon={false}
                    starLayer='far'
                    animate={starsAnimate}
                />
            </BackdropLayer>
            <BackdropLayer
                visible={isClearNightBg && perf.backdrop}
                scrollY={scrollY}
                depth={0.45}
                parallax={perf.parallax}
            >
                <ClearNightIconMoon
                    fullWidth
                    fullHeight
                    showMoon={false}
                    starLayer='near'
                    animate={starsAnimate}
                />
                {/* Rides the near layer's parallax, and stops with the
                    twinkle once scrolled past SCROLL_RANGE. */}
                <ShootingStar animate={starsAnimate} />
            </BackdropLayer>

            {/* Full-screen storm backdrop — falling rain + occasional sheet flash.
                rainAngle now tracks the reported wind, so the slant matches the
                conditions instead of being a fixed 0.12 everywhere. */}
            <BackdropLayer
                visible={isStormBg && perf.backdrop}
                scrollY={scrollY}
                depth={1}
                parallax={perf.parallax}
            >
                <StormIconLightning
                    fullWidth
                    fullHeight
                    showCloud={false}
                    showBolts={false}
                    showRain
                    showFlash
                    rainAngle={rainAngle}
                    animate={backdropAnimate}
                />
            </BackdropLayer>

            {/* Full-screen plain-rain backdrop — lighter rain than the storm,
                no bolts or sheet flash. Mutually exclusive with the storm
                backdrop above and the drizzle one below: isThunderstorm, isRain
                and isDrizzle come from disjoint classifier kinds. */}
            <BackdropLayer
                visible={isRainBg && perf.backdrop}
                scrollY={scrollY}
                depth={1}
                parallax={perf.parallax}
            >
                <StormIconLightning
                    fullWidth
                    fullHeight
                    showCloud={false}
                    showBolts={false}
                    showRain
                    showFlash={false}
                    rainAngle={rainAngle}
                    rainVariant="light"
                    animate={backdropAnimate}
                />
            </BackdropLayer>

            {/* Full-screen drizzle backdrop — same falling-rain mechanism, but
                many short, faint droplets instead of rain streaks. */}
            <BackdropLayer
                visible={isDrizzleBg && perf.backdrop}
                scrollY={scrollY}
                depth={1}
                parallax={perf.parallax}
            >
                <StormIconLightning
                    fullWidth
                    fullHeight
                    showCloud={false}
                    showBolts={false}
                    showRain
                    showFlash={false}
                    rainAngle={rainAngle}
                    rainVariant="drizzle"
                    animate={backdropAnimate}
                />
            </BackdropLayer>

            {/* Full-screen snowfall — small dots far back, six-arm flakes in
                front, both swaying as they fall. Slower parallax than rain:
                snow hangs in the air rather than rushing past. */}
            <BackdropLayer
                visible={isSnowBg && perf.backdrop}
                scrollY={scrollY}
                depth={0.6}
                parallax={perf.parallax}
            >
                <FlakeFall groups={SNOW_GROUPS} animate={backdropAnimate} />
            </BackdropLayer>

            {/* Full-screen sleet — short quick streaks with round ice pellets
                among them (both part of the 'sleet' rain variant), taking the
                wind slant. */}
            <BackdropLayer
                visible={isSleetBg && perf.backdrop}
                scrollY={scrollY}
                depth={1}
                parallax={perf.parallax}
            >
                <StormIconLightning
                    fullWidth
                    fullHeight
                    showCloud={false}
                    showBolts={false}
                    showRain
                    showFlash={false}
                    rainAngle={rainAngle}
                    rainVariant="sleet"
                    animate={backdropAnimate}
                />
            </BackdropLayer>

            {/* Full-screen fog — soft banks drifting sideways. Shallow depth:
                fog sits far off, so it barely tracks the scroll. */}
            <BackdropLayer
                visible={isFogBg && perf.backdrop}
                scrollY={scrollY}
                depth={0.3}
                parallax={perf.parallax}
            >
                <FogDrift animate={backdropAnimate} />
            </BackdropLayer>

            {/* Light skies only: a fade behind the header, sized to the sky
                and in its own hue, over the sky and its particles, under the
                content. See lightSkyFade in lib/weather/skyContrast. */}
            {skyFade && (
                <LinearGradient
                    pointerEvents='none'
                    colors={skyFade.colors}
                    locations={skyFade.locations}
                    style={StyleSheet.absoluteFill}
                />
            )}

            {/* Transparent loading spinner — sits over the animating gradient.
                Suppressed when a parent owns the loading gate (showInlineLoader). */}
            {showInlineLoader && loaderMounted && (
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
                    {stacked && <View style={{ height: stacked.weatherHeight }}>{weatherPane}</View>}
                    <Animated.ScrollView
                        ref={scrollRef}
                        style={
                            stacked
                                ? [{ marginTop: stacked.outfitTop - stacked.weatherHeight }, followWeatherPullStyle]
                                : undefined
                        }
                        contentContainerStyle={[
                            st.scroll,
                            { paddingBottom: tabPad, paddingRight: twoPane ? 0 : rightInset },
                            twoPane && st.scrollRow,
                            stacked && st.scrollStacked,
                        ]}
                        scrollEnabled={!twoPane}
                        showsVerticalScrollIndicator={false}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                        // Empty on the rotated Duo, not undefined: ScrollView puts a
                        // control ahead of its content, so removing it would shift
                        // the content and remount the outfit, losing the selection.
                        refreshControl={
                            isStacked ? <></> : (
                                <RefreshControl
                                    refreshing={refreshing && !twoPane}
                                    enabled={!twoPane}
                                    onRefresh={handlePullToRefresh}
                                    tintColor={colors.textPrimary as string}
                                />
                            )
                        }
                    >
                        {!stacked && (
                            <View style={weatherPaneStyle}>
                                {weatherPane}
                            </View>
                        )}

                        <View style={outfitPaneStyle}>
                        {/* Details + outfit.
                            NOT a glass surface, deliberately. This is the
                            tallest element on the screen, so as glass it blurred
                            more animated sky than everything else combined — and
                            its children (the Stat cards, the outfit's article
                            and layer cards, the GlassGroups) are themselves
                            glass, so each one was re-blurring a surface that had
                            already blurred the sky. Dropping the outer material
                            removes the largest blur region AND collapses that
                            stacking; the children still read as glass because
                            they now sample the sky directly.

                            The style already carries the translucent bg + border
                            that `disableGlass` renders, so the container looks
                            the same — at this size the material was almost
                            entirely hidden behind its own children anyway. */}
                        <GlassCard
                            style={[
                                st.details,
                                twoPane && st.detailsCapped,
                                // Last in the array on purpose: GlassCard's
                                // fallback applies `style` after its own
                                // background, so overriding here (rather than
                                // via tintColor) is what actually wins.
                                //
                                // Only reaches the screen on the FALLBACK path.
                                // With outfitCardGlass on, GlassCard strips
                                // backgroundColor before handing the style to
                                // GlassView, so on iOS 26 this is inert and the
                                // material shows through as normal; on Android
                                // and pre-26 it paints the card solid.
                                perf.opaqueOutfitCard && opaqueCardBg
                                    ? { backgroundColor: opaqueCardBg }
                                    : null,
                            ]}
                            disableGlass={!perf.outfitCardGlass}
                            // Light skies: the card's glass darkens, the glass
                            // inside it a little less, and its grey text lifts to
                            // near-white, so every line on it clears 4.5:1. See
                            // LIGHT_SKY_CARD_TINT.
                            glassTint={lightSky ? LIGHT_SKY_CARD_TINT : undefined}
                        >
                            {/* Rain beads and running drops, behind everything
                                on the card: under the text and buttons, and
                                seen blurred through the outfit's glass tiles.
                                (Under the card itself, its glass blurred them
                                away entirely.) First child, so it's beneath. */}
                            <WeatherGlassOverlay effect={rainBehind} animate={backdropAnimate} />
                            {/* Mounted on every pose and only scrolls in two
                                panes. Adding it just for two panes would remount
                                OutfitSuggestion on a fold and lose the selected
                                outfit. */}
                            <ScrollView
                                ref={cardScrollRef}
                                scrollEnabled={twoPane}
                                style={twoPane ? { maxHeight: outfitCardMaxHeight } : st.detailsScrollOff}
                                contentContainerStyle={twoPane ? st.detailsCappedContent : undefined}
                                alwaysBounceVertical={false}
                                showsVerticalScrollIndicator={twoPane}
                                scrollIndicatorInsets={CARD_SCROLL_BAR_INSETS}
                            >
                                <ThemeOverride
                                    colors={lightSky ? LIGHT_SKY_CARD_TEXT : undefined}
                                    innerGlassTint={lightSky ? LIGHT_SKY_INNER_TINT : undefined}
                                >
                                    <WeatherDetails
                                        weather={weather}
                                        settings={settings}
                                        forecasts={forecasts}
                                        daily={daily}
                                        city={place?.name}
                                        coords={place ?? undefined}
                                        showStats={!twoPane && !stacked}
                                    />
                                </ThemeOverride>
                            </ScrollView>
                            {/* Frost and heat on the glass, over the content.
                                Follows the sky's own animation gate. */}
                            <WeatherGlassOverlay effect={onTheGlass} animate={backdropAnimate} />
                        </GlassCard>
                        {/* Rain hitting the card's top edge, in front of the
                            glass, for steady rain and storms only (not drizzle
                            or light rain). Outside the card, which clips, so
                            splashes can rise above it; lined up with the card's
                            top and its side margins. */}
                        {rainBehind && splashing && (
                            <RainEdgeSplash
                                density={rainBehind.density}
                                animate={backdropAnimate && !reduceMotion}
                                style={{
                                    top: (twoPane ? outfitCardTop : 0) - SPLASH_RISE,
                                    left: (twoPane && fold.panes ? fold.gutter / 2 : 0) + spacing.md,
                                    right: spacing.md,
                                }}
                            />
                        )}
                        </View>

                        {!twoPane && shareAndAttribution}
                    </Animated.ScrollView>

                    {/* Sticky top bar — pinned buttons + scroll-driven mini
                        summary. Sits as a sibling of (and above) the scroll
                        view. pointerEvents="box-none" lets pulls/scrolls fall
                        through everywhere except the button hit areas.
                        On the Duo Location and Settings are native
                        nav-bar items declared in MainPage, so only the mini
                        summary renders here, centred between placeholders. */}
                    <View
                        style={[
                            st.stickyBar,
                            { top: topInset + (stacked ? STACKED_NAV_ROW_TOP : 8) },
                            {
                                right: twoPane && fold.panes
                                    ? fold.panes.secondary.width + fold.gutter / 2
                                    : rightInset,
                            },
                        ]}
                        pointerEvents='box-none'
                    >
                        {onOpenLocations && !sideRail ? (
                            <GlassCard
                                glassStyle='clear'
                                style={st.locationsBtn}
                                // Light skies: the buttons take the tiles' scrim,
                                // or their white glyphs drop under 3:1.
                                tintColor={lightSky ? LIGHT_SKY_SCRIM : undefined}
                                disableGlass={!perf.glass}
                            >
                                <Pressable
                                    onPress={onOpenLocations}
                                    accessibilityLabel='Switch location'
                                    accessibilityRole='button'
                                    style={({ pressed }) => [
                                        st.locationsBtnInner,
                                        stacked && st.barBtnInnerStacked,
                                        { opacity: pressed ? 0.6 : 1 },
                                    ]}
                                >
                                    <LocationsIcon decorative />
                                </Pressable>
                            </GlassCard>
                        ) : (
                            <View style={st.locationsBtnPlaceholder} />
                        )}
                        {miniVisible && !twoPane && !stacked && (
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
                                        disableGlass={!perf.glass}
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
                        {sideRail ? (
                            <View style={st.locationsBtnPlaceholder} />
                        ) : (
                            <GlassCard
                                glassStyle='clear'
                                style={st.gearBtn}
                                tintColor={lightSky ? LIGHT_SKY_SCRIM : undefined}
                                disableGlass={!perf.glass}
                            >
                                <Pressable
                                    onPress={() => nav.push('/account')}
                                    accessibilityLabel='Account settings'
                                    accessibilityRole='button'
                                    style={({ pressed }) => [
                                        st.gearBtnInner,
                                        stacked && st.barBtnInnerStacked,
                                        { opacity: pressed ? 0.6 : 1 },
                                    ]}
                                >
                                    <GearIcon decorative />
                                </Pressable>
                            </GlassCard>
                        )}
                    </View>

                    {/* Dev-only bisection switches. Inside the content layer so
                        it sits above the backdrops and the glass surfaces it
                        toggles; renders null in a release build. Disabled for
                        App Store screenshot capture — re-enable by restoring
                        this render call. */}
                    {/* <PerfPanel /> */}

                    <ShareToInstagramSheet
                        visible={showShareSheet}
                        onClose={() => setShowShareSheet(false)}
                        renderCard={(cardRef) => (
                            <WeatherForecastShareCard
                                ref={cardRef}
                                place={place?.name ?? 'My Location'}
                                weather={weather}
                                hourly={forecasts}
                                isMetric={isMetric}
                            />
                        )}
                        renderSticker={(stickerRef) => (
                            <WeatherForecastShareCard
                                ref={stickerRef}
                                variant='sticker'
                                place={place?.name ?? 'My Location'}
                                weather={weather}
                                hourly={forecasts}
                                isMetric={isMetric}
                            />
                        )}
                        attributionURL={weatherShareLink()}
                        backgroundTopColor='#0C4A6E'
                        backgroundBottomColor='#0F172A'
                        look={weather ? lookFor({ condition: bgCondition, isDayTime: bgIsDay, sun }) : undefined}
                    />
                </View>
            )}
        </AnimatedLinearGradient>
    );
};

export default WeatherHUD;
