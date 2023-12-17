import React, { useState, useEffect } from 'react';
import axios from 'axios';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import WeatherDetails from '../WeatherDetails/WeatherDetails';
import MinimizedWeatherDisplay from '../MinimizedWeatherDisplay/MinimizedWeatherDisplay';
import weatherConstants from '../../constants/weatherConstants';
import mockWeatherData from '../../mockData/mockWeatherData';
import Loading from '../Loading/Loading';
import CurrentWeatherHeader from '../CurrentWeatherHeader/CurrentWeatherHeader';
import './WeatherHUD.css';

const WeatherHUD = ({ location }) => {
    const [currentWeather, setCurrentWeather] = useState([]);
    const [forecasts, setForecasts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cityData, setCityData] = useState('');

    useEffect(() => {
        const getCity = async () => {
            try {
                const response = await axios.get(
                    `${weatherConstants.GET_CITY}?apikey=${weatherConstants.API_KEY}&q=${location}`
                );
                console.log(response.data);
                setCityData(response.data[0]);
            } catch (error) {
                console.log('Error fetching City data:', error);
            }
        };
        if (location) {
            getCity();
        }
    }, [location]);

    useEffect(() => {
        const getForecastInfo = async () => {
            try {
                const response = await axios.get(
                    `${weatherConstants.GET_CURRENT_FORECAST}/${cityData.Key}?&apikey=${weatherConstants.API_KEY}&details=true`
                );
                setForecasts(response.data);
                //console.log(forecasts)
            } catch (error) {
                console.log('Error fetching forecast data:', error);
            }
        };

        const getCurrentWeatherInfo = async () => {
            try {
                const response = await axios.get(
                    `${weatherConstants.GET_CURRENT_WEATHER}/${cityData.Key}?&apikey=${weatherConstants.API_KEY}&details=true`
                );
                setCurrentWeather(response.data);
            } catch (error) {
                console.log('Error fetching current weather data:', error);
            }
        };

        // Uncomment the following lines to fetch live data instead of using mock data
        // if (cityData.Key) {
        //   getForecastInfo();
        //   getCurrentWeatherInfo();
        // }

        // Use mock data for testing purposes
        setForecasts(mockWeatherData.forecast);
        setCurrentWeather(mockWeatherData.currentWeather);
        setIsLoading(false);
    }, [cityData]);

    return isLoading ? (
        <Loading />
    ) : (
        <div className='big-weather-width center mt-5'>
            {cityData && currentWeather.length > 0 && (
                <CurrentWeatherHeader
                    cityName={cityData.LocalizedName}
                    weatherCondition={currentWeather[0].WeatherText}
                />
            )}
            {currentWeather.length > 0 && (
                <>
                    <WeatherIconDisplay
                        weatherCondition={currentWeather[0].WeatherText}
                        size={'Big'}
                        temperature={
                            currentWeather[0].Temperature.Imperial.Value
                        }
                    />
                    <div className='x-scroll forecast-margin'>
                        {forecasts.length > 0 ? (
                            forecasts.map((forecast, index) => (
                                <MinimizedWeatherDisplay
                                    key={index}
                                    weather={forecast.IconPhrase}
                                    temperature={forecast.Temperature.Value}
                                    time={forecast.DateTime}
                                    tempUnit={forecast.Temperature.Unit}
                                    isDay={forecast.IsDaylight}
                                />
                            ))
                        ) : (
                            <div>yikes, no forecast today</div>
                        )}
                    </div>
                    <WeatherDetails weatherDetails={currentWeather} />
                </>
            )}
            {!currentWeather.length && (
                <p>We're experiencing an issue here, please refresh</p>
            )}
        </div>
    );
};

export default WeatherHUD;
