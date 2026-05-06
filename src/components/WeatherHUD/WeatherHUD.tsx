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

const GearIcon = () => (
    <Svg
        width={22}
        height={22}
        viewBox='0 0 24 24'
        fill='none'
        stroke='rgba(255,255,255,0.85)'
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
    >
        <Circle
            cx={12}
            cy={12}
            r={3}
        />
        <Path d='M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' />
    </Svg>
);

// ─── Gradient + footer colour maps ────────────────────────────────────────────

const gradientFor = (condition: string, isDay: boolean): string[] => {
    const c = condition.toLowerCase();
    if (!isDay && (c.includes('clear') || c.includes('mostly clear')))
        return weatherGradients.clearNight;
    if (c.includes('sunny') || c.includes('mostly sunny'))
        return weatherGradients.clearDay;
    if (c.includes('clear'))
        return isDay ? weatherGradients.clearDay : weatherGradients.clearNight;
    if (c.includes('partly') || c.includes('intermittent'))
        return weatherGradients.partlyCloudy;
    if (c.includes('cloud') || c.includes('overcast'))
        return weatherGradients.cloudy;
    if (c.includes('rain') || c.includes('shower'))
        return weatherGradients.rainy;
    if (c.includes('thunder') || c.includes('storm'))
        return weatherGradients.stormy;
    if (c.includes('snow') || c.includes('flurr')) return weatherGradients.snow;
    return isDay ? weatherGradients.clearDay : weatherGradients.clearNight;
};

const footerBgFor = (condition: string, isDay: boolean): string => {
    const c = condition.toLowerCase();
    if (!isDay && (c.includes('clear') || c.includes('mostly clear')))
        return 'rgba(12,20,40,0.97)';
    if (c.includes('sunny') || c.includes('mostly sunny'))
        //for *HOT* sunny days, use a warmer footer color to match the gradient
        //return 'rgba(180,83,9,0.97)';
        return 'rgba(2,78,142,0.97)';
    if (c.includes('clear'))
        return isDay ? 'rgba(2,78,142,0.97)' : 'rgba(12,20,40,0.97)';
    if (c.includes('partly')) return 'rgba(22,34,54,0.97)';
    if (c.includes('cloud')) return 'rgba(16,24,39,0.97)';
    if (c.includes('rain')) return 'rgba(6,18,36,0.97)';
    if (c.includes('thunder') || c.includes('storm'))
        return 'rgba(10,8,28,0.97)';
    if (c.includes('snow')) return 'rgba(50,90,130,0.97)';
    return isDay ? 'rgba(2,78,142,0.97)' : 'rgba(10,16,32,0.97)';
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
            pendingRef.current = null;
        }
    };

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
            .catch(() => {
                setError('Could not resolve location. Please try again later.');
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
                }
            })
            .catch(() =>
                setError('Could not load weather.  Please try again later.'),
            )
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
            duration: isFirstPaint ? 2600 : 1500,
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

    // Fade out loading spinner shortly before gradient settles, so the user's
    // attention shifts to the colors mid-transition rather than at the very end.
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

            {weather && !loading && (
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
                        <Text style={st.condition}>{weather.WeatherText}</Text>
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
            )}
        </LinearGradient>
    );
};

export default WeatherHUD;

const st = StyleSheet.create({
    root: { flex: 1 },
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
