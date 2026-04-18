import { useState, useEffect } from 'react';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import SettingsButton from '../../components/buttons/SettingsButton/SettingsButton';
import ClosetButton from '../../components/buttons/ClosetButton/ClosetButton';
import AccountButton from '../../components/buttons/AccountButton/AccountButton';
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
    // Timeout so geoLoading never hangs forever if the browser stalls
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
      {/* Left nav */}
      <div className={styles.leftNav}>
        <ClosetButton />
        <AccountButton />
      </div>
      {/* Right nav */}
      <div className={styles.rightNav}>
        <SettingsButton />
      </div>
      <WeatherHUD location={location} settings={settings} />
    </div>
  );
};

export default MainPage;
