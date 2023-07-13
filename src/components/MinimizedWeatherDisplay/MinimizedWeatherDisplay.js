import React from "react";
import cloudy from '../../assets/images/weatherIcons/Cloudy.png'
import './MinimizedWeatherDisplay.css'
import  WeatherIconDisplay  from "../WeatherIconDisplay/WeatherIconDisplay";

//app resposible for showing icon, time and temperature only\

const MinimizedWeatherDisplay = ({weather,temperature,time,tempUnit,isDay}) => {
    function formatTime(dateString) {
        const date = new Date(dateString);
        const formattedTime = date.toLocaleString('en-US', { hour: 'numeric', hour12: true });
        return formattedTime;
    }

    return(
        <div className="flex">
            <div><p className='miniWeatherTimeText'>{formatTime(time)}</p></div>
            <WeatherIconDisplay weatherCondition={weather} isDay={isDay}/>
            <div><p className='miniWeatherTempText'>{`${temperature}\u00B0 ${tempUnit}`}</p></div>
        </div>
    )
}
export default MinimizedWeatherDisplay