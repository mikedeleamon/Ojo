import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import '../../App.css';
import OutfitSuggestion from '../OutfitSuggestion/OutfitSuggestion';
const WeatherDetails = ({ weatherDetails }) => {
    const [windSpeed, setWindSpeed] = useState('');
    const [humidity, setHumidity] = useState('');
    const [uvIndex, setUvIndex] = useState('');
    const [showDetails, setShowDetails] = useState(false);
    useEffect(() => {
        if (weatherDetails.length > 0) {
            setWindSpeed(weatherDetails[0].Wind.Speed.Imperial.Value);
            setHumidity(weatherDetails[0].RelativeHumidity);
            setUvIndex(weatherDetails[0].UVIndexText);
        }
    }, [weatherDetails]);
    const handleShowDetails = () => {
        setShowDetails(!showDetails);
    };
    return (_jsxs(_Fragment, { children: [_jsx(OutfitSuggestion, { currentWeather: weatherDetails }), showDetails ? (_jsxs("div", { children: [_jsx("a", { onClick: handleShowDetails, style: { cursor: 'pointer' }, children: "Show Less" }), _jsxs("p", { children: ["wind speed: ", windSpeed, " mi/h"] }), _jsxs("p", { children: ["UV Index: ", uvIndex] }), _jsxs("p", { children: ["humidity: ", humidity] })] })) : (_jsx("a", { onClick: handleShowDetails, style: { cursor: 'pointer' }, children: "More" }))] }));
};
export default WeatherDetails;
