import React, { useState, useEffect } from "react";
import axios from "axios";
import { WeatherIconDisplay } from "../WeatherIconDisplay/WeatherIconDisplay";
import WeatherDetails from "../WeatherDetails/WeatherDetails";
import { MinimizedWeatherDisplay } from "../MinimizedWeatherDisplay/MinimizedWeatherDisplay";
import weatherConstants from "../../constants/weatherConstants";
import mockData from "../../mockData/mockData";
import Loading from "../Loading/Loading";
import CurrentWeatherHeader from '../CurrentWeatherHeader/CurrentWeatherHeader'
import './WeatherHUD.css';

export const WeatherHUD = () => {
  const [currentWeather, setCurrentWeather] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [isLoading,setIsLoading] = useState(true)

  useEffect(() => {
    const getForecastInfo = async () => {
      try {
        const response = await axios.get(`${weatherConstants.GET_CURRENT_FORECAST}/349727?&apikey=${weatherConstants.API_KEY}&details=true`);
        setForecasts(response.data);
      } catch (error) {
        console.log('Error fetching forecast data:', error);
      }
    };

    const getCurrentWeatherInfo = async () => {
      try {
        const response = await axios.get(`${weatherConstants.GET_CURRENT_WEATHER}/349727?&apikey=${weatherConstants.API_KEY}&details=true`);
        setCurrentWeather(response.data);
      } catch (error) {
        console.log('Error fetching current weather data:', error);
      }
    };

    // Uncomment the following lines to fetch live data instead of using mock data
    // getForecastInfo();
    // getCurrentWeatherInfo();

    // Use mock data for testing purposes
    setForecasts(mockData.forecast);
    setCurrentWeather(mockData.currentWeather);
    setIsLoading(false)
  }, []);

  return (
    isLoading?(<Loading/>):(
    <div className='big-weather-width center'>
      <CurrentWeatherHeader cityName={'New York'} weatherCondition={currentWeather.data[0].WeatherText} />
      <WeatherIconDisplay />
      <div className="x-scroll forecast-margin">
        {forecasts.length > 0 ? (
          forecasts.map((forecast, index) => (
            <MinimizedWeatherDisplay
              key={index}
              weather={forecast.IconPhrase}
              temperature={forecast.Temperature.Value}
            />
          ))
        ) : (
          <div>yikes, no forecast today</div>
        )}
      </div>

      {currentWeather ? (
        <WeatherDetails weatherDetails={currentWeather} />
      ) : (
        <p>We're experiencing an issue here, please refresh</p>
      )}
    </div>
  ));
};