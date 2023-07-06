import React from "react";
import cloudy from '../../assets/images/weatherIcons/Cloudy.png'
import './MinimizedWeatherDisplay.css'

//app resposible for showing icon and temperature only\

export const MinimizedWeatherDisplay = () => {
    return(
        <div className="flex">
            <img src={cloudy} alt="alt" className="miniWeatherIcon"></img>
            <div><p className='miniWeatherText'>70 F</p></div>
        </div>
    )
}