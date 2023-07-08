import React from "react";
import cloudy from '../../assets/images/weatherIcons/Cloudy.png'
import './MinimizedWeatherDisplay.css'

//app resposible for showing icon and temperature only\

export const MinimizedWeatherDisplay = ({weather,temperature}) => {
    return(
        <div className="flex">
            <img src={cloudy} alt={weather} className="miniWeatherIcon"></img>
            <div><p className='miniWeatherText'>{temperature} F</p></div>
        </div>
    )
}