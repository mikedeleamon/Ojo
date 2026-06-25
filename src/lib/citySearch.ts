/**
 * citySearch.ts
 * ─────────────
 * City autocomplete backed by the Open-Meteo geocoding API. It's free, needs
 * no API key, and only ever returns populated places (cities/towns/admin
 * areas) — which is exactly what we want for the "Add a city" flow: the user
 * can only pick a real city, never free-text garbage.
 *
 * Each result already carries lat/lon, so call sites don't need a separate
 * geocode round-trip after the user makes a selection.
 */

export interface CitySuggestion {
  id:    string;
  name:  string;   // "London"
  label: string;   // "London, England, United Kingdom"
  lat:   number;
  lon:   number;
}

interface OpenMeteoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
}

/**
 * Search cities matching `query`. Returns at most 8 suggestions, or an empty
 * array for short/blank queries or on any network error (callers treat an
 * empty list the same as "no matches"). Pass an AbortSignal to cancel an
 * in-flight request when the user keeps typing.
 */
export async function searchCities(
  query: string,
  signal?: AbortSignal,
): Promise<CitySuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url =
    'https://geocoding-api.open-meteo.com/v1/search' +
    `?name=${encodeURIComponent(q)}&count=8&language=en&format=json`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const results: OpenMeteoResult[] = Array.isArray(data?.results) ? data.results : [];
    return results.map((r) => ({
      id:    String(r.id),
      name:  r.name,
      label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
      lat:   r.latitude,
      lon:   r.longitude,
    }));
  } catch {
    // Includes AbortError when a newer keystroke supersedes this request.
    return [];
  }
}
