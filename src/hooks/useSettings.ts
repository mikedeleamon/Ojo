import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Settings } from '../types';

const CACHE_KEY   = 'ojo_settings_cache';   // localStorage — survives refresh
const SESSION_KEY = 'ojo_settings_session'; // kept for legacy clearance only
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

const readCache = (): Settings | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
};

const writeCache = (s: Settings) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch {}
};

export const clearSettingsSession = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(SESSION_KEY); // clear legacy key too
  } catch {}
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useSettings = () => {
  // Seed from localStorage immediately so the UI never blocks on a network call
  const [settings, setSettings] = useState<Settings>(() => readCache() ?? defaults);
  const [settingsReady, setSettingsReady] = useState<boolean>(() => readCache() !== null);

  useEffect(() => {
    const token = getToken();

    // Not logged in — defaults are already set, nothing to fetch
    if (!token) {
      setSettingsReady(true);
      return;
    }

    // Revalidate from MongoDB in the background so settings stay fresh.
    // The UI is already unblocked via the localStorage seed above.
    axios
      .get('/api/user/settings', authHeaders(token))
      .then(({ data }) => {
        const fresh = { ...defaults, ...data };
        setSettings(fresh);
        writeCache(fresh);
        setSettingsReady(true);
      })
      .catch((err) => {
        console.warn('[Ojo] Could not revalidate settings:', err.message);
        // Cache already applied — just mark ready so the UI can proceed
        setSettingsReady(true);
      });
  }, []);

  // Optimistic save: update UI instantly, sync to MongoDB, roll back on failure.
  const saveSettings = useCallback(async (next: Settings) => {
    const previous = settings;
    setSettings(next);
    writeCache(next);

    const token = getToken();
    if (!token) return;

    try {
      await axios.put('/api/user/settings', next, authHeaders(token));
    } catch (err: any) {
      console.error('[Ojo] Settings save failed — rolling back:', err.message);
      setSettings(previous);
      writeCache(previous);
      throw err;
    }
  }, [settings]);

  return { settings, settingsReady, saveSettings };
};
