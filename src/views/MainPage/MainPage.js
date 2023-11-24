import React, { useEffect, useState } from 'react';
import '../../App.css';
import styles from './MainPage.module.css';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import SettingsButton from '../../components/SettingsButton/SettingsButton';

const MainPage = () => {
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const location = `${latitude},${longitude}`;

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
        <div className={`App`}>
            <div className={styles.settingsButtonContainer}>
                {/* <button
                    className={`col-12 col-sm-12 col-lg-12 btn btn-block btn-secondary mt-4`}
                >
                    Settings
                </button> */}
                <SettingsButton />
            </div>
            <WeatherHUD location={location} />
        </div>
    );
};

export default MainPage;
