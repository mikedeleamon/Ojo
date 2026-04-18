import { useState, useEffect } from 'react';
import api from '../../api/client';
import weatherConstants from '../../constants/weatherConstants';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import WeatherDetails from '../WeatherDetails/WeatherDetails';
import MinimizedWeatherDisplay from '../MinimizedWeatherDisplay/MinimizedWeatherDisplay';
import Loading from '../Loading/Loading';
import mockWeatherData from '../../mockData/mockWeatherData';
import { detectOversizedCookies } from '../../helpers/cookieUtils';
import { CityData, CurrentWeather, Forecast, Settings } from '../../types';
import styles from './WeatherHUD.module.css';

// ─── Toggle mock data — only reads the explicit env var, not NODE_ENV ───────
const USE_MOCK = process.env.REACT_APP_USE_MOCK === 'true';

const BG_MAP: Record<string, string> = {
    sunny: 'var(--bg-sunny)',
    'mostly sunny': 'var(--bg-sunny)',
    clear: 'var(--bg-clear-day)',
    cloud: 'var(--bg-cloudy)',
    partly: 'var(--bg-partly-cloudy)',
    rain: 'var(--bg-rainy)',
    shower: 'var(--bg-rainy)',
    thunder: 'var(--bg-stormy)',
    storm: 'var(--bg-stormy)',
    snow: 'var(--bg-snow)',
    flurr: 'var(--bg-snow)',
};

const bgForCondition = (condition: string, isDay: boolean): string => {
    const c = condition.toLowerCase();
    if (!isDay && (c.includes('clear') || c.includes('mostly clear')))
        return 'var(--bg-clear-night)';
    for (const [key, val] of Object.entries(BG_MAP)) {
        if (c.includes(key)) return val;
    }
    return isDay ? 'var(--bg-clear-day)' : 'var(--bg-clear-night)';
};

interface Props {
    location: string;
    settings: Settings;
}

const WeatherHUD = ({ location, settings }: Props) => {
    const [city, setCity] = useState<CityData | null>(null);
    const [weather, setWeather] = useState<CurrentWeather | null>(null);
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // ── Mock data path (no API key / CORS needed) ──────────────────────────
        if (USE_MOCK) {
            setWeather(mockWeatherData.currentWeather[0] as CurrentWeather);
            setForecasts(mockWeatherData.forecast as Forecast[]);
            setCity({ Key: 'mock', LocalizedName: 'New York' });
            setIsLoading(false);
            return;
        }
        // ── No location yet — wait for geolocation to resolve ─────────────────
        // If location is genuinely empty (geo denied + no default set), surface
        // an actionable error instead of spinning forever.
        if (!location) {
            setError('Location unavailable. Set a default city in Settings → Preferences.');
            setIsLoading(false);
            return;
        }

        // Detect oversized cookies which commonly cause 431 responses when
        // forwarded through the dev proxy. If we detect problematic cookies,
        // surface a helpful error instead of attempting the request.
        const cookieProblem = detectOversizedCookies();
        if (cookieProblem) {
            console.error('[Ojo] Oversized cookies detected:', cookieProblem);
            setError(
                'Browser cookies are too large and may be causing server errors (431).\nPlease clear cookies for localhost or set REACT_APP_SERVER_BASE to call the server directly.',
            );
            setIsLoading(false);
            return;
        }

        const fetchCity = async () => {
            try {
                // Call the server proxy; the server appends the AccuWeather API key.
                const { data } = await api.get(weatherConstants.GET_CITY, {
                    params: { q: location },
                });
                if (data?.Key) {
                    setCity(data);
                } else {
                    setError('Location not found. Check your coordinates.');
                    setIsLoading(false);
                }
            } catch (err) {
                console.error('[Ojo] City lookup failed:', err);
                setError(
                    'Could not resolve your location. Is the server running on port 4000?',
                );
                setIsLoading(false);
            }
        };

        fetchCity();
    }, [location]);

    useEffect(() => {
        if (!city?.Key || city.Key === 'mock') return;

        const fetchWeather = async () => {
            try {
                const [weatherRes, forecastRes] = await Promise.all([
                    api.get(
                        `${weatherConstants.GET_CURRENT_WEATHER}/${city.Key}`,
                        { params: { details: true } },
                    ),
                    api.get(
                        `${weatherConstants.GET_CURRENT_FORECAST}/${city.Key}`,
                    ),
                ]);
                const w = weatherRes.data?.[0];
                if (!w) throw new Error('Empty weather response');
                setWeather(w);
                setForecasts(forecastRes.data ?? []);
            } catch (err) {
                console.error('[Ojo] Weather fetch failed:', err);
                setError(
                    'Could not load weather data. Is the server running on port 4000?',
                );
            } finally {
                setIsLoading(false);
            }
        };

        fetchWeather();
    }, [city]);

    if (isLoading) return <Loading />;
    if (error || !weather)
        return (
            <div className={styles.error}>
                <span>{error ?? 'Something went wrong. Please refresh.'}</span>
                {process.env.NODE_ENV === 'development' && (
                    <span className={styles.errorHint}>
                        Tip: set <code>REACT_APP_USE_MOCK=true</code> in{' '}
                        <code>.env</code> to use mock data.
                    </span>
                )}
            </div>
        );

    const bg = bgForCondition(weather.WeatherText, weather.IsDayTime);

    return (
        <div
            className={styles.root}
            style={{ background: bg }}
        >
            {/* Header */}
            <div className={styles.header}>
                <h1 className={styles.city}>{city?.LocalizedName}</h1>
                <p className={styles.condition}>{weather.WeatherText}</p>
            </div>

            {/* Hero icon */}
            <div className={styles.hero}>
                <WeatherIconDisplay
                    condition={weather.WeatherText}
                    isDay={weather.IsDayTime}
                    size='large'
                    temperature={
                        settings.temperatureScale === 'Metric'
                            ? weather.Temperature.Metric.Value
                            : weather.Temperature.Imperial.Value
                    }
                    feelsLike={
                        settings.temperatureScale === 'Metric'
                            ? weather.RealFeelTemperature.Metric.Value
                            : weather.RealFeelTemperature.Imperial.Value
                    }
                />
            </div>

            {/* Hourly forecast strip */}
            {forecasts.length > 0 && (
                <div className={styles.forecastStrip}>
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
                </div>
            )}

            {/* Details + outfit */}
            <div className={styles.details}>
                <WeatherDetails
                    weather={weather}
                    settings={settings}
                />
            </div>
        </div>
    );
};

export default WeatherHUD;
