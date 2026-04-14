import { useState, useEffect } from 'react';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import SettingsButton from '../../components/buttons/SettingsButton/SettingsButton';
import { Settings } from '../../types';
import styles from './MainPage.module.css';

interface Props { settings: Settings; }

const MainPage = ({ settings }: Props) => {
  const [location, setLocation] = useState('');
  const [geoLoading, setGeoLoading] = useState(true);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation(`${coords.latitude},${coords.longitude}`);
        setGeoLoading(false);
      },
      () => {
        // Fall back to settings location if geo is denied
        setLocation(settings.location);
        setGeoLoading(false);
      }
    );
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.settingsBtn}>
        <SettingsButton />
      </div>
      {geoLoading ? <Loading /> : <WeatherHUD location={location} settings={settings} />}
    </div>
  );
};

export default MainPage;
