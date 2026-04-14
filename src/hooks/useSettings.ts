import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Settings } from '../types';

const STORAGE_KEY = 'ojo_settings';
const AUTH_KEY    = 'ojo_auth';

export const defaults: Settings = {
  clothingStyle:      'Casual',
  location:           '',
  temperatureScale:   'Imperial',
  hiTempThreshold:    85,
  lowTempThreshold:   50,
  humidityPreference: 70,
};

const loadLocal = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
};

const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw).token : null;
  } catch {
    return null;
  }
};

const authHeaders = (token: string) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(loadLocal);

  // On mount: if a token exists, fetch the user's latest settings from MongoDB
  useEffect(() => {
    const token = getToken();
    if (!token) return;

    axios
      .get('/api/user/settings', authHeaders(token))
      .then(({ data }) => {
        const merged = { ...defaults, ...data };
        setSettings(merged);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      })
      .catch((err) => {
        console.warn('[Ojo] Could not load settings from server, using local copy:', err.message);
      });
  }, []);

  const saveSettings = useCallback(async (next: Settings) => {
    // Always persist locally first so the UI is never blocked
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSettings(next);

    const token = getToken();
    if (!token) return;

    try {
      await axios.put('/api/user/settings', next, authHeaders(token));
    } catch (err: any) {
      console.warn('[Ojo] Could not save settings to server, kept in localStorage:', err.message);
    }
  }, []);

  return { settings, saveSettings };
};
