const mockWeatherData = {
    forecast:[
        {
            "DateTime": "2023-07-08T00:00:00-04:00",
            "EpochDateTime": 1688788800,
            "WeatherIcon": 15,
            "IconPhrase": "Thunderstorms",
            "HasPrecipitation": true,
            "PrecipitationType": "Rain",
            "PrecipitationIntensity": "Light",
            "IsDaylight": false,
            "Temperature": {
                "Value": 75,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 72,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 1,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 158,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 1,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 158,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "RelativeHumidity": 84,
            "IndoorRelativeHumidity": 84,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 27900,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 51,
            "ThunderstormProbability": 31,
            "RainProbability": 51,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0.04,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0.04,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 88,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 0,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=0&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=0&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T01:00:00-04:00",
            "EpochDateTime": 1688792400,
            "WeatherIcon": 7,
            "IconPhrase": "Cloudy",
            "HasPrecipitation": false,
            "IsDaylight": false,
            "Temperature": {
                "Value": 75,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 79,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 79,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 72,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 2.3,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 157,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 3.5,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 84,
            "IndoorRelativeHumidity": 84,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 19800,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 16,
            "ThunderstormProbability": 9,
            "RainProbability": 16,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 90,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 0,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=1&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=1&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T02:00:00-04:00",
            "EpochDateTime": 1688796000,
            "WeatherIcon": 7,
            "IconPhrase": "Cloudy",
            "HasPrecipitation": false,
            "IsDaylight": false,
            "Temperature": {
                "Value": 74,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 71,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 3.5,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 157,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 3.5,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 86,
            "IndoorRelativeHumidity": 86,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 14700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 20,
            "ThunderstormProbability": 1,
            "RainProbability": 20,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 90,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 0,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=2&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=2&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T03:00:00-04:00",
            "EpochDateTime": 1688799600,
            "WeatherIcon": 7,
            "IconPhrase": "Cloudy",
            "HasPrecipitation": false,
            "IsDaylight": false,
            "Temperature": {
                "Value": 75,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 72,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 3.5,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 160,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 83,
            "IndoorRelativeHumidity": 83,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 11000,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 20,
            "ThunderstormProbability": 1,
            "RainProbability": 20,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 90,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 0,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=3&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=3&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T04:00:00-04:00",
            "EpochDateTime": 1688803200,
            "WeatherIcon": 7,
            "IconPhrase": "Cloudy",
            "HasPrecipitation": false,
            "IsDaylight": false,
            "Temperature": {
                "Value": 75,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 72,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 69,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 168,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 82,
            "IndoorRelativeHumidity": 82,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 7300,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 20,
            "ThunderstormProbability": 1,
            "RainProbability": 20,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 90,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 0,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=4&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=4&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T05:00:00-04:00",
            "EpochDateTime": 1688806800,
            "WeatherIcon": 7,
            "IconPhrase": "Cloudy",
            "HasPrecipitation": false,
            "IsDaylight": false,
            "Temperature": {
                "Value": 75,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 78,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 72,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 69,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 171,
                    "Localized": "S",
                    "English": "S"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 81,
            "IndoorRelativeHumidity": 81,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 3700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 20,
            "ThunderstormProbability": 1,
            "RainProbability": 20,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 90,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 0,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=5&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=5&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T06:00:00-04:00",
            "EpochDateTime": 1688810400,
            "WeatherIcon": 6,
            "IconPhrase": "Mostly cloudy",
            "HasPrecipitation": false,
            "IsDaylight": true,
            "Temperature": {
                "Value": 76,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 79,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 79,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 72,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 165,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 82,
            "IndoorRelativeHumidity": 82,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 3700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 20,
            "ThunderstormProbability": 1,
            "RainProbability": 20,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 89,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 27.2,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=6&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=6&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T07:00:00-04:00",
            "EpochDateTime": 1688814000,
            "WeatherIcon": 6,
            "IconPhrase": "Mostly cloudy",
            "HasPrecipitation": false,
            "IsDaylight": true,
            "Temperature": {
                "Value": 76,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 81,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "RealFeelTemperatureShade": {
                "Value": 80,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 72,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 148,
                    "Localized": "SSE",
                    "English": "SSE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 81,
            "IndoorRelativeHumidity": 81,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 3700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 0,
            "UVIndexText": "Low",
            "PrecipitationProbability": 16,
            "ThunderstormProbability": 1,
            "RainProbability": 16,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 89,
            "Evapotranspiration": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 98.6,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=7&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=7&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T08:00:00-04:00",
            "EpochDateTime": 1688817600,
            "WeatherIcon": 4,
            "IconPhrase": "Intermittent clouds",
            "HasPrecipitation": false,
            "IsDaylight": true,
            "Temperature": {
                "Value": 77,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 83,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Very Warm"
            },
            "RealFeelTemperatureShade": {
                "Value": 81,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Pleasant"
            },
            "WetBulbTemperature": {
                "Value": 73,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 128,
                    "Localized": "SE",
                    "English": "SE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 79,
            "IndoorRelativeHumidity": 79,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 3700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 1,
            "UVIndexText": "Low",
            "PrecipitationProbability": 7,
            "ThunderstormProbability": 1,
            "RainProbability": 7,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 70,
            "Evapotranspiration": {
                "Value": 0.01,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 338,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=8&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=8&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T09:00:00-04:00",
            "EpochDateTime": 1688821200,
            "WeatherIcon": 4,
            "IconPhrase": "Intermittent clouds",
            "HasPrecipitation": false,
            "IsDaylight": true,
            "Temperature": {
                "Value": 79,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 86,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Very Warm"
            },
            "RealFeelTemperatureShade": {
                "Value": 83,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Very Warm"
            },
            "WetBulbTemperature": {
                "Value": 73,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 123,
                    "Localized": "ESE",
                    "English": "ESE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 75,
            "IndoorRelativeHumidity": 75,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 3700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 2,
            "UVIndexText": "Low",
            "PrecipitationProbability": 7,
            "ThunderstormProbability": 1,
            "RainProbability": 7,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 70,
            "Evapotranspiration": {
                "Value": 0.01,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 470.3,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=9&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=9&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T10:00:00-04:00",
            "EpochDateTime": 1688824800,
            "WeatherIcon": 4,
            "IconPhrase": "Intermittent clouds",
            "HasPrecipitation": false,
            "IsDaylight": true,
            "Temperature": {
                "Value": 80,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 88,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Very Warm"
            },
            "RealFeelTemperatureShade": {
                "Value": 84,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Very Warm"
            },
            "WetBulbTemperature": {
                "Value": 74,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 129,
                    "Localized": "SE",
                    "English": "SE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 5.8,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 71,
            "IndoorRelativeHumidity": 71,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 3700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 2,
            "UVIndexText": "Low",
            "PrecipitationProbability": 6,
            "ThunderstormProbability": 1,
            "RainProbability": 6,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 70,
            "Evapotranspiration": {
                "Value": 0.01,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 583.9,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=10&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=10&lang=en-us"
        },
        {
            "DateTime": "2023-07-08T11:00:00-04:00",
            "EpochDateTime": 1688828400,
            "WeatherIcon": 4,
            "IconPhrase": "Intermittent clouds",
            "HasPrecipitation": false,
            "IsDaylight": true,
            "Temperature": {
                "Value": 82,
                "Unit": "F",
                "UnitType": 18
            },
            "RealFeelTemperature": {
                "Value": 91,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Hot"
            },
            "RealFeelTemperatureShade": {
                "Value": 85,
                "Unit": "F",
                "UnitType": 18,
                "Phrase": "Very Warm"
            },
            "WetBulbTemperature": {
                "Value": 74,
                "Unit": "F",
                "UnitType": 18
            },
            "DewPoint": {
                "Value": 70,
                "Unit": "F",
                "UnitType": 18
            },
            "Wind": {
                "Speed": {
                    "Value": 4.6,
                    "Unit": "mi/h",
                    "UnitType": 9
                },
                "Direction": {
                    "Degrees": 136,
                    "Localized": "SE",
                    "English": "SE"
                }
            },
            "WindGust": {
                "Speed": {
                    "Value": 5.8,
                    "Unit": "mi/h",
                    "UnitType": 9
                }
            },
            "RelativeHumidity": 68,
            "IndoorRelativeHumidity": 68,
            "Visibility": {
                "Value": 10,
                "Unit": "mi",
                "UnitType": 2
            },
            "Ceiling": {
                "Value": 3700,
                "Unit": "ft",
                "UnitType": 0
            },
            "UVIndex": 3,
            "UVIndexText": "Moderate",
            "PrecipitationProbability": 5,
            "ThunderstormProbability": 1,
            "RainProbability": 5,
            "SnowProbability": 0,
            "IceProbability": 0,
            "TotalLiquid": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Rain": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Snow": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "Ice": {
                "Value": 0,
                "Unit": "in",
                "UnitType": 1
            },
            "CloudCover": 70,
            "Evapotranspiration": {
                "Value": 0.01,
                "Unit": "in",
                "UnitType": 1
            },
            "SolarIrradiance": {
                "Value": 671.1,
                "Unit": "W/m²",
                "UnitType": 33
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=11&lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/hourly-weather-forecast/349727?day=2&hbhhour=11&lang=en-us"
        }
    ],

    currentWeather:[
        {
            "LocalObservationDateTime": "2023-07-11T13:08:00-04:00",
            "EpochTime": 1689095280,
            "WeatherText": "Partly sunny",
            "WeatherIcon": 3,
            "HasPrecipitation": false,
            "PrecipitationType": null,
            "IsDayTime": true,
            "Temperature": {
                "Metric": {
                    "Value": 30,
                    "Unit": "C",
                    "UnitType": 17
                },
                "Imperial": {
                    "Value": 86,
                    "Unit": "F",
                    "UnitType": 18
                }
            },
            "RealFeelTemperature": {
                "Metric": {
                    "Value": 37.4,
                    "Unit": "C",
                    "UnitType": 17,
                    "Phrase": "Hot"
                },
                "Imperial": {
                    "Value": 99,
                    "Unit": "F",
                    "UnitType": 18,
                    "Phrase": "Hot"
                }
            },
            "RealFeelTemperatureShade": {
                "Metric": {
                    "Value": 30.3,
                    "Unit": "C",
                    "UnitType": 17,
                    "Phrase": "Very Warm"
                },
                "Imperial": {
                    "Value": 87,
                    "Unit": "F",
                    "UnitType": 18,
                    "Phrase": "Very Warm"
                }
            },
            "RelativeHumidity": 39,
            "IndoorRelativeHumidity": 39,
            "DewPoint": {
                "Metric": {
                    "Value": 15,
                    "Unit": "C",
                    "UnitType": 17
                },
                "Imperial": {
                    "Value": 59,
                    "Unit": "F",
                    "UnitType": 18
                }
            },
            "Wind": {
                "Direction": {
                    "Degrees": 0,
                    "Localized": "N",
                    "English": "N"
                },
                "Speed": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "km/h",
                        "UnitType": 7
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "mi/h",
                        "UnitType": 9
                    }
                }
            },
            "WindGust": {
                "Speed": {
                    "Metric": {
                        "Value": 8.1,
                        "Unit": "km/h",
                        "UnitType": 7
                    },
                    "Imperial": {
                        "Value": 5,
                        "Unit": "mi/h",
                        "UnitType": 9
                    }
                }
            },
            "UVIndex": 9,
            "UVIndexText": "Very High",
            "Visibility": {
                "Metric": {
                    "Value": 16.1,
                    "Unit": "km",
                    "UnitType": 6
                },
                "Imperial": {
                    "Value": 10,
                    "Unit": "mi",
                    "UnitType": 2
                }
            },
            "ObstructionsToVisibility": "",
            "CloudCover": 44,
            "Ceiling": {
                "Metric": {
                    "Value": 12192,
                    "Unit": "m",
                    "UnitType": 5
                },
                "Imperial": {
                    "Value": 40000,
                    "Unit": "ft",
                    "UnitType": 0
                }
            },
            "Pressure": {
                "Metric": {
                    "Value": 1011.9,
                    "Unit": "mb",
                    "UnitType": 14
                },
                "Imperial": {
                    "Value": 29.88,
                    "Unit": "inHg",
                    "UnitType": 12
                }
            },
            "PressureTendency": {
                "LocalizedText": "Steady",
                "Code": "S"
            },
            "Past24HourTemperatureDeparture": {
                "Metric": {
                    "Value": 3.3,
                    "Unit": "C",
                    "UnitType": 17
                },
                "Imperial": {
                    "Value": 6,
                    "Unit": "F",
                    "UnitType": 18
                }
            },
            "ApparentTemperature": {
                "Metric": {
                    "Value": 30,
                    "Unit": "C",
                    "UnitType": 17
                },
                "Imperial": {
                    "Value": 86,
                    "Unit": "F",
                    "UnitType": 18
                }
            },
            "WindChillTemperature": {
                "Metric": {
                    "Value": 30,
                    "Unit": "C",
                    "UnitType": 17
                },
                "Imperial": {
                    "Value": 86,
                    "Unit": "F",
                    "UnitType": 18
                }
            },
            "WetBulbTemperature": {
                "Metric": {
                    "Value": 20,
                    "Unit": "C",
                    "UnitType": 17
                },
                "Imperial": {
                    "Value": 68,
                    "Unit": "F",
                    "UnitType": 18
                }
            },
            "Precip1hr": {
                "Metric": {
                    "Value": 0,
                    "Unit": "mm",
                    "UnitType": 3
                },
                "Imperial": {
                    "Value": 0,
                    "Unit": "in",
                    "UnitType": 1
                }
            },
            "PrecipitationSummary": {
                "Precipitation": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                },
                "PastHour": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                },
                "Past3Hours": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                },
                "Past6Hours": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                },
                "Past9Hours": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                },
                "Past12Hours": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                },
                "Past18Hours": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                },
                "Past24Hours": {
                    "Metric": {
                        "Value": 0,
                        "Unit": "mm",
                        "UnitType": 3
                    },
                    "Imperial": {
                        "Value": 0,
                        "Unit": "in",
                        "UnitType": 1
                    }
                }
            },
            "TemperatureSummary": {
                "Past6HourRange": {
                    "Minimum": {
                        "Metric": {
                            "Value": 21.1,
                            "Unit": "C",
                            "UnitType": 17
                        },
                        "Imperial": {
                            "Value": 70,
                            "Unit": "F",
                            "UnitType": 18
                        }
                    },
                    "Maximum": {
                        "Metric": {
                            "Value": 30,
                            "Unit": "C",
                            "UnitType": 17
                        },
                        "Imperial": {
                            "Value": 86,
                            "Unit": "F",
                            "UnitType": 18
                        }
                    }
                },
                "Past12HourRange": {
                    "Minimum": {
                        "Metric": {
                            "Value": 20,
                            "Unit": "C",
                            "UnitType": 17
                        },
                        "Imperial": {
                            "Value": 68,
                            "Unit": "F",
                            "UnitType": 18
                        }
                    },
                    "Maximum": {
                        "Metric": {
                            "Value": 30,
                            "Unit": "C",
                            "UnitType": 17
                        },
                        "Imperial": {
                            "Value": 86,
                            "Unit": "F",
                            "UnitType": 18
                        }
                    }
                },
                "Past24HourRange": {
                    "Minimum": {
                        "Metric": {
                            "Value": 20,
                            "Unit": "C",
                            "UnitType": 17
                        },
                        "Imperial": {
                            "Value": 68,
                            "Unit": "F",
                            "UnitType": 18
                        }
                    },
                    "Maximum": {
                        "Metric": {
                            "Value": 30,
                            "Unit": "C",
                            "UnitType": 17
                        },
                        "Imperial": {
                            "Value": 86,
                            "Unit": "F",
                            "UnitType": 18
                        }
                    }
                }
            },
            "MobileLink": "http://www.accuweather.com/en/us/new-york-ny/10021/current-weather/349727?lang=en-us",
            "Link": "http://www.accuweather.com/en/us/new-york-ny/10021/current-weather/349727?lang=en-us"
        }
    ]
}

export default mockWeatherData