import React, { useEffect, useState } from 'react';

interface WeatherDetail {
    HasPrecipitation: boolean;
    Temperature: {
        Imperial: {
            Value: string; // Temperature value as a string
        };
    };
    Wind: {
        Speed: {
            Imperial: {
                Value: string; // Wind speed value as a string
            };
        };
    };
    RelativeHumidity: string; // Humidity as a string
    UVIndexText: string; // UV Index description as a string
}

interface OutfitSuggestionProps {
    currentWeather: WeatherDetail[]; // Array of weather details
}

const OutfitSuggestion: React.FC<OutfitSuggestionProps> = ({
    currentWeather,
}) => {
    const [isRaining, setIsRaining] = useState<boolean>(false);
    const [userPreferences, setUserPreferences] = useState<string>('');
    const [recommendation, setRecommendation] = useState<string>('');

    useEffect(() => {
        const handleRecommendation = () => {
            if (currentWeather.length === 0) return;

            // Extracting relevant data from the weather object
            setIsRaining(currentWeather[0].HasPrecipitation);

            const temperature = parseFloat(
                currentWeather[0].Temperature.Imperial.Value
            );
            const humidity = parseFloat(currentWeather[0].RelativeHumidity);

            // Temperature and humidity-based clothing suggestions
            let outfit = '';

            if (temperature > 77) {
                outfit += "It's hot! Wear light and breathable clothes.";
            } else if (temperature >= 59 && temperature <= 77) {
                outfit += 'The weather is moderate. Dress comfortably.';
            } else if (temperature < 59 && isRaining) {
                outfit +=
                    "It's cold and rainy. Wear a jacket and bring an umbrella.";
            } else if (temperature < 59) {
                outfit += "It's cold. Wear warm layers.";
            } else {
                outfit += 'Weather recommendation not available.';
            }

            // Add humidity-specific clothing suggestions
            if (humidity > 70) {
                outfit += ' Consider wearing breathable fabrics.';
            } else if (humidity > 50) {
                outfit +=
                    ' It might be a bit humid. Choose comfortable clothing.';
            }

            // Add user's preferences to the recommendation
            outfit += `, ${userPreferences} style`;

            // Add rain-specific clothing suggestions
            if (isRaining) {
                outfit += ', umbrella, raincoat, waterproof shoes';
            }

            setRecommendation(outfit);
        };

        handleRecommendation();
    }, [currentWeather, isRaining, userPreferences]);

    return (
        <div>
            <div>
                <p>{recommendation}</p>
            </div>
        </div>
    );
};

export default OutfitSuggestion;
