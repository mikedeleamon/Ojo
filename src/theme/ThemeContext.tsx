import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ColorTokens } from './tokens';

interface ThemeContextValue {
  colors: ColorTokens;
  isDark: boolean;
  /** Tint for glass surfaces nested in a tinted card; see ThemeOverride. */
  innerGlassTint?: string;
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

/**
 * Re-theme a subtree on top of the palette it sits in: swap some colour tokens
 * and/or tint the glass surfaces inside it (components read `innerGlassTint`
 * from useTheme). Home's outfit card uses this on light skies.
 *
 * Always renders the Provider, so turning the overrides on and off never
 * remounts the subtree, and keeps `colors` the same object while nothing
 * changes, so memoised styles below don't rebuild. Pass module-level
 * constants, not inline objects.
 */
export const ThemeOverride = ({
  colors: overrides,
  innerGlassTint,
  children,
}: {
  colors?: Partial<ColorTokens>;
  innerGlassTint?: string;
  children: React.ReactNode;
}) => {
  const parent = useContext(ThemeContext);
  const colors = useMemo(
    () => (overrides ? { ...parent.colors, ...overrides } : parent.colors),
    [parent.colors, overrides],
  );
  const tint = innerGlassTint ?? parent.innerGlassTint;
  const value = useMemo(
    () => ({ colors, isDark: parent.isDark, innerGlassTint: tint }),
    [colors, parent.isDark, tint],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
