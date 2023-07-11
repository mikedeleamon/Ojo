import React, { useEffect, useState } from "react";
import '../../App.css';
import Cloudy from "../weatherIcons/Cloudy/Cloudy";
import Snow from "../weatherIcons/Snow/Snow";
import Rainy from "../weatherIcons/Rainy/Rainy";
import Sunny from "../weatherIcons/Sunny/Sunny";
import ClearNight from "../weatherIcons/ClearNight/ClearNight";
import Stormy from "../weatherIcons/Stormy/Stormy";
import PartlyCloudy from "../weatherIcons/PartlyCloudy/PartlyCloudy";
import PartlyCloudyNight from "../weatherIcons/PartlyCloudy/PartlyCloudyNight";

// Component responsible for displaying weather
const WeatherIconDisplay = ({ weatherCondition, isDay, size }) => {
    const bigIcon = "currentWeatherLogo";
    const smallIcon = "miniWeatherIcon";
    const [iconSize, setIconSize] = useState('');
    let weatherIcon;

    useEffect(() => {
        size === 'Big' ? setIconSize(bigIcon) : setIconSize(smallIcon);
    }, [size]);

    switch (weatherCondition) {
        case "Cloudy":
        case "Mostly cloudy":
        case "Dreary (Overcast)":
            weatherIcon = <Cloudy className={iconSize} />;
            break;
        case "Intermittent clouds":
        case "Partly cloudy":
        case "Partly Cloudy w/ Showers":
        case "Intermittent Clouds":
            weatherIcon = isDay ? <PartlyCloudy className={iconSize} /> : <PartlyCloudyNight className={iconSize} />;
            break;
        case "Snow":
        case "Mostly Cloudy w/ Snow":
        case "Mostly Cloudy w/ Flurries":
            weatherIcon = <Snow className={iconSize} />;
            break;
        case "Rain":
        case "Showers":
        case "Flurries":
        case "Mostly Cloudy w/ Showers":
            weatherIcon = <Rainy className={iconSize} />;
            break;
        case "Sunny":
        case "Mostly Sunny":
            weatherIcon = <Sunny className={iconSize} />;
            break;
        case "Clear":
        case "Mostly Clear":
            weatherIcon = isDay ? <Sunny className={iconSize} /> : <ClearNight className={iconSize} />;
            break;
        case "Thunderstorms":
        case "Partly Cloudy w/ T-Storms":
        case "Mostly Cloudy w/ T-Storms":
            weatherIcon = <Stormy className={iconSize} />;
            break;
        default:
            weatherIcon = null;
    }

    return (
        <div>
            {weatherIcon}
        </div>
    );
};

export default WeatherIconDisplay;