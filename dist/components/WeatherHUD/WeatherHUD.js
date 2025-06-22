import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import axios from 'axios';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
import WeatherDetails from '../WeatherDetails/WeatherDetails';
import MinimizedWeatherDisplay from '../MinimizedWeatherDisplay/MinimizedWeatherDisplay';
import weatherConstants from '../../constants/weatherConstants';
import Loading from '../Loading/Loading';
import CurrentWeatherHeader from '../CurrentWeatherHeader/CurrentWeatherHeader';
import './WeatherHUD.css';
const WeatherHUD = ({ location, getBackgroundColor, settings, }) => {
    const [currentWeather, setCurrentWeather] = useState([]);
    const [forecasts, setForecasts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cityData, setCityData] = useState(null);
    const setBackgroundColor = (temp) => {
        //TODO use 'Settings' preferences
        const temperature = parseFloat(temp);
        if (isNaN(temperature)) {
            return 'lightgray';
        }
        if (temperature > 50 && temperature < 90) {
            return 'lightblue'; // Mid-range temperature
        }
        if (temperature <= 50) {
            return 'lightgreen'; // Low temperature
        }
        return 'lightcoral'; // High temperature
    };
    useEffect(() => {
        let currentTemperature = currentWeather[0]?.Temperature.Imperial.Value;
        getBackgroundColor(setBackgroundColor(currentTemperature));
    }, [currentWeather[0]?.Temperature.Imperial.Value]);
    const getForecastInfo = async () => {
        if (!cityData)
            return;
        try {
            const response = await axios.get(`${weatherConstants.GET_CURRENT_FORECAST}/${cityData.Key}?&apikey=${weatherConstants.API_KEY}&details=true`);
            setForecasts(response.data);
            console.log('Forecasts:', response.data);
        }
        catch (error) {
            console.error('Error fetching forecast data:', error);
        }
    };
    const getCurrentWeatherInfo = async () => {
        if (!cityData)
            return;
        try {
            const response = await axios.get(`${weatherConstants.GET_CURRENT_WEATHER}/${cityData.Key}?&apikey=${weatherConstants.API_KEY}&details=true`);
            setCurrentWeather(response.data);
        }
        catch (error) {
            console.error('Error fetching current weather data:', error);
        }
    };
    useEffect(() => {
        const getCity = async () => {
            try {
                const response = await axios.get(`${weatherConstants.GET_CITY}?apikey=${weatherConstants.API_KEY}&q=${location}`);
                console.log('City Data:', response.data);
                setCityData(response.data[0]);
            }
            catch (error) {
                console.error('Error fetching city data:', error);
            }
        };
        if (location) {
            getCity();
        }
    }, [location]);
    useEffect(() => {
        if (cityData?.Key) {
            getForecastInfo();
            getCurrentWeatherInfo();
            setIsLoading(false);
        }
        // Uncomment for mock data testing
        // setForecasts(mockWeatherData.forecast);
        // setCurrentWeather(mockWeatherData.currentWeather);
        // setIsLoading(false);
    }, [cityData]);
    return isLoading ? (_jsx(Loading, {})) : (_jsxs("div", { className: 'big-weather-width center mt-5', children: [cityData && currentWeather.length > 0 && (_jsx(CurrentWeatherHeader, { cityName: cityData.LocalizedName, weatherCondition: currentWeather[0].WeatherText })), currentWeather.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(WeatherIconDisplay, { weatherCondition: currentWeather[0].WeatherText, size: 'Big', temperature: currentWeather[0].Temperature.Imperial.Value, feelsLike: currentWeather[0].RealFeelTemperature.Imperial.Value, isDay: false }), _jsx("div", { className: 'x-scroll forecast-margin', children: forecasts.length > 0 ? (forecasts.map((forecast, index) => (_jsx(MinimizedWeatherDisplay, { weather: forecast.IconPhrase, temperature: forecast.Temperature.Value, time: forecast.DateTime, tempUnit: forecast.Temperature.Unit, isDay: forecast.IsDaylight }, index)))) : (_jsx("div", { children: "yikes, no forecast today" })) }), _jsx(WeatherDetails, { weatherDetails: currentWeather })] })) : (_jsx("p", { children: "We're experiencing an issue here, please refresh" }))] }));
};
export default WeatherHUD;
