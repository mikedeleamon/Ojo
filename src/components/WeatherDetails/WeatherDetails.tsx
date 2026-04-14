import { useState } from 'react';
import { CurrentWeather, Settings } from '../../types';
import OutfitSuggestion from '../OutfitSuggestion/OutfitSuggestion';
import styles from './WeatherDetails.module.css';

interface Props { weather: CurrentWeather; settings: Settings; }

const WeatherDetails = ({ weather, settings }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const isMetric = settings.temperatureScale === 'Metric';

  return (
    <div className={styles.root}>
      <OutfitSuggestion weather={weather} settings={settings} />

      <button className={styles.toggle} onClick={() => setExpanded(v => !v)}>
        <span>{expanded ? 'Less' : 'More details'}</span>
        <svg className={`${styles.chevron} ${expanded ? styles.open : ''}`}
          width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {expanded && (
        <div className={styles.grid}>
          <Stat label="Wind"     value={`${weather.Wind.Speed.Imperial.Value} mph`} />
          <Stat label="Humidity" value={`${weather.RelativeHumidity}%`} />
          <Stat label="UV Index" value={weather.UVIndexText} />
          <Stat label="Feels like" value={`${isMetric
            ? weather.RealFeelTemperature.Metric.Value
            : weather.RealFeelTemperature.Imperial.Value}°`} />
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.stat}>
    <span className={styles.statLabel}>{label}</span>
    <span className={styles.statValue}>{value}</span>
  </div>
);

export default WeatherDetails;
