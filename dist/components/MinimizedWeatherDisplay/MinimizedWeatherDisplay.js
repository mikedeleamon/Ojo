import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import './MinimizedWeatherDisplay.css';
import WeatherIconDisplay from '../WeatherIconDisplay/WeatherIconDisplay';
const MinimizedWeatherDisplay = ({ weather, temperature, time, tempUnit, isDay, }) => {
    // Format the time to a readable format
    function formatTime(dateString) {
        const date = new Date(dateString);
        const formattedTime = date.toLocaleString('en-US', {
            hour: 'numeric',
            hour12: true,
        });
        return formattedTime;
    }
    return (_jsxs("div", { className: 'flex', children: [_jsx("div", { children: _jsx("p", { className: 'miniWeatherTimeText', children: formatTime(time) }) }), _jsx(WeatherIconDisplay, { weatherCondition: weather, isDay: isDay, size: 'small', temperature: '' }), _jsx("div", { children: _jsx("p", { className: 'miniWeatherTempText', children: `${temperature}\u00B0 ${tempUnit}` }) })] }));
};
export default MinimizedWeatherDisplay;
