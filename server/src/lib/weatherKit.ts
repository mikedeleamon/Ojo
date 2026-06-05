/**
 * weatherKit.ts
 * ─────────────
 * Apple WeatherKit REST API client. Replaces the previous AccuWeather client.
 *
 * Prerequisites (Apple Developer Portal — one-time, outside code):
 *   1. Enable the WeatherKit capability on the App ID *and* on a Services ID.
 *   2. Create an AuthKey (p8) that's authorised for WeatherKit. Note the Key ID.
 *   3. Note your Team ID (e.g. ABC123XYZ4) and the Services ID (e.g. com.ojo.weather).
 *   4. Wire these into env vars below; paste the p8 contents into APPLE_WEATHERKIT_PRIVATE_KEY
 *      with literal `\n` newlines so dotenv can parse it on a single line.
 *
 * The server signs a short-lived ES256 JWT per call cycle (cached in memory for
 * ~50 minutes) and Bearer-authorises every WeatherKit request with it.
 *
 * Data is normalised here into Ojo's internal `CurrentWeather`, `Forecast`,
 * `DailyForecast` shapes so the rest of the codebase (outfit engine, HUD,
 * TripFit) stays unchanged. `WeatherText` carries the WeatherKit conditionCode
 * verbatim (e.g. "MostlyClear", "HeavyRain", "PartlyCloudy").
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import { ttlGet, ttlSet } from './ttlCache';

// ─── Config ───────────────────────────────────────────────────────────────────

const WEATHERKIT_BASE = 'https://weatherkit.apple.com/api/v1/weather';
const TOKEN_REFRESH_MS = 50 * 60 * 1_000; // WeatherKit allows up to 60 min — refresh a bit early
const DATA_TTL_MS      = 30 * 60 * 1_000;

const teamId      = () => requireEnv('APPLE_TEAM_ID');
const keyId       = () => requireEnv('APPLE_WEATHERKIT_KEY_ID');
const serviceId   = () => requireEnv('APPLE_WEATHERKIT_SERVICE_ID');
const privateKey  = () => requireEnv('APPLE_WEATHERKIT_PRIVATE_KEY').replace(/\\n/g, '\n');

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[weatherKit] Missing required env var: ${name}`);
  return v;
}

// ─── JWT signing ──────────────────────────────────────────────────────────────

let cachedToken: { token: string; expiresAt: number } | null = null;

function getAuthToken(): string {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token;

  const iatSec = Math.floor(now / 1000);
  const expSec = iatSec + 60 * 60;

  // WeatherKit requires a custom `id` header claim (`<TEAM_ID>.<SERVICE_ID>`)
  // alongside the standard `kid`. jsonwebtoken's `header` option types only
  // allow well-known fields, so we cast to satisfy the compiler while still
  // emitting the right header at runtime.
  const token = jwt.sign(
    { iss: teamId(), sub: serviceId(), iat: iatSec, exp: expSec },
    privateKey(),
    {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: keyId(),
        id: `${teamId()}.${serviceId()}`,
        typ: 'JWT',
      } as jwt.JwtHeader,
    },
  );

  cachedToken = { token, expiresAt: now + TOKEN_REFRESH_MS };
  return token;
}

/** Invalidate the cached JWT — exposed for tests and emergency rotation. */
export function invalidateAuthToken(): void {
  cachedToken = null;
}

// ─── HTTP client ──────────────────────────────────────────────────────────────

const wk = axios.create({ baseURL: WEATHERKIT_BASE, timeout: 8_000 });

type DataSet = 'currentWeather' | 'forecastHourly' | 'forecastDaily';

interface WKCurrent {
  asOf: string;
  conditionCode: string;
  daylight: boolean;
  humidity: number;            // 0..1
  precipitationIntensity: number; // mm/hr
  temperature: number;         // °C
  temperatureApparent: number; // °C
  uvIndex: number;
  windSpeed: number;           // km/h
  visibility: number;
}

interface WKHour {
  forecastStart: string;
  conditionCode: string;
  temperature: number;     // °C
  daylight: boolean;
  precipitationChance: number;
  precipitationType?: string;
}

interface WKDay {
  forecastStart: string;
  forecastEnd: string;
  conditionCode: string;
  temperatureMin: number;  // °C
  temperatureMax: number;  // °C
  precipitationChance: number;
  precipitationType?: string;
  sunrise?: string;
  sunset?: string;
}

interface WKResponse {
  currentWeather?: WKCurrent;
  forecastHourly?: { hours: WKHour[] };
  forecastDaily?:  { days: WKDay[] };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

async function callWeatherKit(
  lat: number,
  lon: number,
  dataSets: DataSet[],
  language = 'en',
): Promise<WKResponse> {
  const cacheKey = `wk:${round3(lat)}:${round3(lon)}:${dataSets.join(',')}`;
  const cached = ttlGet<WKResponse>(cacheKey);
  if (cached) return cached;

  const { data } = await wk.get<WKResponse>(`/${language}/${lat}/${lon}`, {
    params: { dataSets: dataSets.join(',') },
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });

  if (data) ttlSet(cacheKey, data, DATA_TTL_MS);
  return data;
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

const cToF      = (c: number) => Math.round((c * 9) / 5 + 32);
const kmhToMph  = (k: number) => Math.round(k * 0.6213711922);
const mmToInch  = (mm: number) => mm * 0.0393700787;

/** UV index numeric → AccuWeather-compatible text bucket so UV_HIGH_LABELS still works. */
function uvBucket(uv: number): string {
  if (uv >= 11) return 'Extreme';
  if (uv >= 8)  return 'Very High';
  if (uv >= 6)  return 'High';
  if (uv >= 3)  return 'Moderate';
  return 'Low';
}

/** WeatherKit precipitationType is lowercase; Ojo expects PascalCase or null. */
function normPrecipType(t?: string): string | null {
  if (!t || t === 'clear') return null;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ─── Normalised output shapes ─────────────────────────────────────────────────
// These mirror the existing CurrentWeather / Forecast / DailyForecast types in
// src/types.ts so downstream code (outfit engine, HUD, TripFit) is untouched.

export interface NormalisedCurrent {
  WeatherText: string;        // WeatherKit conditionCode
  HasPrecipitation: boolean;
  PrecipitationType: string | null;
  Precip1hr: { Imperial: { Value: number }; Metric: { Value: number } };
  IsDayTime: boolean;
  Temperature: {
    Imperial: { Value: number; Unit: 'F' };
    Metric:   { Value: number; Unit: 'C' };
  };
  RealFeelTemperature: {
    Imperial: { Value: number; Unit: 'F' };
    Metric:   { Value: number; Unit: 'C' };
  };
  Wind: { Speed: { Imperial: { Value: number }; Metric: { Value: number } } };
  RelativeHumidity: number;
  UVIndexText: string;
}

export interface NormalisedHour {
  IconPhrase: string;         // conditionCode
  Temperature: { Value: number; Unit: 'F' };
  DateTime: string;
  IsDaylight: boolean;
}

export interface NormalisedDaily {
  date: string;
  minTempF: number;
  maxTempF: number;
  dayPhrase: string;          // conditionCode
  hasPrecipitation: boolean;
  sunrise?: string;
  sunset?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getCurrent(lat: number, lon: number): Promise<NormalisedCurrent | null> {
  const data = await callWeatherKit(lat, lon, ['currentWeather']);
  const c = data.currentWeather;
  if (!c) return null;

  const precipMm = c.precipitationIntensity ?? 0;
  return {
    WeatherText: c.conditionCode,
    HasPrecipitation: precipMm > 0,
    PrecipitationType: precipMm > 0 ? 'Rain' : null,
    Precip1hr: {
      Imperial: { Value: mmToInch(precipMm) },
      Metric:   { Value: precipMm },
    },
    IsDayTime: c.daylight,
    Temperature: {
      Imperial: { Value: cToF(c.temperature), Unit: 'F' },
      Metric:   { Value: Math.round(c.temperature), Unit: 'C' },
    },
    RealFeelTemperature: {
      Imperial: { Value: cToF(c.temperatureApparent), Unit: 'F' },
      Metric:   { Value: Math.round(c.temperatureApparent), Unit: 'C' },
    },
    Wind: { Speed: {
      Imperial: { Value: kmhToMph(c.windSpeed) },
      Metric:   { Value: Math.round(c.windSpeed) },
    }},
    RelativeHumidity: Math.round((c.humidity ?? 0) * 100),
    UVIndexText: uvBucket(c.uvIndex ?? 0),
  };
}

/** Returns up to `hours` (default 12) of hourly forecast starting now. */
export async function getHourly(lat: number, lon: number, hours = 12): Promise<NormalisedHour[]> {
  const data = await callWeatherKit(lat, lon, ['forecastHourly']);
  const list = data.forecastHourly?.hours ?? [];
  return list.slice(0, hours).map((h) => ({
    IconPhrase: h.conditionCode,
    Temperature: { Value: cToF(h.temperature), Unit: 'F' },
    DateTime: h.forecastStart,
    IsDaylight: h.daylight,
  }));
}

/** Returns up to 10 days. */
export async function getDaily(lat: number, lon: number): Promise<NormalisedDaily[]> {
  const data = await callWeatherKit(lat, lon, ['forecastDaily']);
  const list = data.forecastDaily?.days ?? [];
  return list.map((d) => ({
    date: d.forecastStart.slice(0, 10),
    minTempF: cToF(d.temperatureMin),
    maxTempF: cToF(d.temperatureMax),
    dayPhrase: d.conditionCode,
    hasPrecipitation:
      (d.precipitationChance ?? 0) > 0.3 ||
      (d.precipitationType !== undefined && d.precipitationType !== 'clear'),
    sunrise: d.sunrise,
    sunset:  d.sunset,
  }));
}
