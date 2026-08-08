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
import mongoose from 'mongoose';
import { ttlGet, ttlSet } from './ttlCache';
import WeatherCache from '../models/WeatherCache';

// ─── Config ───────────────────────────────────────────────────────────────────

const WEATHERKIT_BASE = 'https://weatherkit.apple.com/api/v1/weather';
const TOKEN_REFRESH_MS = 50 * 60 * 1_000; // WeatherKit allows up to 60 min — refresh a bit early
const DATA_TTL_MS      = 30 * 60 * 1_000; // L2 (Mongo) — the real freshness window
const L1_TTL_MS        = 60 * 1_000;      // L1 (in-process) — just absorbs the hot path
const L2_TIMEOUT_MS    = 2_000;           // Cap Mongo latency; on timeout we fall through

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
  visibility: number;          // metres
  // Present in every currentWeather response — `dataSets` selects data sets,
  // not fields, so these were always being paid for and thrown away. They drive
  // the animated sky backdrop (cloud density, rain slant, fog thickness).
  cloudCover?: number;         // 0..1
  windGust?: number;           // km/h
  windDirection?: number;      // degrees, direction wind blows FROM
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

// ─── Shared cache grid ────────────────────────────────────────────────────────
// Requests are snapped to a fixed lat/lon grid so nearby users share one cache
// entry — and therefore one billable WeatherKit call.
//
// At the default precision of 2 a cell is 0.01° ≈ 1.11 km of latitude, so the
// worst-case displacement from snapping is half the cell diagonal ≈ 785 m at the
// equator (less at higher latitudes, where longitude cells narrow by cos φ).
// That is finer than WeatherKit's underlying models, and shifts sunrise/sunset
// by ~4 seconds — below display resolution.
//
// The previous value of 3 (≈110 m) gave users on adjacent blocks separate cache
// entries, which bought no accuracy anyone could perceive.
//
// Coordinates are snapped for the UPSTREAM REQUEST too, not just the key. If we
// keyed by cell but still fetched exact coordinates, the cached payload would be
// whatever the first requester's precise position happened to return —
// non-deterministic across cache generations. Snapping means every user in a
// cell gets byte-identical data.

const DEFAULT_PRECISION = 2;
const MIN_PRECISION = 0;
const MAX_PRECISION = 6;

/** Reads WEATHER_CACHE_PRECISION, falling back to the default on anything
 *  invalid. A typo must never reach WeatherKit as NaN coordinates. */
function readPrecision(): number {
  const raw = process.env.WEATHER_CACHE_PRECISION;
  if (raw === undefined || raw.trim() === '') return DEFAULT_PRECISION;

  const n = Number(raw);
  if (!Number.isInteger(n) || n < MIN_PRECISION || n > MAX_PRECISION) {
    console.warn(
      `[weatherKit] Invalid WEATHER_CACHE_PRECISION="${raw}" ` +
      `(want an integer ${MIN_PRECISION}-${MAX_PRECISION}) — using ${DEFAULT_PRECISION}.`,
    );
    return DEFAULT_PRECISION;
  }
  return n;
}

const CACHE_PRECISION = readPrecision();
const GRID = 10 ** CACHE_PRECISION;

/** Snap a coordinate onto the shared cache grid. */
const snap = (n: number): number => Math.round(n * GRID) / GRID;

// ─── Telemetry ────────────────────────────────────────────────────────────────
// WeatherKit bills per HTTP request, so `upstreamCalls` is the number that costs
// money — everything else is free. Logged periodically from index.ts and exposed
// on /health. Without this there's no way to confirm a change actually reduced
// spend, which is why it exists at all.

let upstreamCalls = 0;
let l1Hits        = 0;
let l2Hits        = 0;
let coalesced     = 0;

export interface WeatherStats {
  /** Billable requests actually sent to Apple. */
  upstreamCalls: number;
  /** Served from the in-process Map. */
  l1Hits: number;
  /** Served from Mongo. A burst right after a deploy is this tier doing its job. */
  l2Hits: number;
  /** Requests that joined an already in-flight fetch instead of starting one. */
  coalesced: number;
}

export const weatherStats = (): WeatherStats =>
  ({ upstreamCalls, l1Hits, l2Hits, coalesced });

/** Zero the counters — called after each periodic log so the numbers are
 *  per-interval rather than cumulative. */
export function resetWeatherStats(): void {
  upstreamCalls = 0;
  l1Hits        = 0;
  l2Hits        = 0;
  coalesced     = 0;
}

// ─── Shared L2 cache (Mongo) ──────────────────────────────────────────────────
// Two rules govern everything here:
//
//   1. FAIL OPEN. Mongo being slow or down must degrade to "cache miss" and fall
//      through to WeatherKit — never throw into the request path. Note the
//      readyState guard: Mongoose buffers commands while disconnected and only
//      rejects after bufferTimeoutMS (10s by default), so without this check a
//      Mongo outage would add ~10s to every weather request instead of failing
//      open instantly.
//
//   2. NEVER TRUST THE TTL INDEX for correctness. Mongo sweeps expired docs on a
//      ~60-second cycle, so a document can outlive its expiresAt. The index
//      reclaims disk; the explicit comparison below is what's correct.

const mongoReady = () => mongoose.connection.readyState === 1;

async function l2Get(key: string): Promise<NormalisedBundle | null> {
  if (!mongoReady()) return null;
  try {
    const doc = await WeatherCache.findById(key).maxTimeMS(L2_TIMEOUT_MS).lean();
    if (!doc) return null;
    if (new Date(doc.expiresAt).getTime() <= Date.now()) return null;
    return doc.payload as NormalisedBundle;
  } catch (err) {
    console.error('[weatherKit] L2 read failed (falling through to upstream):', err);
    return null;
  }
}

async function l2Set(key: string, payload: NormalisedBundle): Promise<void> {
  if (!mongoReady()) return;
  try {
    await WeatherCache.updateOne(
      { _id: key },
      { $set: { payload, expiresAt: new Date(Date.now() + DATA_TTL_MS) } },
      { upsert: true },
    ).maxTimeMS(L2_TIMEOUT_MS);
  } catch (err) {
    // A lost cache entry, not a failed request. Next caller just re-fetches.
    console.error('[weatherKit] L2 write failed (non-fatal):', err);
  }
}

// ─── Upstream fetch ───────────────────────────────────────────────────────────
// One request per location carrying ALL three data sets.
//
// Apple counts one HTTP request as one call regardless of how many dataSets it
// carries (Developer Forums thread 750791), so fetching the three separately —
// as this file used to — cost 3× for identical data.
//
// Bundling alone is NOT enough: WeatherHUD fires /current, /hourly and /daily in
// a Promise.all, so all three miss the cache in the same tick and would each
// start their own upstream fetch. The in-flight map below collapses concurrent
// misses onto a single request; without it this whole change is a no-op on the
// main path.

const BUNDLE: DataSet[] = ['currentWeather', 'forecastHourly', 'forecastDaily'];

/** Concurrent misses for the same key share one promise — covering the L2 read
 *  as well as the upstream fetch, so three parallel callers cost one Mongo read
 *  and at most one WeatherKit call. */
const inFlight = new Map<string, Promise<NormalisedBundle>>();

async function fetchBundle(
  lat: number,
  lon: number,
  language = 'en',
): Promise<NormalisedBundle> {
  const sLat = snap(lat);
  const sLon = snap(lon);

  // Key format is versioned: bump the `v5` whenever the cached SHAPE or the
  // coordinate grid changes, so stale entries can't be read back. This matters
  // far more now that L2 survives deploys — an in-process Map forgave shape
  // drift on restart, Mongo does not. toFixed keeps the string form stable
  // regardless of float printing (and normalises -0).
  const cacheKey =
    `wk:v5:${language}:${sLat.toFixed(CACHE_PRECISION)}:${sLon.toFixed(CACHE_PRECISION)}`;

  const cached = ttlGet<NormalisedBundle>(cacheKey);
  if (cached) {
    l1Hits++;
    return cached;
  }

  const existing = inFlight.get(cacheKey);
  if (existing) {
    coalesced++;
    return existing;
  }

  const pending = (async (): Promise<NormalisedBundle> => {
    try {
      const shared = await l2Get(cacheKey);
      if (shared) {
        l2Hits++;
        ttlSet(cacheKey, shared, L1_TTL_MS);
        return shared;
      }

      upstreamCalls++;
      const { data } = await wk.get<WKResponse>(`/${language}/${sLat}/${sLon}`, {
        params: { dataSets: BUNDLE.join(',') },
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      });

      const bundle = normaliseBundle(data);
      // Failures are deliberately not cached — the next request should retry.
      // An all-empty response is treated the same way, so a transient bad
      // payload can't poison the cache for a full TTL.
      if (hasContent(bundle)) {
        ttlSet(cacheKey, bundle, L1_TTL_MS);
        await l2Set(cacheKey, bundle);
      }
      return bundle;
    } finally {
      // Cleared inside the async body (not via .finally() on the outer promise)
      // so the entry is gone the moment the fetch settles. Chaining .finally()
      // would create a second promise and leave a window where a late caller
      // joins an already-settled entry.
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, pending);
  return pending;
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
  Wind: {
    Speed: { Imperial: { Value: number }; Metric: { Value: number } };
    /** Peak gust. Omitted when WeatherKit doesn't report one. */
    Gust?: { Imperial: { Value: number }; Metric: { Value: number } };
    /** Degrees, direction the wind blows FROM (meteorological convention). */
    Direction?: number;
  };
  RelativeHumidity: number;
  UVIndexText: string;
  /** Sky covered by cloud, 0–100. Omitted when not reported. */
  CloudCover?: number;
  /** Omitted when not reported. */
  Visibility?: { Imperial: { Value: number }; Metric: { Value: number } };
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
  /** Chance of precipitation for the day, 0–100. */
  precipProbability: number;
  sunrise?: string;
  sunset?: string;
}

// ─── Normalisation ────────────────────────────────────────────────────────────
// What gets cached is the NORMALISED bundle, not the raw WeatherKit response.
// Raw forecastHourly carries ~20 fields per hour and we keep 4, so this is a
// large reduction in what L2 has to store and ship over the wire.
//
// The cost of that choice: any change to these shapes MUST bump the key version
// in fetchBundle, or a deploy will read back documents in the old shape.

export interface NormalisedBundle {
  current: NormalisedCurrent | null;
  hourly:  NormalisedHour[];
  daily:   NormalisedDaily[];
}

function normaliseCurrent(c: WKCurrent | undefined): NormalisedCurrent | null {
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
    Wind: {
      Speed: {
        Imperial: { Value: kmhToMph(c.windSpeed) },
        Metric:   { Value: Math.round(c.windSpeed) },
      },
      // Left undefined rather than defaulted to 0 — the client needs to tell
      // "no gust reported" from "dead calm", and 0 would read as the latter.
      ...(typeof c.windGust === 'number' && {
        Gust: {
          Imperial: { Value: kmhToMph(c.windGust) },
          Metric:   { Value: Math.round(c.windGust) },
        },
      }),
      ...(typeof c.windDirection === 'number' && {
        Direction: Math.round(c.windDirection),
      }),
    },
    RelativeHumidity: Math.round((c.humidity ?? 0) * 100),
    UVIndexText: uvBucket(c.uvIndex ?? 0),
    ...(typeof c.cloudCover === 'number' && {
      CloudCover: Math.round(c.cloudCover * 100),
    }),
    ...(typeof c.visibility === 'number' && {
      Visibility: {
        Imperial: { Value: Math.round(c.visibility * 0.000621371 * 10) / 10 },
        Metric:   { Value: Math.round(c.visibility / 100) / 10 },
      },
    }),
  };
}

function normaliseBundle(data: WKResponse): NormalisedBundle {
  return {
    current: normaliseCurrent(data?.currentWeather),
    hourly: (data?.forecastHourly?.hours ?? []).map((h) => ({
      IconPhrase: h.conditionCode,
      Temperature: { Value: cToF(h.temperature), Unit: 'F' as const },
      DateTime: h.forecastStart,
      IsDaylight: h.daylight,
    })),
    daily: (data?.forecastDaily?.days ?? []).map((d) => ({
      date: d.forecastStart.slice(0, 10),
      minTempF: cToF(d.temperatureMin),
      maxTempF: cToF(d.temperatureMax),
      dayPhrase: d.conditionCode,
      hasPrecipitation:
        (d.precipitationChance ?? 0) > 0.3 ||
        (d.precipitationType !== undefined && d.precipitationType !== 'clear'),
      precipProbability: Math.round((d.precipitationChance ?? 0) * 100),
      sunrise: d.sunrise,
      sunset:  d.sunset,
    })),
  };
}

/** True when a bundle carries anything worth caching. */
const hasContent = (b: NormalisedBundle): boolean =>
  b.current !== null || b.hourly.length > 0 || b.daily.length > 0;

// ─── Public API ───────────────────────────────────────────────────────────────
// All three getters are selectors over the same bundle, so a caller that needs
// two of them (e.g. the morning-brief cron) pays for one request. Signatures are
// unchanged, so routes/ and services/ needed no edits.

export async function getCurrent(lat: number, lon: number): Promise<NormalisedCurrent | null> {
  return (await fetchBundle(lat, lon)).current;
}

/** Returns up to `hours` (default 12) of hourly forecast starting now. */
export async function getHourly(lat: number, lon: number, hours = 12): Promise<NormalisedHour[]> {
  return (await fetchBundle(lat, lon)).hourly.slice(0, hours);
}

/** Returns up to 10 days. */
export async function getDaily(lat: number, lon: number): Promise<NormalisedDaily[]> {
  return (await fetchBundle(lat, lon)).daily;
}
