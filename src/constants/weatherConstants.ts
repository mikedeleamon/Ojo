const weatherConstants = {
  FAHRENHEIT:           'Imperial',
  CELSIUS:              'Metric',
  GET_CITY:             '/api/weather/city',
  GET_CURRENT_WEATHER:  '/api/weather/current',
  GET_CURRENT_FORECAST: '/api/weather/forecast',
} as const;

export default weatherConstants;
