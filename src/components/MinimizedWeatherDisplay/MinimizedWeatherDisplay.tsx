import React from 'react';
import './MinimizedWeatherDisplay.css';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay.tsx';

// Define types for props
interface MinimizedWeatherDisplayProps {
    weather: string; // The weather condition (e.g., "Sunny", "Rainy")
    temperature: number; // Temperature value (e.g., 75)
    time: string; // Time string (e.g., "2024-11-29T14:00:00Z")
    tempUnit: string; // Temperature unit (e.g., "F" for Fahrenheit, "C" for Celsius)
    isDay: boolean; // Whether it is day or night (true for day, false for night)
}

const MinimizedWeatherDisplay = ({
    weather,
    temperature,
    time,
    tempUnit,
    isDay,
}: MinimizedWeatherDisplayProps) => {
    // Format the time to a readable format
    function formatTime(dateString: string): string {
        const date = new Date(dateString);
        const formattedTime = date.toLocaleString('en-US', {
            hour: 'numeric',
            hour12: true,
        });
        return formattedTime;
    }

    return (
        <div className='flex'>
            <div>
                <p className='miniWeatherTimeText'>{formatTime(time)}</p>
            </div>
            <WeatherIconDisplay
                weatherCondition={weather}
                isDay={isDay}
                size={'small'}
                temperature={''}
            />
            <div>
                <p className='miniWeatherTempText'>{`${temperature}\u00B0 ${tempUnit}`}</p>
            </div>
        </div>
    );
};

export default MinimizedWeatherDisplay;
