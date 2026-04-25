import { useState, useCallback, useEffect } from 'react';
import axios from '../api/client';
import { Settings } from '../types';
import { getToken, authHeaders, getErrorMessage } from '../lib/auth';
import { storage, storageGetJSON } from '../lib/storage';

const CACHE_KEY = 'ojo_settings_cache';

export const defaults: Settings = {
  clothingStyle:      'Casual',
  location:           '',
  temperatureScale:   'Imperial',
  hiTempThreshold:    85,
  lowTempThreshold:   50,
  humidityPreference: 70,
};

const readCache = async (): Promise<Settings | null> => {
  const data = await storageGetJSON<Partial<Settings>>(storage, CACHE_KEY, {});
  return Object.keys(data).length > 0 ? { ...defaults, ...data } : null;
};

const writeCache = async (s: Settings): Promise<void> => {
  await storage.setItem(CACHE_KEY, JSON.stringify(s));
};

export const clearSettingsCache = async (): Promise<void> => {
  await storage.removeItem(CACHE_KEY);
};

export const useSettings = () => {
  const [settings,      setSettings]      = useState<Settings>(defaults);
  const [settingsReady, setSettingsReady] = useState(false);

  // Hydrate from cache first, then revalidate from server
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const cached = await readCache();
      if (cached && !cancelled) {
        setSettings(cached);
        setSettingsReady(true);
      }

      const token = getToken();
      if (!token) { if (!cancelled) setSettingsReady(true); return; }

      try {
        const { data } = await axios.get('/api/user/settings', authHeaders());
        const fresh = { ...defaults, ...data };
        if (!cancelled) {
          setSettings(fresh);
          setSettingsReady(true);
        }
        await writeCache(fresh);
      } catch (err: unknown) {
        console.warn('[Ojo] Could not revalidate settings:', getErrorMessage(err));
        if (!cancelled) setSettingsReady(true);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  const saveSettings = useCallback(async (next: Settings) => {
    const previous = settings;
    setSettings(next);
    await writeCache(next);

    if (!getToken()) return;

    try {
      await axios.put('/api/user/settings', next, authHeaders());
    } catch (err: unknown) {
      console.error('[Ojo] Settings save failed — rolling back:', getErrorMessage(err));
      setSettings(previous);
      await writeCache(previous);
      throw err;
    }
  }, [settings]);

  const refreshSettings = useCallback(async () => {
    const cached = await readCache();
    if (cached) setSettings(cached);

    const token = getToken();
    if (!token) return;

    try {
      const { data } = await axios.get('/api/user/settings', authHeaders());
      const fresh = { ...defaults, ...data };
      setSettings(fresh);
      await writeCache(fresh);
    } catch (err: unknown) {
      console.warn('[Ojo] Could not refresh settings:', getErrorMessage(err));
    }
  }, []);

  return { settings, settingsReady, saveSettings, refreshSettings };
};
