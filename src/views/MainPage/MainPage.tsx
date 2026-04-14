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
