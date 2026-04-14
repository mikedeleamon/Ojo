import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Settings } from '../types';

const SESSION_KEY = 'ojo_settings_session';
const AUTH_KEY    = 'ojo_auth';

export const defaults: Settings = {
  clothingStyle:      'Casual',
  location:           '',
  temperatureScale:   'Imperial',
  hiTempThreshold:    85,
  lowTempThreshold:   50,
  humidityPreference: 70,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getToken = (): string | null => {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY) || '{}').token ?? null;
  } catch {
    return null;
  }
};

const authHeaders = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

const readSession = (): Settings | null => {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
};

const writeSession = (s: Settings) => {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
};

export const clearSettingsSession = () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSettings = () => {
  // Start with null — we don't render settings-dependent UI until we know the
  // real values. Consumers can check `settingsReady` to show a loading state.
  const [settings, setSettings] = useState<Settings | null>(null);
  const [settingsReady, setSettingsReady] = useState(false);

  useEffect(() => {
    const token = getToken();

    // Not logged in — use defaults immediately, no server call needed.
    if (!token) {
      setSettings(defaults);
      setSettingsReady(true);
      return;
    }

    // Session cache hit — render immediately without a network round-trip,
    // but still revalidate in the background so settings stay fresh.
    const cached = readSession();
    if (cached) {
      setSettings(cached);
      setSettingsReady(true);
    }

    // Fetch from MongoDB (always, so the session cache never permanently diverges)
    axios
      .get('/api/user/settings', authHeaders(token))
      .then(({ data }) => {
        const fresh = { ...defaults, ...data };
        setSettings(fresh);
        writeSession(fresh);
        setSettingsReady(true);
      })
      .catch((err) => {
        console.warn('[Ojo] Could not load settings from server:', err.message);
        // If we have a cached copy, keep using it. Otherwise fall back to defaults.
        if (!cached) {
          setSettings(defaults);
          setSettingsReady(true);
        }
      });
  }, []);

  // Optimistic save: update UI instantly, sync to MongoDB, roll back on failure.
  const saveSettings = useCallback(async (next: Settings) => {
    const previous = settings;
    setSettings(next);
    writeSession(next);

    const token = getToken();
    if (!token) return;

    try {
      await axios.put('/api/user/settings', next, authHeaders(token));
    } catch (err: any) {
      console.error('[Ojo] Settings save failed — rolling back:', err.message);
      // Roll back UI and session cache to the last known good state.
      if (previous) {
        setSettings(previous);
        writeSession(previous);
      }
      throw err; // re-throw so callers (e.g. AccountPage) can show an error
    }
  }, [settings]);

  return {
    settings: settings ?? defaults,
    settingsReady,
    saveSettings,
  };
};
