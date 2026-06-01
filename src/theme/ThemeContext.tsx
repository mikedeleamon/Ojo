import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ColorTokens } from './tokens';

interface ThemeContextValue {
  colors: ColorTokens;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: darkColors,
  isDark: true,
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const isDark = systemScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ colors, isDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Force a subtree to render against the dark palette regardless of the system
// scheme. Used by surfaces whose visual identity depends on a dark base
// (e.g. WeatherHUD's animated gradient on MainPage).
export const ForceDarkPalette = ({ children }: { children: React.ReactNode }) => (
  <ThemeContext.Provider value={{ colors: darkColors, isDark: true }}>
    {children}
  </ThemeContext.Provider>
);
