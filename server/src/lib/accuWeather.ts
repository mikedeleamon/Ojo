import axios from 'axios';
import { ttlGet, ttlSet } from './ttlCache';

const accu = axios.create({
  baseURL: process.env.ACCUWEATHER_BASE_URL ?? 'https://dataservice.accuweather.com',
});
const key = () => process.env.ACCUWEATHER_API_KEY!;

const TTL_CITY     = 60 * 60 * 1_000;
const TTL_CURRENT  = 30 * 60 * 1_000;
const TTL_FORECAST = 60 * 60 * 1_000;
const TTL_DAILY    =  3 * 60 * 60 * 1_000; // daily forecast: 3-hour cache

/** Look up an AccuWeather city by free-form query. Cached for 1 hour. */
export async function lookupCity(query: string): Promise<unknown | null> {
  const cacheKey = `city:${query.toLowerCase()}`;
  const cached = ttlGet<unknown>(cacheKey);
  if (cached) return cached;

  const { data } = await accu.get('/locations/v1/cities/search', {
    params: { apikey: key(), q: query },
  });
  const result = data?.[0] ?? null;
  if (result) ttlSet(cacheKey, result, TTL_CITY);
  return result;
}

/** Fetch current conditions for an AccuWeather city key. Cached 30 min. */
export async function getCurrent(
  cityKey: string,
  details: boolean = true,
): Promise<unknown> {
  const cacheKey = `current:${cityKey}`;
  const cached = ttlGet<unknown>(cacheKey);
  if (cached) return cached;

  const { data } = await accu.get(`/currentconditions/v1/${cityKey}`, {
    params: { apikey: key(), details },
  });
  if (data) ttlSet(cacheKey, data, TTL_CURRENT);
  return data;
}

/** Fetch 5-day daily forecast. Cached 3 hours. */
export async function get5DayForecast(cityKey: string): Promise<unknown> {
  const cacheKey = `daily5:${cityKey}`;
  const cached = ttlGet<unknown>(cacheKey);
  if (cached) return cached;

  const { data } = await accu.get(`/forecasts/v1/daily/5day/${cityKey}`, {
    params: { apikey: key(), details: false, metric: false },
  });
  if (data) ttlSet(cacheKey, data, TTL_DAILY);
  return data;
}

/** Fetch 10-day daily forecast. Cached 3 hours. Requires AccuWeather paid plan. */
export async function get10DayForecast(cityKey: string): Promise<unknown> {
  const cacheKey = `daily10:${cityKey}`;
  const cached = ttlGet<unknown>(cacheKey);
  if (cached) return cached;

  const { data } = await accu.get(`/forecasts/v1/daily/10day/${cityKey}`, {
    params: { apikey: key(), details: false, metric: false },
  });
  if (data) ttlSet(cacheKey, data, TTL_DAILY);
  return data;
}

/** Fetch 12-hour hourly forecast. Cached 1 hour. */
export async function getHourlyForecast(cityKey: string): Promise<unknown> {
  const cacheKey = `forecast:${cityKey}`;
  const cached = ttlGet<unknown>(cacheKey);
  if (cached) return cached;

  const { data } = await accu.get(`/forecasts/v1/hourly/12hour/${cityKey}`, {
    params: { apikey: key(), details: true },
  });
  if (data) ttlSet(cacheKey, data, TTL_FORECAST);
  return data;
}
