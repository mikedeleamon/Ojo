import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, ColorTokens } from './tokens';
import { setOverrideUserInterfaceStyle } from '../../modules/ojo-ui-style/src';

export type ThemeMode = 'auto' | 'light' | 'dark';

interface ThemeContextValue {
  colors: ColorTokens;
  mode: ThemeMode;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  mode: 'auto',
  isDark: true,
  setMode: () => {},
});

const STORAGE_KEY = '@ojo_theme_mode';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'auto') setModeState(v);
    });
  }, []);

  // Propagate every mode change to the native UIWindow override so iOS draws
  // alerts, share sheets, glass materials, etc. in our chosen scheme. This is
  // what makes the theme look fully consistent — without it, native surfaces
  // would still follow the system appearance.
  useEffect(() => {
    setOverrideUserInterfaceStyle(mode);
  }, [mode]);

  const setMode = (m: ThemeMode) => {
    setModeState(m);
    AsyncStorage.setItem(STORAGE_KEY, m);
  };

  const isDark = mode === 'auto' ? systemScheme === 'dark' : mode === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, mode, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
