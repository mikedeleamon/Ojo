import React, { useState, useEffect } from 'react';
import axios from 'axios';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay.tsx';
import WeatherDetails from '../WeatherDetails/WeatherDetails.tsx';
import MinimizedWeatherDisplay from '../MinimizedWeatherDisplay/MinimizedWeatherDisplay.tsx';
import weatherConstants from '../../constants/weatherConstants';
import mockWeatherData from '../../mockData/mockWeatherData';
import Loading from '../Loading/Loading.tsx';
import CurrentWeatherHeader from '../CurrentWeatherHeader/CurrentWeatherHeader.tsx';
import './WeatherHUD.css';

interface WeatherHUDProps {
    location: string;
}

interface CityData {
    Key: string;
    LocalizedName: string;
}

interface CurrentWeather {
    WeatherText: string;
    HasPrecipitation: boolean;
    Temperature: {
        Imperial: {
            Value: string; // Temperature value as a string
            Unit: string;
        };
    };
    Wind: {
        Speed: {
            Imperial: {
                Value: string; // Wind speed value as a string
            };
        };
    };
    RelativeHumidity: string; // Humidity percentage as a string
    UVIndexText: string; // UV Index description as a string
    RealFeelTemperature: {
        Imperial: {
            Value: string; // Temperature value as a string
            Unit: string;
        };
    };
}

interface Forecast {
    IconPhrase: string;
    Temperature: {
        Value: number; // Temperature value as a string
        Unit: string;
    };
    DateTime: string;
    IsDaylight: boolean;
}

const WeatherHUD: React.FC<WeatherHUDProps> = ({ location }) => {
    const [currentWeather, setCurrentWeather] = useState<CurrentWeather[]>([]);
    const [forecasts, setForecasts] = useState<Forecast[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [cityData, setCityData] = useState<CityData | null>(null);

    const getForecastInfo = async () => {
        if (!cityData) return;
        try {
            const response = await axios.get(
                `${weatherConstants.GET_CURRENT_FORECAST}/${cityData.Key}?&apikey=${weatherConstants.API_KEY}&details=true`
            );
            setForecasts(response.data);
            console.log('Forecasts:', response.data);
        } catch (error) {
            console.error('Error fetching forecast data:', error);
        }
    };

    const getCurrentWeatherInfo = async () => {
        if (!cityData) return;
        try {
            const response = await axios.get(
                `${weatherConstants.GET_CURRENT_WEATHER}/${cityData.Key}?&apikey=${weatherConstants.API_KEY}&details=true`
            );
            setCurrentWeather(response.data);
        } catch (error) {
            console.error('Error fetching current weather data:', error);
        }
    };

    useEffect(() => {
        const getCity = async () => {
            try {
                const response = await axios.get(
                    `${weatherConstants.GET_CITY}?apikey=${weatherConstants.API_KEY}&q=${location}`
                );
                console.log('City Data:', response.data);
                setCityData(response.data[0]);
            } catch (error) {
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
            {currentWeather.length > 0 ? (
                <>
                    <WeatherIconDisplay
                        weatherCondition={currentWeather[0].WeatherText}
                        size={'Big'}
                        temperature={
                            currentWeather[0].Temperature.Imperial.Value
                        }
                        feelsLike={
                            currentWeather[0].RealFeelTemperature.Imperial.Value
                        }
                        isDay={false}
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
            ) : (
                <p>We're experiencing an issue here, please refresh</p>
            )}
        </div>
    );
};

export default WeatherHUD;
