import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import '../../App.css';
import styles from './MainPage.module.css';
import WeatherHUD from '../../components/WeatherHUD/WeatherHUD';
import Loading from '../../components/Loading/Loading';
import SettingsButton from '../../components/buttons/SettingsButton/SettingsButton';
import axios from 'axios';
const MainPage = () => {
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [settings, setSettings] = useState(null);
    const [backgroundColor, getBackgroundColor] = useState('#fff');
    const location = latitude !== null && longitude !== null
        ? `${latitude},${longitude}`
        : '';
    const getSettings = async () => {
        try {
            const response = await axios.get('/get-settings');
            setSettings(response.data);
        }
        catch (error) {
            console.error('Error retrieving settings:', error);
        }
    };
    useEffect(() => {
        // Fetch settings and geolocation data
        const getLocation = () => {
            navigator.geolocation.getCurrentPosition((position) => {
                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
                setIsLoading(false);
            }, (error) => {
                console.error('Error getting location:', error);
                setIsLoading(false); // Stop loading even if location fails
            });
        };
        // Call both functions
        getSettings();
        getLocation();
    }, []);
    return isLoading ? (_jsx(Loading, {})) : (_jsxs("div", { className: 'App', style: {
            backgroundColor: backgroundColor,
            height: '100vh',
            padding: '20px',
        }, children: [_jsx("div", { className: styles.settingsButtonContainer, children: _jsx(SettingsButton, {}) }), _jsx(WeatherHUD, { location: location, getBackgroundColor: getBackgroundColor, settings: settings })] }));
};
export default MainPage;
