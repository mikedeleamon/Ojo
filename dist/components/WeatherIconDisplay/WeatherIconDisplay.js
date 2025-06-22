import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import '../../App.css';
import Cloudy from '../weatherIcons/Cloudy/Cloudy';
import Snow from '../weatherIcons/Snow/Snow';
import Rainy from '../weatherIcons/Rainy/Rainy';
import Sunny from '../weatherIcons/Sunny/Sunny';
import ClearNight from '../weatherIcons/ClearNight/ClearNight';
import Stormy from '../weatherIcons/Stormy/Stormy';
import PartlyCloudy from '../weatherIcons/PartlyCloudy/PartlyCloudy';
import PartlyCloudyNight from '../weatherIcons/PartlyCloudy/PartlyCloudyNight';
import styles from './WeatherIconDisplay.module.css';
const WeatherIconDisplay = ({ weatherCondition, isDay, size, temperature, feelsLike, }) => {
    const bigIcon = 'currentWeatherLogo';
    const smallIcon = 'miniWeatherIcon';
    const [iconSize, setIconSize] = useState('');
    let weatherIcon;
    useEffect(() => {
        setIconSize(size === 'Big' ? bigIcon : smallIcon);
    }, [size]);
    switch (weatherCondition) {
        case 'Cloudy':
        case 'Mostly cloudy':
        case 'Dreary (Overcast)':
            weatherIcon = _jsx(Cloudy, { className: iconSize });
            break;
        case 'Partly cloudy':
        case 'Partly sunny':
        case 'Partly cloudy w/ showers':
        case 'Intermittent clouds':
        case 'Hazy sunshine':
            weatherIcon = isDay ? (_jsx(PartlyCloudy, { className: iconSize })) : (_jsx(PartlyCloudyNight, { className: iconSize }));
            break;
        case 'Snow':
        case 'Mostly cloudy w/ snow':
        case 'Mostly cloudy w/ flurries':
            weatherIcon = _jsx(Snow, { className: iconSize });
            break;
        case 'Rain':
        case 'Showers':
        case 'Flurries':
        case 'Mostly cloudy w/ showers':
            weatherIcon = _jsx(Rainy, { className: iconSize });
            break;
        case 'Sunny':
        case 'Mostly sunny':
            weatherIcon = _jsx(Sunny, { className: iconSize });
            break;
        case 'Clear':
        case 'Mostly clear':
            weatherIcon = isDay ? (_jsx(Sunny, { className: iconSize })) : (_jsx(ClearNight, { className: iconSize }));
            break;
        case 'Thunderstorms':
        case 'Partly sunny w/ t-storms':
        case 'Partly cloudy w/ t-Storms':
        case 'Mostly cloudy w/ t-Storms':
            weatherIcon = _jsx(Stormy, { className: iconSize });
            break;
        default:
            weatherIcon = null;
    }
    return (_jsxs("div", { className: styles.weatherContainer, children: [weatherIcon, size === 'Big' ? (_jsxs("div", { className: styles.temperature, children: [_jsx("div", { children: `${temperature}\u00B0` }), feelsLike && _jsx("div", { children: `${feelsLike}\u00B0` })] })) : (_jsx("div", { className: styles.temperature, children: temperature }))] }));
};
export default WeatherIconDisplay;
