const weatherConstants = {
    FAHRENHEIT: 'Imperial',
    CELSIUS: 'Metric',
    // All requests go to the local Express proxy — AccuWeather is never called from the browser
    GET_CITY: '/api/weather/city',
    GET_CURRENT_WEATHER: '/api/weather/current',
    GET_CURRENT_FORECAST: '/api/weather/forecast',
};

export default weatherConstants;
