import React, { useEffect, useState } from 'react';
import '../../App.css';
import styles from './MainPage.module.css';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import SettingsButton from '../../components/buttons/SettingsButton/SettingsButton';
import axios from 'axios';

import { Settings } from '../../types';

const MainPage = () => {
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [backgroundColor, getBackgroundColor] = useState<string>('#fff');

    const location =
        latitude !== null && longitude !== null
            ? `${latitude},${longitude}`
            : '';

    const getSettings = async () => {
        try {
            const response = await axios.get('/get-settings');
            setSettings(response.data);
        } catch (error) {
            console.error('Error retrieving settings:', error);
        }
    };
    useEffect(() => {
        // Fetch settings and geolocation data

        const getLocation = () => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLatitude(position.coords.latitude);
                    setLongitude(position.coords.longitude);
                    setIsLoading(false);
                },
                (error) => {
                    console.error('Error getting location:', error);
                    setIsLoading(false); // Stop loading even if location fails
                }
            );
        };

        // Call both functions
        getSettings();
        getLocation();
    }, []);

    return isLoading ? (
        <Loading />
    ) : (
        <div
            className='App'
            style={{
                backgroundColor: backgroundColor as string,
                height: '100vh',
                padding: '20px',
            }}
        >
            <div className={styles.settingsButtonContainer}>
                <SettingsButton />
            </div>
            <WeatherHUD
                location={location}
                getBackgroundColor={getBackgroundColor}
                settings={settings as Settings}
            />
        </div>
    );
};

export default MainPage;
