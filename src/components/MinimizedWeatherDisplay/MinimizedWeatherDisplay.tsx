import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import styles from './MinimizedWeatherDisplay.module.css';

interface Props {
  weather: string;
  temperature: number;
  time: string;
  tempUnit: string;
  isDay: boolean;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { hour: 'numeric', hour12: true });

const MinimizedWeatherDisplay = ({ weather, temperature, time, tempUnit, isDay }: Props) => (
  <div className={styles.card}>
    <span className={styles.time}>{formatTime(time)}</span>
    <WeatherIconDisplay condition={weather} isDay={isDay} size='small' />
    <span className={styles.temp}>{temperature}° {tempUnit}</span>
  </div>
);

export default MinimizedWeatherDisplay;
