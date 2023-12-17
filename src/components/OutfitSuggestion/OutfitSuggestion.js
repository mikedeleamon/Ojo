import React, { useEffect, useState } from 'react';

const OutfitSuggestion = ({ weather }) => {
    const [isRaining, setIsRaining] = useState(false);
    const [userPreferences, setUserPreferences] = useState('');
    const [recommendation, setRecommendation] = useState('');

    useEffect(() => {
        const handleRecommendation = () => {
            // Extracting relevant data from the weather object
            setIsRaining(weather[0].HasPrecipitation);
            const temperature = parseFloat(
                weather[0].Temperature.Imperial.Value
            );

            // Temperature-based clothing suggestions
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

            // Add user's preferences to the recommendation
            outfit += `, ${userPreferences} style`;

            // Add rain-specific clothing suggestions
            if (isRaining) {
                outfit += ', umbrella, raincoat, waterproof shoes';
            }

            setRecommendation(outfit);
        };

        handleRecommendation();
    }, [weather, isRaining, userPreferences]);

    return (
        <div>
            {/* <h2>Outfit Suggestion</h2> */}
            <div>
                <p>{recommendation}</p>
            </div>
        </div>
    );
};

export default OutfitSuggestion;
