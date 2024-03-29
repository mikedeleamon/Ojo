import React, { useEffect, useState } from 'react';
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

// Component responsible for displaying weather
const WeatherIconDisplay = ({
    weatherCondition,
    isDay,
    size,
    temperature,
    feelsLike,
}) => {
    const bigIcon = 'currentWeatherLogo';
    const smallIcon = 'miniWeatherIcon';
    const [iconSize, setIconSize] = useState('');
    let weatherIcon;

    useEffect(() => {
        size === 'Big' ? setIconSize(bigIcon) : setIconSize(smallIcon);
    }, [size]);

    switch (weatherCondition) {
        case 'Cloudy':
        case 'Mostly cloudy':
        case 'Dreary (Overcast)':
            weatherIcon = <Cloudy className={iconSize} />;
            break;
        case 'Partly cloudy':
        case 'Partly sunny':
        case 'Partly cloudy w/ showers':
        case 'Intermittent clouds':
        case 'Hazy sunshine':
            weatherIcon = isDay ? (
                <PartlyCloudy className={iconSize} />
            ) : (
                <PartlyCloudyNight className={iconSize} />
            );
            break;
        case 'Snow':
        case 'Mostly cloudy w/ snow':
        case 'Mostly cloudy w/ flurries':
            weatherIcon = <Snow className={iconSize} />;
            break;
        case 'Rain':
        case 'Showers':
        case 'Flurries':
        case 'Mostly cloudy w/ showers':
            weatherIcon = <Rainy className={iconSize} />;
            break;
        case 'Sunny':
        case 'Mostly sunny':
            weatherIcon = <Sunny className={iconSize} />;
            break;
        case 'Clear':
        case 'Mostly clear':
            weatherIcon = isDay ? (
                <Sunny className={iconSize} />
            ) : (
                <ClearNight className={iconSize} />
            );
            break;
        case 'Thunderstorms':
        case 'Partly sunny w/ t-storms':
        case 'Partly cloudy w/ t-Storms':
        case 'Mostly cloudy w/ t-Storms':
            weatherIcon = <Stormy className={iconSize} />;
            break;
        default:
            weatherIcon = null;
    }

    return (
        <div className={styles.weatherContainer}>
            {weatherIcon}
            {size === 'Big' ? (
                <div className={styles.temperature}>
                    <div>{`${temperature}\u00B0`}</div>
                    <div>{`${feelsLike}\u00B0`}</div>
                </div>
            ) : (
                <div className={styles.temperature}>{temperature}</div>
            )}
        </div>
    );
};

export default WeatherIconDisplay;
