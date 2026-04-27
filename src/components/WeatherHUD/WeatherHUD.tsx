import { useState, useEffect } from 'react';
import {
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Svg, Circle, Path } from 'react-native-svg';
import { View, Text } from '../primitives';
import api from '../../api/client';
import weatherConstants from '../../constants/weatherConstants';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
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
                setError('Could not resolve location. Is the server running?');
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
                setWeather(w);
                setForecasts(fRes.data ?? []);
                setFooterBg(footerBgFor(w.WeatherText, w.IsDayTime));
            })
            .catch(() =>
                setError('Could not load weather. Is the server running?'),
            )
            .finally(() => {
                setLoading(false);
                setRefreshing(false);
            });
    }, [city]);

    if (loading)
        return (
            <View style={st.center}>
                <ActivityIndicator
                    size='large'
                    color={colors.textPrimary}
                />
            </View>
        );

    if (error || !weather)
        return (
            <View style={st.center}>
                <Text style={st.errorText}>
                    {error ?? 'Something went wrong.'}
                </Text>
            </View>
        );

    const gradient = gradientFor(weather.WeatherText, weather.IsDayTime) as [
        string,
        string,
        ...string[],
    ];
    const tempVal =
        settings.temperatureScale === 'Metric'
            ? weather.Temperature.Metric.Value
            : weather.Temperature.Imperial.Value;
    const feelsVal =
        settings.temperatureScale === 'Metric'
            ? weather.RealFeelTemperature.Metric.Value
            : weather.RealFeelTemperature.Imperial.Value;

    return (
        <LinearGradient
            colors={gradient}
            style={st.root}
        >
            <ScrollView
                contentContainerStyle={st.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            onRefresh?.();
                        }}
                        tintColor={colors.textPrimary}
                    />
                }
            >
                {/* Header */}
                <View
                    style={[st.header, { paddingTop: spacing.lg + topInset }]}
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
                    />
                </View>
            </ScrollView>
        </LinearGradient>
    );
};

export default WeatherHUD;

const st = StyleSheet.create({
    root: { flex: 1 },
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
