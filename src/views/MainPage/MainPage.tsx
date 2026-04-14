import { useState, useEffect } from 'react';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import SettingsButton from '../../components/buttons/SettingsButton/SettingsButton';
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
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation(`${coords.latitude},${coords.longitude}`);
        setGeoLoading(false);
      },
      () => {
        setLocation(settings.location);
        setGeoLoading(false);
      }
    );
  }, []);

  // Wait for settings to load from MongoDB before rendering the HUD so that
  // temperature scale, thresholds etc. are correct on first render.
  if (!settingsReady || geoLoading) return <Loading />;

  return (
    <div className={styles.root}>
      <div className={styles.settingsBtn}>
        <SettingsButton />
      </div>
      <WeatherHUD location={location} settings={settings} />
    </div>
  );
};

export default MainPage;
