import { createContext, useContext, useState } from 'react';
import { colors } from '../theme/tokens';

interface WeatherTheme {
  footerBg:    string;
  setFooterBg: (color: string) => void;
}

const WeatherContext = createContext<WeatherTheme>({
  footerBg:    colors.bgDefault,
  setFooterBg: () => {},
});

export const WeatherProvider = ({ children }: { children: React.ReactNode }) => {
  const [footerBg, setFooterBg] = useState(colors.bgDefault);
  return (
    <WeatherContext.Provider value={{ footerBg, setFooterBg }}>
      {children}
    </WeatherContext.Provider>
  );
};

export const useWeatherTheme = () => useContext(WeatherContext);
