import React from "react";
import { WeatherIconDisplay } from "../WeatherIconDisplay/WeatherIconDisplay";
import { WeatherDetails } from "../WeatherDetails/WeatherDetails";
import { MinimizedWeatherDisplay } from "../MinimizedWeatherDisplay/MinimizedWeatherDisplay";
import './WeatherHUD.css'
 export const WeatherHUD = () => {
    return(
    <div className='big-weather-width center'>
    <p className="title">New York</p>
    <p className="subtitle">Cloudy</p>
    <WeatherIconDisplay/>
    <div>
        <MinimizedWeatherDisplay/>
        <MinimizedWeatherDisplay/>
        <MinimizedWeatherDisplay/>
        <MinimizedWeatherDisplay/>
        <MinimizedWeatherDisplay/>
      </div>
    <WeatherDetails />
    </div>
    )
 }