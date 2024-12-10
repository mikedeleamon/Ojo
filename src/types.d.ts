export interface WeatherHUDProps {
    location: string;
    getBackgroundColor: React.Dispatch<React.SetStateAction<string>>;
}

export interface CityData {
    Key: string;
    LocalizedName: string;
}

export interface CurrentWeather {
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

export interface CityData {
    Key: string;
    LocalizedName: string;
}

export interface CurrentWeather {
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

export interface Forecast {
    IconPhrase: string;
    Temperature: {
        Value: number; // Temperature value as a string
        Unit: string;
    };
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