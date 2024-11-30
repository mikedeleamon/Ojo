import React, { useEffect, useState } from 'react';
import '../../App.css';
import styles from './MainPage.module.css';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD.tsx';
import Loading from '../../components/Loading/Loading.tsx';
import SettingsButton from '../../components/buttons/SettingsButton/SettingsButton.tsx';

const MainPage: React.FC = () => {
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const location =
        latitude !== null && longitude !== null
            ? `${latitude},${longitude}`
            : '';

    useEffect(() => {
        // Use the Geolocation API to get the current location
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
                setIsLoading(false);
            },
            (error) => {
                console.error('Error getting location:', error);
            }
        );
    }, []);

    return isLoading ? (
        <Loading />
    ) : (
        <div className='App'>
            <div className={styles.settingsButtonContainer}>
                <SettingsButton />
            </div>
            <WeatherHUD location={location} />
        </div>
    );
};

export default MainPage;
