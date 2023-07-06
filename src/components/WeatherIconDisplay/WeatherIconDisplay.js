import React from "react";
import '../../App.css'
import cloudy from '../../assets/images/weatherIcons/Cloudy.png'


//component responsible for displaying weather
export const WeatherIconDisplay = (props) => {
    return(<div>
        <img src={cloudy} alt="cloudy weather" className="currentWeatherLogo"></img>
    </div>)
}