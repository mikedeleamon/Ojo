import { View, Text, Image } from '../../components/primitives';
import styles from './WeatherIconDisplay.module.css';
import Cloudy            from '../../assets/images/weatherIcons/Cloudy.png';
import Snow              from '../../assets/images/weatherIcons/Snow.png';
import Rainy             from '../../assets/images/weatherIcons/Rainy.png';
import Sunny             from '../../assets/images/weatherIcons/Sunny.png';
import ClearNight        from '../../assets/images/weatherIcons/ClearNight.png';
import Storm             from '../../assets/images/weatherIcons/Storm.png';
import PartlyCloudy      from '../../assets/images/weatherIcons/PartlyCloudy.png';
import PartlyCloudyNight from '../../assets/images/weatherIcons/PartlyCloudyNight.png';

interface Props {
  condition:    string;
  isDay:        boolean;
  size?:        'large' | 'small';
  temperature?: number | string;
  feelsLike?:   number | string;
}

const iconFor = (condition: string, isDay: boolean): string => {
  const c = condition.toLowerCase();
  if (c.includes('thunder') || c.includes('t-storm'))                           return Storm;
  if (c.includes('snow')    || c.includes('flurr'))                             return Snow;
  if (c.includes('rain')    || c.includes('shower') || c.includes('drizzle'))  return Rainy;
  if (c.includes('sunny')   || c.includes('mostly sunny'))                      return Sunny;
  if (c.includes('clear')   || c.includes('mostly clear'))                      return isDay ? Sunny : ClearNight;
  if (c.includes('partly')  || c.includes('intermittent') || c.includes('hazy'))
    return isDay ? PartlyCloudy : PartlyCloudyNight;
  if (c.includes('cloud')   || c.includes('overcast') || c.includes('dreary')) return Cloudy;
  return isDay ? Sunny : ClearNight;
};

const WeatherIconDisplay = ({ condition, isDay, size = 'small', temperature, feelsLike }: Props) => {
  const icon    = iconFor(condition, isDay);
  const isLarge = size === 'large';

  return (
    <View style={`${styles.root} ${isLarge ? styles.large : styles.small}`}>
      <Image
        source={{ uri: icon }}
        style={styles.icon}
        resizeMode="contain"
        accessibilityLabel={condition}
      />
      {isLarge && temperature !== undefined && (
        <View style={styles.temps}>
          <Text style={styles.temp}>{temperature}°</Text>
          {feelsLike !== undefined && (
            <Text style={styles.feelsLike}>feels {feelsLike}°</Text>
          )}
        </View>
      )}
      {!isLarge && temperature !== undefined && (
        <Text style={styles.miniTemp}>{temperature}°</Text>
      )}
    </View>
  );
};

export default WeatherIconDisplay;
