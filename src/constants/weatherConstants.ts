const weatherConstants = {
  FAHRENHEIT:  'Imperial',
  CELSIUS:     'Metric',
  GET_CURRENT: '/api/weather/current',
  GET_HOURLY:  '/api/weather/hourly',
  GET_DAILY:   '/api/weather/daily',
} as const;

export default weatherConstants;
