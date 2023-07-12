import React from "react";
import cloudy from '../../assets/images/weatherIcons/Cloudy.png'
import './MinimizedWeatherDisplay.css'
import  WeatherIconDisplay  from "../WeatherIconDisplay/WeatherIconDisplay";

//app resposible for showing icon and temperature only\

const MinimizedWeatherDisplay = ({weather,temperature,tempUnit,isDay}) => {
    return(
        <div className="flex">
            <WeatherIconDisplay weatherCondition={weather} isDay={isDay}/>
            <div><p className='miniWeatherText'>{temperature} {tempUnit}</p></div>
        </div>
    )
}
export default MinimizedWeatherDisplay