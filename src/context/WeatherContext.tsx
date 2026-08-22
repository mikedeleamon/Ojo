import { createContext, useContext, useMemo, useState } from 'react';
import { darkColors } from '../theme/tokens';
import { FALLBACK_ACCENT } from '../lib/weather/accentColor';

interface WeatherTheme {
  footerBg:    string;
  setFooterBg: (color: string) => void;
  /**
   * Accent derived from the live background gradient — see
   * lib/weather/accentColor. Consumed by the native tab bar tint so the chrome
   * tracks the sky. Published by WeatherHUD alongside `footerBg`, and only when
   * the gradient itself changes, so it inherits that cadence rather than adding
   * a second one.
   */
  accent:      string;
  setAccent:   (color: string) => void;
}

const WeatherContext = createContext<WeatherTheme>({
  footerBg:    darkColors.bgDefault,
  setFooterBg: () => {},
  accent:      FALLBACK_ACCENT,
  setAccent:   () => {},
});

export const WeatherProvider = ({ children }: { children: React.ReactNode }) => {
  const [footerBg, setFooterBg] = useState<string>(darkColors.bgDefault);
  const [accent, setAccent]     = useState<string>(FALLBACK_ACCENT);
  // Memoised so consumers that only read `accent` aren't re-rendered by an
  // unrelated `footerBg` write creating a fresh context value.
  const value = useMemo(
    () => ({ footerBg, setFooterBg, accent, setAccent }),
    [footerBg, accent],
  );
  return (
    <WeatherContext.Provider value={value}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeatherTheme = () => useContext(WeatherContext);
