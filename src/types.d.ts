export interface CityData {
  Key: string;
  LocalizedName: string;
}

export interface CurrentWeather {
  WeatherText: string;
  HasPrecipitation: boolean;
  IsDayTime: boolean;
  Temperature: {
    Imperial: { Value: number; Unit: string };
    Metric: { Value: number; Unit: string };
  };
  RealFeelTemperature: {
    Imperial: { Value: number; Unit: string };
    Metric: { Value: number; Unit: string };
  };
  Wind: { Speed: { Imperial: { Value: number }; Metric: { Value: number } } };
  RelativeHumidity: number;
  UVIndexText: string;
}

export interface Forecast {
  IconPhrase: string;
  Temperature: { Value: number; Unit: string };
  DateTime: string;
  IsDaylight: boolean;
}

export interface Settings {
  clothingStyle: string;
  location: string;
  temperatureScale: string;
  hiTempThreshold: number;
  lowTempThreshold: number;
  humidityPreference: number;
}
