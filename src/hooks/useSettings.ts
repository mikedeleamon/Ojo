import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Settings } from '../types';
import { getToken, authHeaders, getErrorMessage } from '../lib/auth';

const CACHE_KEY   = 'ojo_settings_cache';
const SESSION_KEY = 'ojo_settings_session'; // legacy key — cleared on logout

export const defaults: Settings = {
  clothingStyle:      'Casual',
  location:           '',
  temperatureScale:   'Imperial',
  hiTempThreshold:    85,
  lowTempThreshold:   50,
  humidityPreference: 70,
};

const readCache = (): Settings | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : null;
  } catch { return null; }
};

const writeCache = (s: Settings) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch {}
};

export const clearSettingsSession = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  } catch {}
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(() => readCache() ?? defaults);
  const [settingsReady, setSettingsReady] = useState<boolean>(() => readCache() !== null);

  useEffect(() => {
    const token = getToken();
    if (!token) { setSettingsReady(true); return; }

    axios
      .get('/api/user/settings', authHeaders())
      .then(({ data }) => {
        const fresh = { ...defaults, ...data };
        setSettings(fresh);
        writeCache(fresh);
        setSettingsReady(true);
      })
      .catch((err: unknown) => {
        console.warn('[Ojo] Could not revalidate settings:', getErrorMessage(err));
        setSettingsReady(true);
      });
  }, []);

  const saveSettings = useCallback(async (next: Settings) => {
    const previous = settings;
    setSettings(next);
    writeCache(next);

    if (!getToken()) return;

    try {
      await axios.put('/api/user/settings', next, authHeaders());
    } catch (err: unknown) {
      console.error('[Ojo] Settings save failed — rolling back:', getErrorMessage(err));
      setSettings(previous);
      writeCache(previous);
      throw err;
    }
  }, [settings]);

  return { settings, settingsReady, saveSettings };
};
