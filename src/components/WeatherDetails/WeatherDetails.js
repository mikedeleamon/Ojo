import React, { useState, useEffect } from 'react';
import '../../App.css';
import OutfitSuggestion from '../OutfitSuggestion/OutfitSuggestion';

const WeatherDetails = ({ weatherDetails }) => {
    //const [temperature, setTemperature] = useState('');
    const [windSpeed, setWindSpeed] = useState('');
    const [humidity, setHumidity] = useState('');
    //const [tempUnit, setTempUnit] = useState('');
    const [uvIndex, setUvIndex] = useState('');
    //const [feelsLike, setFeelsLike] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    useEffect(() => {
        if (Object.keys(weatherDetails).length > 0) {
            //setTemperature(weatherDetails[0].Temperature.Imperial.Value);
            setWindSpeed(weatherDetails[0].Wind.Speed.Imperial.Value);
            setHumidity(weatherDetails[0].RelativeHumidity);
            //setTempUnit(weatherDetails[0].Temperature.Imperial.Unit);
            setUvIndex(weatherDetails[0].UVIndexText);
            //setFeelsLike(weatherDetails[0].RealFeelTemperature.Imperial.Value);
        }
    }, [weatherDetails]);

    const handleShowDetails = () => {
        setShowDetails(!showDetails);
    };

    return (
        <>
            <OutfitSuggestion currentWeather={weatherDetails} />

            {showDetails ? (
                <div>
                    <a onClick={handleShowDetails}>Show Less</a>
                    {/* <p>{`temperature: ${temperature}\u00B0 ${tempUnit}`} </p> */}
                    <p>wind speed: {windSpeed} mi/h</p>
                    <p>UV Index: {uvIndex}</p>
                    <p>humidity: {humidity}</p>
                    {/* <p>feels like: {feelsLike} F</p> */}
                </div>
            ) : (
                <a onClick={handleShowDetails}>More</a>
            )}
        </>
    );
};

export default WeatherDetails;
