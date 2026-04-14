import { useState, useCallback } from 'react';
import { Settings } from '../types';

const STORAGE_KEY = 'ojo_settings';

const defaults: Settings = {
  clothingStyle: 'Casual',
  location: '',
  temperatureScale: 'Imperial',
  hiTempThreshold: 85,
  lowTempThreshold: 50,
  humidityPreference: 70,
};

const load = (): Settings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
};

export const useSettings = () => {
  const [settings, setSettings] = useState<Settings>(load);

  const saveSettings = useCallback((next: Settings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSettings(next);
  }, []);

  return { settings, saveSettings };
};
