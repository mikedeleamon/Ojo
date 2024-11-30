import React, { useState, useEffect } from 'react';
import '../../App.css';
import OutfitSuggestion from '../OutfitSuggestion/OutfitSuggestion.tsx';

interface WeatherDetail {
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
}

interface WeatherDetailsProps {
    weatherDetails: WeatherDetail[]; // Expecting an array of weather details
}

const WeatherDetails: React.FC<WeatherDetailsProps> = ({ weatherDetails }) => {
    const [windSpeed, setWindSpeed] = useState<string>('');
    const [humidity, setHumidity] = useState<string>('');
    const [uvIndex, setUvIndex] = useState<string>('');
    const [showDetails, setShowDetails] = useState<boolean>(false);

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

    return (
        <>
            <OutfitSuggestion currentWeather={weatherDetails} />

            {showDetails ? (
                <div>
                    <a
                        onClick={handleShowDetails}
                        style={{ cursor: 'pointer' }}
                    >
                        Show Less
                    </a>
                    <p>wind speed: {windSpeed} mi/h</p>
                    <p>UV Index: {uvIndex}</p>
                    <p>humidity: {humidity}</p>
                </div>
            ) : (
                <a
                    onClick={handleShowDetails}
                    style={{ cursor: 'pointer' }}
                >
                    More
                </a>
            )}
        </>
    );
};

export default WeatherDetails;
