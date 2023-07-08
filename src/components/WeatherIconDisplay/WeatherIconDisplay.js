import React from "react";
import '../../App.css'
import cloudy from '../../assets/images/weatherIcons/Cloudy.png'


//component responsible for displaying weather
export const WeatherIconDisplay = ({weatherConditon}) => {
    return(<div>
        <img src={cloudy} alt={weatherConditon} className="currentWeatherLogo"></img>
    </div>)
}