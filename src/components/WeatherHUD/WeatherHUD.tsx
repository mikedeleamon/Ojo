import { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
    ScrollView,
    RefreshControl,
    Pressable,
    Animated as RNAnimated,
    Easing as RNEasing,
    Image,
} from 'react-native';
import { useSpinAnimation } from '../../hooks/useSpinAnimation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Path } from 'react-native-svg';
import { View, Text } from '../primitives';
import GearIcon from '../icons/GearIcon';
import api from '../../api/client';
import weatherConstants from '../../constants/weatherConstants';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import Loading from '../Loading/Loading';
import WeatherDetails from '../WeatherDetails/WeatherDetails';
import MinimizedWeatherDisplay from '../MinimizedWeatherDisplay/MinimizedWeatherDisplay';
import { useWeatherTheme } from '../../context/WeatherContext';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { CityData, CurrentWeather, Forecast, Settings } from '../../types';
import {
    colors,
    fonts,
    fontSizes,
    weatherGradients,
    spacing,
} from '../../theme/tokens';

// ─── Color interpolation utilities ───────────────────────────────────────────

/** Parse hex (#RRGGBB or #RGB) to [r, g, b] (0–255). */
const hexToRgb = (hex: string): [number, number, number] => {
    const h = hex.replace('#', '');
    if (h.length === 3) {
        return [
            parseInt(h[0] + h[0], 16),
            parseInt(h[1] + h[1], 16),
            parseInt(h[2] + h[2], 16),
        ];
    }
    return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
    ];
};

/** Convert [r, g, b] back to #RRGGBB. */
const rgbToHex = (r: number, g: number, b: number): string => {
    const toHex = (n: number) =>
        Math.round(Math.max(0, Math.min(255, n)))
            .toString(16)
            .padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Convert RGB (0–255) to HSL (h: 0–360, s/l: 0–1). */
const rgbToHsl = (
    r: number,
    g: number,
    b: number,
): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b),
        min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0,
        s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
                break;
            case g:
                h = ((b - r) / d + 2) * 60;
                break;
            case b:
                h = ((r - g) / d + 4) * 60;
                break;
        }
    }
    return [h, s, l];
};

/** Convert HSL back to RGB (0–255). */
const hslToRgb = (
    h: number,
    s: number,
    l: number,
): [number, number, number] => {
    h = ((h % 360) + 360) % 360;
    if (s === 0) {
        const v = l * 255;
        return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hk = h / 360;
    const hue2rgb = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    };
    return [
        hue2rgb(hk + 1 / 3) * 255,
        hue2rgb(hk) * 255,
        hue2rgb(hk - 1 / 3) * 255,
    ];
};

/**
 * Interpolate two hex colors via HSL space.
 * Stays in vibrant hue space rather than passing through muddy grey midpoints,
 * which is what RGB interpolation does for distant hues.
 */
const lerpColor = (from: string, to: string, t: number): string => {
    const [r1, g1, b1] = hexToRgb(from);
    const [r2, g2, b2] = hexToRgb(to);
    const [h1, s1, l1] = rgbToHsl(r1, g1, b1);
    const [h2, s2, l2] = rgbToHsl(r2, g2, b2);

    // Hue interpolation — take the shortest path around the wheel
    let dh = h2 - h1;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
    const h = h1 + dh * t;

    // If "from" is essentially grey (very low saturation), preserve "to" hue
    // throughout — avoids interpolating through random hues out of greyscale.
    const effectiveH = s1 < 0.05 ? h2 : h;

    const s = s1 + (s2 - s1) * t;
    const l = l1 + (l2 - l1) * t;

    const [r, g, b] = hslToRgb(effectiveH, s, l);
    return rgbToHex(r, g, b);
};

/** Smooth easing (ease-in-out) for staggered per-stop progress. */
const easeInOut = (t: number): number =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * Interpolate an array of color stops with per-stop staggering.
 * Each stop's animation is offset by a small delay so the gradient appears to
 * "wave" through colors rather than every pixel moving in lockstep.
 */
const lerpGradient = (from: string[], to: string[], t: number): string[] => {
    const stagger = 0.15; // each stop is delayed by 15% of total duration
    return to.map((_, i) => {
        const offset = (i / Math.max(1, to.length - 1)) * stagger;
        const stopT = Math.max(0, Math.min(1, (t - offset) / (1 - stagger)));
        return lerpColor(from[i] ?? from[0], to[i] ?? to[0], easeInOut(stopT));
    });
};

// ─── Gradient + footer colour maps ────────────────────────────────────────────

const gradientFor = (condition: string, isDay: boolean): string[] => {
    const c = condition.toLowerCase();

    // ── Night clear must be checked first ────────────────────────────────────
    if (!isDay && (c.includes('clear') || c.includes('mostly clear')))
        return weatherGradients.clearNight;

    // ── Atmosphere (fog / haze / mist) ────────────────────────────────────────
    if (c.includes('fog') || c.includes('mist')) return weatherGradients.foggy;
    if (c.includes('haz') || c.includes('smoke')) return weatherGradients.hazy;

    // ── Hot ───────────────────────────────────────────────────────────────────
    if (c.includes('hot')) return weatherGradients.hot;

    // ── Sun / clear ───────────────────────────────────────────────────────────
    if (c.includes('sunny') || c.includes('mostly sunny'))
        return weatherGradients.clearDay;
    if (c.includes('clear'))
        return isDay ? weatherGradients.clearDay : weatherGradients.clearNight;

    // ── Clouds ────────────────────────────────────────────────────────────────
    if (c.includes('partly') || c.includes('intermittent'))
        return weatherGradients.partlyCloudy;
    if (c.includes('cloud') || c.includes('overcast'))
        return weatherGradients.cloudy;

    // ── Winter precip ─────────────────────────────────────────────────────────
    if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard'))
        return weatherGradients.snow;
    if (
        c.includes('sleet') ||
        c.includes('ice') ||
        c.includes('freez') ||
        c.includes('wintry')
    )
        return weatherGradients.ice;

    // ── Rain ──────────────────────────────────────────────────────────────────
    if (c.includes('drizzle') || c.includes('sprinkle'))
        return weatherGradients.drizzle;
    if (c.includes('rain') || c.includes('shower'))
        return weatherGradients.rainy;
    if (c.includes('thunder') || c.includes('storm'))
        return weatherGradients.stormy;

    return isDay ? weatherGradients.clearDay : weatherGradients.clearNight;
};

const footerBgFor = (condition: string, isDay: boolean): string => {
    const c = condition.toLowerCase();

    if (!isDay && (c.includes('clear') || c.includes('mostly clear')))
        return 'rgba(2,6,23,0.97)';

    if (c.includes('fog') || c.includes('mist')) return 'rgba(31,41,55,0.97)';
    if (c.includes('haz') || c.includes('smoke')) return 'rgba(41,32,20,0.97)';
    if (c.includes('hot')) return 'rgba(92,35,8,0.97)';

    if (c.includes('sunny') || c.includes('mostly sunny'))
        return 'rgba(2,78,142,0.97)';
    if (c.includes('clear'))
        return isDay ? 'rgba(2,78,142,0.97)' : 'rgba(2,6,23,0.97)';

    if (c.includes('partly') || c.includes('intermittent'))
        return 'rgba(22,34,54,0.97)';
    if (c.includes('cloud') || c.includes('overcast'))
        return 'rgba(16,24,39,0.97)';

    if (c.includes('snow') || c.includes('flurr') || c.includes('blizzard'))
        return 'rgba(50,90,130,0.97)';
    if (
        c.includes('sleet') ||
        c.includes('ice') ||
        c.includes('freeze') ||
        c.includes('wintry')
    )
        return 'rgba(10,25,45,0.97)';

    if (c.includes('drizzle') || c.includes('sprinkle'))
        return 'rgba(10,26,48,0.97)';
    if (c.includes('rain') || c.includes('shower')) return 'rgba(6,18,36,0.97)';
    if (c.includes('thunder') || c.includes('storm'))
        return 'rgba(10,8,28,0.97)';

    return isDay ? 'rgba(2,78,142,0.97)' : 'rgba(10,16,32,0.97)';
};

const formatLastUpdated = (date: Date): string => {
    const totalMins = Math.floor((Date.now() - date.getTime()) / 60_000);
    
    if (totalMins < 1) return 'Just now';
    if (totalMins < 60) {
        return totalMins === 1 ? '1 min ago' : `${totalMins} mins ago`;
    }
    
    const totalHours = Math.floor(totalMins / 60);
    if (totalHours < 24) {
        return totalHours === 1 ? '1 hour ago' : `${totalHours} hours ago`;
    }
    
    const totalDays = Math.floor(totalHours / 24);
    return totalDays === 1 ? '1 day ago' : `${totalDays} days ago`;
};

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
    location: string;
    settings: Settings;
    refreshKey?: number;
    onRefresh?: () => void;
}

const WeatherHUD = ({ location, settings, refreshKey, onRefresh }: Props) => {
    const { setFooterBg } = useWeatherTheme();
    const { top: topInset } = useSafeAreaInsets();
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
                const w = wRes.data?.[0];
                if (!w) throw new Error('Empty response');
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
    // Each gradient stop transitions through intermediate colors from the current
    // displayed gradient to the target weather gradient. On first load this goes
    // from solid dark (loading bg) to the weather colors. On refresh/reload it
    // transitions from whatever's currently shown to the new weather gradient.
    const DEFAULT_GRADIENT = [
        colors.bgDefault,
        colors.bgDefault,
        colors.bgDefault,
    ];

    const [displayGradient, setDisplayGradient] =
        useState<string[]>(DEFAULT_GRADIENT);
    const fromColorsRef = useRef<string[]>(DEFAULT_GRADIENT);
    const animProgress = useRef(new RNAnimated.Value(1)).current;
    const loadingOpacity = useRef(new RNAnimated.Value(1)).current;
    // Content fades in from 0 after spinner fades out — cross-dissolve handoff
    const contentOpacity = useRef(new RNAnimated.Value(0)).current;

    // Compute target gradient from weather data
    const targetGradient = weather
        ? gradientFor(weather.WeatherText, weather.IsDayTime)
        : DEFAULT_GRADIENT;

    // Trigger color interpolation animation when target gradient changes
    const prevTargetRef = useRef<string>(DEFAULT_GRADIENT.join(','));

    useEffect(() => {
        const targetKey = targetGradient.join(',');
        if (targetKey === prevTargetRef.current) return;

        // Detect "first paint" (solid dark → vibrant weather) — use a longer
        // duration so the user really sees the colors shift through hue space.
        const isFirstPaint =
            prevTargetRef.current === DEFAULT_GRADIENT.join(',');
        prevTargetRef.current = targetKey;

        // Snapshot current display as the "from" state
        fromColorsRef.current = [...displayGradient];
        animProgress.setValue(0);

        const listener = animProgress.addListener(({ value }) => {
            setDisplayGradient(
                lerpGradient(fromColorsRef.current, targetGradient, value),
            );
        });

        RNAnimated.timing(animProgress, {
            toValue: 1,
            duration: isFirstPaint ? 2500 : 2000,
            easing: RNEasing.inOut(RNEasing.cubic),
            useNativeDriver: false,
        }).start(() => {
            animProgress.removeListener(listener);
            // Ensure final state is exactly the target (no floating point drift)
            setDisplayGradient([...targetGradient]);
        });

        return () => {
            animProgress.removeListener(listener);
        };
    }, [targetGradient.join(',')]);

    // Cross-dissolve: spinner fades out while content fades in simultaneously.
    // A slight delay on contentOpacity means the spinner has started leaving
    // before the content arrives, which reads as a clean handoff rather than
    // two things fighting for the same space.
    useEffect(() => {
        if (!loading && weather) {
            RNAnimated.parallel([
                RNAnimated.timing(loadingOpacity, {
                    toValue: 0,
                    duration: 380,
                    easing: RNEasing.out(RNEasing.cubic),
                    useNativeDriver: true,
                }),
                RNAnimated.sequence([
                    RNAnimated.delay(120),
                    RNAnimated.timing(contentOpacity, {
                        toValue: 1,
                        duration: 420,
                        easing: RNEasing.out(RNEasing.cubic),
                        useNativeDriver: true,
                    }),
                ]),
            ]).start();
        } else if (loading) {
            loadingOpacity.setValue(1);
            contentOpacity.setValue(0);
        }
    }, [loading, weather]);

    // Spinner rotation for the inline loading indicator
    const spinRotate = useSpinAnimation(2_000);

    // ── Error state ──────────────────────────────────────────────────────────────
    if (error && !weather)
        return (
            <View style={st.center}>
                <Text style={st.errorText}>
                    {error ?? 'Something went wrong.'}
                </Text>
            </View>
        );

    const tempVal = weather
        ? settings.temperatureScale === 'Metric'
            ? weather.Temperature.Metric.Value
            : weather.Temperature.Imperial.Value
        : 0;
    const feelsVal = weather
        ? settings.temperatureScale === 'Metric'
            ? weather.RealFeelTemperature.Metric.Value
            : weather.RealFeelTemperature.Imperial.Value
        : 0;

    return (
        <LinearGradient
            colors={displayGradient as [string, string, ...string[]]}
            style={st.root}
        >
            {/* Transparent loading spinner — sits over the animating gradient */}
            <RNAnimated.View
                style={[st.loadingOverlay, { opacity: loadingOpacity }]}
                pointerEvents={loading ? 'auto' : 'none'}
            >
                <RNAnimated.Image
                    source={require('../../assets/images/weatherIcons/Sunny.png')}
                    style={[
                        st.loadingIcon,
                        { transform: [{ rotate: spinRotate }] },
                    ]}
                    resizeMode='contain'
                />
            </RNAnimated.View>

            {/* Content fades in via contentOpacity — rendered once weather exists,
                opacity-0 while loading so it's invisible but mounted and ready. */}
            {weather && (
                <RNAnimated.View
                    style={[st.contentLayer, { opacity: contentOpacity }]}
                    pointerEvents={loading ? 'none' : 'auto'}
                >
                    <ScrollView
                        contentContainerStyle={st.scroll}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    isRefreshRef.current = true;
                                    setRefreshing(true);
                                    onRefresh?.();
                                }}
                                tintColor={colors.textPrimary}
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
                            <Pressable
                                style={[st.gearBtn, { top: topInset + 8 }]}
                                onPress={() => nav.push('Account')}
                                accessibilityLabel='Account settings'
                            >
                                <GearIcon />
                            </Pressable>
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
                        </View>

                        {/* Hourly forecast strip */}
                        {forecasts.length > 0 && (
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={st.forecastStrip}
                            >
                                {forecasts.map((f, i) => (
                                    <MinimizedWeatherDisplay
                                        key={i}
                                        weather={f.IconPhrase}
                                        temperature={f.Temperature.Value}
                                        time={f.DateTime}
                                        tempUnit={f.Temperature.Unit}
                                        isDay={f.IsDaylight}
                                    />
                                ))}
                            </ScrollView>
                        )}

                        {/* Details + outfit */}
                        <View style={st.details}>
                            <WeatherDetails
                                weather={weather}
                                settings={settings}
                                forecasts={forecasts}
                            />
                        </View>
                    </ScrollView>
                </RNAnimated.View>
            )}
        </LinearGradient>
    );
};

export default WeatherHUD;

const st = StyleSheet.create({
    root: { flex: 1 },
    contentLayer: { flex: 1 },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingIcon: { width: 80, height: 80 },
    scroll: { flexGrow: 1, paddingBottom: spacing.xl },
    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: spacing.lg,
    },
    errorText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: fontSizes.base * 1.5,
    },
    header: { alignItems: 'center', paddingTop: spacing.lg, gap: 4 },
    gearBtn: { position: 'absolute', right: spacing.md, padding: 6 },
    city: {
        fontFamily: fonts.display,
        fontSize: 36,
        color: colors.textPrimary,
    },
    condition: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: 'rgba(255,255,255,0.75)',
    },
    lastUpdated: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: 'rgba(255,255,255,0.35)',
        marginTop: 2,
    },
    hero: { alignItems: 'center', paddingVertical: spacing.lg },
    forecastStrip: {
        flexDirection: 'row',
        gap: 8,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
    },
    details: {
        marginHorizontal: spacing.md,
        backgroundColor: 'rgba(15,23,42,0.55)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        padding: spacing.md,
        gap: spacing.md,
    },
});
