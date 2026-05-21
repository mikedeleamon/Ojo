import { createContext, useContext, useState } from 'react';
import { darkColors } from '../theme/tokens';

interface WeatherTheme {
  footerBg:    string;
  setFooterBg: (color: string) => void;
}

const WeatherContext = createContext<WeatherTheme>({
  footerBg:    darkColors.bgDefault,
  setFooterBg: () => {},
});

export const WeatherProvider = ({ children }: { children: React.ReactNode }) => {
  const [footerBg, setFooterBg] = useState<string>(darkColors.bgDefault);
  return (
    <WeatherContext.Provider value={{ footerBg, setFooterBg }}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeatherTheme = () => useContext(WeatherContext);
