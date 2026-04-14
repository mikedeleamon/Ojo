import styles from './WeatherIconDisplay.module.css';
import Cloudy from '../../assets/images/weatherIcons/Cloudy.png';
import Snow from '../../assets/images/weatherIcons/Snow.png';
import Rainy from '../../assets/images/weatherIcons/Rainy.png';
import Sunny from '../../assets/images/weatherIcons/Sunny.png';
import ClearNight from '../../assets/images/weatherIcons/ClearNight.png';
import Storm from '../../assets/images/weatherIcons/Storm.png';
import PartlyCloudy from '../../assets/images/weatherIcons/PartlyCloudy.png';
import PartlyCloudyNight from '../../assets/images/weatherIcons/PartlyCloudyNight.png';

interface Props {
  condition: string;
  isDay: boolean;
  size?: 'large' | 'small';
  temperature?: number | string;
  feelsLike?: number | string;
}

const iconFor = (condition: string, isDay: boolean): string => {
  const c = condition.toLowerCase();
  if (c.includes('thunder') || c.includes('t-storm')) return Storm;
  if (c.includes('snow') || c.includes('flurr')) return Snow;
  if (c.includes('rain') || c.includes('shower') || c.includes('drizzle')) return Rainy;
  if (c.includes('sunny') || c.includes('mostly sunny')) return Sunny;
  if (c.includes('clear') || c.includes('mostly clear'))
    return isDay ? Sunny : ClearNight;
  if (c.includes('partly') || c.includes('intermittent') || c.includes('hazy'))
    return isDay ? PartlyCloudy : PartlyCloudyNight;
  if (c.includes('cloud') || c.includes('overcast') || c.includes('dreary')) return Cloudy;
  return isDay ? Sunny : ClearNight;
};

const WeatherIconDisplay = ({ condition, isDay, size = 'small', temperature, feelsLike }: Props) => {
  const icon = iconFor(condition, isDay);
  const isLarge = size === 'large';

  return (
    <div className={`${styles.root} ${isLarge ? styles.large : styles.small}`}>
      <img src={icon} alt={condition} className={styles.icon} />
      {isLarge && temperature !== undefined && (
        <div className={styles.temps}>
          <span className={styles.temp}>{temperature}°</span>
          {feelsLike !== undefined && (
            <span className={styles.feelsLike}>feels {feelsLike}°</span>
          )}
        </div>
      )}
      {!isLarge && temperature !== undefined && (
        <span className={styles.miniTemp}>{temperature}°</span>
      )}
    </div>
  );
};

export default WeatherIconDisplay;
