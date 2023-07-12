import React, { useState, useEffect } from "react";
import '../../App.css'

const WeatherDetails = ({ weatherDetails }) => {
const [temperature, setTemperature] = useState('');
const [windSpeed, setWindSpeed] = useState('');
const [humidity, setHumidity] = useState('');
const [uvIndex, setUvIndex] = useState('');
const [feelsLike, setFeelsLike] = useState('');
useEffect(() => {
if (Object.keys(weatherDetails).length > 0) {
    setTemperature(weatherDetails[0].Temperature.Imperial.Value);
    setWindSpeed(weatherDetails[0].Wind.Speed.Imperial.Value);
    setHumidity(weatherDetails[0].RelativeHumidity);
    setUvIndex(weatherDetails[0].UVIndexText);
    setFeelsLike(weatherDetails[0].RealFeelTemperature.Imperial.Value);
}
}, [weatherDetails]);

return (
<div>
    <p>temperature: {temperature} F </p>
    <p>wind speed: {windSpeed} mi/h</p>
    <p>UV Index: {uvIndex}</p>
    <p>humidity: {humidity}</p>
    <p>feels like: {feelsLike} F</p>
</div>
);
};

export default WeatherDetails;