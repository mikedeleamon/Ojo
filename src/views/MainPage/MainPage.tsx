import { useState, useEffect } from 'react';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import { Settings } from '../../types';
import styles from './MainPage.module.css';

interface Props {
  settings: Settings;
  settingsReady: boolean;
}

const MainPage = ({ settings, settingsReady }: Props) => {
  const [location, setLocation] = useState('');
  const [geoLoading, setGeoLoading] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setLocation(settings.location);
      setGeoLoading(false);
    }, 8000);

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        clearTimeout(timeout);
        setLocation(`${coords.latitude},${coords.longitude}`);
        setGeoLoading(false);
      },
      () => {
        clearTimeout(timeout);
        setLocation(settings.location);
        setGeoLoading(false);
      }
    );

    return () => clearTimeout(timeout);
  }, []);

  if (!settingsReady || geoLoading) return <Loading />;

  return (
    <div className={styles.root}>
      <WeatherHUD location={location} settings={settings} />
    </div>
  );
};

export default MainPage;
