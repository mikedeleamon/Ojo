import React, { useEffect, useState } from 'react';

const OutfitSuggestion = ({weather}) => {
    //const [temperatureFahrenheit, setTemperatureFahrenheit] = useState('');
    const [isRaining, setIsRaining] = useState(false);
    const [userPreferences, setUserPreferences] = useState('');
    const [recommendation, setRecommendation] = useState('');

    const handleRecommendation = () => {
        // Convert Fahrenheit to Celsius
        setIsRaining(weather[0].HasPrecipitation)
        const temperatureCelsius =
            (parseFloat(weather[0].Temperature.Imperial.Value) - 32) * (5 / 9);

        // Temperature-based clothing suggestions
        let outfit = '';
        if (temperatureCelsius < 5) {
            outfit +=
                'Very Cold: Heavy winter coat, gloves, hat, scarf, warm layers';
        } else if (temperatureCelsius < 15) {
            outfit += 'Cold: Jacket, sweater, long pants';
        } else if (temperatureCelsius < 25) {
            outfit += 'Mild: Light jacket, long sleeves, jeans or trousers';
        } else {
            outfit += 'Hot: T-shirt, shorts or skirt';
        }

        // Add rain-specific clothing suggestions
        if (isRaining) {
            outfit += ', umbrella, raincoat, waterproof shoes';
        }

        // Add user's preferences to the recommendation
        outfit += `, ${userPreferences} style`;

        setRecommendation(outfit);
    };

    useEffect(()=>{
        handleRecommendation()
    },[])

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
