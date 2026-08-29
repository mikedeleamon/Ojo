import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
    ScrollView,
    RefreshControl,
    Pressable,
    Linking,
    AppState,
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
import weatherConstants from '../../constants/weatherConstants';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import ClearNightIconMoon from '../WeatherIcons/ClearNightIconMoon';
import StormIconLightning from '../WeatherIcons/StormIconLightning';
import SunnyIcon from '../WeatherIcons/SunnyIcon';
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
import { blendHsl, flattenHsl, hslToHex, lerpHslFlat } from './colorMath';

// LinearGradient driven by a UI-thread worklet via useAnimatedProps. The
// gradient's colors prop is updated directly on the native view each frame,
// bypassing the JS thread (and React reconciliation) entirely.
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);
import { gradientFor, footerBgFor } from './weatherPalette';
import { accentFromGradient } from '../../lib/weather/accentColor';
import { isClearNight, isDrizzle, isRain, isThunderstorm } from '../../lib/weather/conditions';
import { solarPosition, type SolarPosition } from '../../lib/solarPosition';
import { rainAngleFor } from '../../lib/weather/windSlant';
import BackdropLayer, { SCROLL_RANGE } from './BackdropLayer';
import PerfPanel from '../debug/PerfPanel';
import { usePerfFlags } from '../../lib/debug/perfFlags';
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
        const params = { params: { lat: place.lat, lon: place.lon } };
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
    const rawGradient = weather
        ? gradientFor(
              weather.WeatherText,
              weather.IsDayTime,
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
    const isClearNightBg = !!weather && isClearNight(weather.WeatherText, weather.IsDayTime);
    const isStormBg = !!weather && isThunderstorm(weather.WeatherText);
    const isRainBg = !!weather && isRain(weather.WeatherText);
    const isDrizzleBg = !!weather && isDrizzle(weather.WeatherText);

    // Shared by both star-field parallax layers below, so the near and far
    // bands freeze on scroll together rather than drifting out of sync.
    const starsAnimate =
        perf.twinkle && !(perf.freezeTwinkleOnScroll && twinkleFrozen);

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
                    animate={perf.twinkle}
                />
            </BackdropLayer>

            {/* Full-screen plain-rain backdrop — gentler, much slower falling
                rain, no bolts or sheet flash. Mutually exclusive with the storm
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
                    animate={perf.twinkle}
                />
            </BackdropLayer>

            {/* Full-screen drizzle backdrop — same falling-rain mechanism, but
                short, faint, quick-falling droplets instead of the long slow
                streaks used for plain rain. */}
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
                    animate={perf.twinkle}
                />
            </BackdropLayer>

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
                                    contentContainerStyle={st.forecastStrip}
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
                                            />
                                        ) : (
                                            <SunEventTile
                                                key={`s-${item.sun.kind}-${item.time}`}
                                                time={item.time}
                                                temperature={item.temp}
                                                tempUnit={isMetric ? 'C' : 'F'}
                                                disableGlass={!perf.glass}
                                            />
                                        ),
                                    )}
                                </ScrollView>
                            </View>
                        )}

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
                        >
                            <WeatherDetails
                                weather={weather}
                                settings={settings}
                                forecasts={forecasts}
                                daily={daily}
                                city={place?.name}
                                coords={place ?? undefined}
                            />
                        </GlassCard>

                        {forecasts.length > 0 && (
                            <Pressable
                                style={st.shareForecastBtn}
                                onPress={() => setShowShareSheet(true)}
                                accessibilityRole='button'
                                accessibilityLabel='Share forecast to Instagram'
                            >
                                <View style={st.shareForecastBtnRow}>
                                    <CameraIcon size={15} color={colors.textSecondary} />
                                    <Text style={st.shareForecastBtnText}>
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
                                disableGlass={!perf.glass}
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
                        <GlassCard
                            glassStyle='clear'
                            style={st.gearBtn}
                            disableGlass={!perf.glass}
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
