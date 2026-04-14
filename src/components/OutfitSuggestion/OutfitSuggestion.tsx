import { useMemo } from 'react';
import { CurrentWeather, Settings } from '../../types';
import styles from './OutfitSuggestion.module.css';

interface Props { weather: CurrentWeather; settings: Settings; }

const getOutfitAdvice = (weather: CurrentWeather, settings: Settings) => {
  const tempF = weather.Temperature.Imperial.Value;
  const humid = weather.RelativeHumidity;
  const raining = weather.HasPrecipitation;
  const { hiTempThreshold, lowTempThreshold, clothingStyle } = settings;
  const items: string[] = [];

  // Temperature tiers use the user's own thresholds
  if (tempF >= hiTempThreshold) {
    items.push('Light t-shirt or tank top', 'Shorts or linen pants', 'Sunglasses & sunscreen');
  } else if (tempF >= lowTempThreshold) {
    items.push('Breathable shirt', 'Light pants or jeans');
  } else if (tempF >= lowTempThreshold - 15) {
    items.push('Long-sleeve shirt', 'Light jacket or hoodie', 'Jeans or chinos');
  } else if (tempF >= 32) {
    items.push('Warm sweater or fleece', 'Insulated jacket', 'Thick jeans or trousers');
  } else {
    items.push('Heavy coat', 'Thermal underlayer', 'Warm hat & gloves', 'Insulated boots');
  }

  // Style-specific extras
  const styleExtras: Record<string, string> = {
    'Business Casual': 'Dress shoes or clean sneakers',
    'Formal':          'Dress shoes, consider a blazer',
    'Urban':           'Streetwear sneakers, statement outerwear',
    'Cozy':            'Soft knits, comfortable loafers',
    'Preppy':          'Collared shirt, chinos',
  };
  if (styleExtras[clothingStyle]) items.push(styleExtras[clothingStyle]);

  // Condition modifiers
  if (humid > settings.humidityPreference) items.push('Moisture-wicking, breathable fabrics');
  if (raining) items.push('Waterproof jacket', 'Umbrella');

  const headline =
    tempF >= hiTempThreshold  ? "It's hot out there." :
    tempF >= lowTempThreshold  ? "Nice weather today." :
    tempF >= lowTempThreshold - 15 ? "A bit cool — layer up." :
    tempF >= 32                ? "Bundle up." :
    "Dress warm — it's freezing.";

  return { headline, items };
};

const OutfitSuggestion = ({ weather, settings }: Props) => {
  const { headline, items } = useMemo(() => getOutfitAdvice(weather, settings), [weather, settings]);

  return (
    <div className={styles.root}>
      <div className={styles.styleTag}>{settings.clothingStyle}</div>
      <p className={styles.headline}>{headline}</p>
      <ul className={styles.list}>
        {items.map(item => (
          <li key={item} className={styles.item}>
            <span className={styles.dot} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default OutfitSuggestion;
