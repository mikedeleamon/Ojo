import { useState, useEffect } from 'react';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import { Settings } from '../../types';
import { getCurrentLocation, formatCoords } from '../../lib/location';
import styles from './MainPage.module.css';

interface Props {
  settings:      Settings;
  settingsReady: boolean;
}

const MainPage = ({ settings, settingsReady }: Props) => {
  const [location,   setLocation]   = useState('');
  const [geoLoading, setGeoLoading] = useState(true);

  useEffect(() => {
    getCurrentLocation(8000).then(coords => {
      setLocation(coords
        ? formatCoords(coords.lat, coords.lng)
        : settings.location,
      );
      setGeoLoading(false);
    });
  }, [settings.location]);

  if (!settingsReady || geoLoading) return <Loading />;

  return (
    <div className={styles.root}>
      <WeatherHUD location={location} settings={settings} />
    </div>
  );
};

export default MainPage;
