import React, { useState } from 'react';

const OutfitSuggestion = () => {
    const [temperatureFahrenheit, setTemperatureFahrenheit] = useState('');
    const [isRaining, setIsRaining] = useState(false);
    const [userPreferences, setUserPreferences] = useState('');
    const [recommendation, setRecommendation] = useState('');

    const handleRecommendation = () => {
        // Convert Fahrenheit to Celsius
        const temperatureCelsius =
            (parseFloat(temperatureFahrenheit) - 32) * (5 / 9);

        // Temperature-based clothing suggestions
        let outfit = '';
        if (temperatureCelsius < 5) {
            outfit =
                'Very Cold: Heavy winter coat, gloves, hat, scarf, warm layers';
        } else if (temperatureCelsius < 15) {
            outfit = 'Cold: Jacket, sweater, long pants';
        } else if (temperatureCelsius < 25) {
            outfit = 'Mild: Light jacket, long sleeves, jeans or trousers';
        } else {
            outfit = 'Hot: T-shirt, shorts or skirt';
        }

        // Add rain-specific clothing suggestions
        if (isRaining) {
            outfit += ', umbrella, raincoat, waterproof shoes';
        }

        // Add user's preferences to the recommendation
        outfit += `, ${userPreferences} style`;

        setRecommendation(outfit);
    };

    return (
        <div>
            <h2>Outfit Suggestion</h2>
            <div>
                <label>
                    Temperature (in Fahrenheit):
                    <input
                        type='number'
                        value={temperatureFahrenheit}
                        onChange={(e) =>
                            setTemperatureFahrenheit(e.target.value)
                        }
                    />
                </label>
            </div>
            <div>
                <label>
                    Is it raining?
                    <input
                        type='checkbox'
                        checked={isRaining}
                        onChange={(e) => setIsRaining(e.target.checked)}
                    />
                </label>
            </div>
            <div>
                <label>
                    Clothing Preferences:
                    <input
                        type='text'
                        value={userPreferences}
                        onChange={(e) => setUserPreferences(e.target.value)}
                    />
                </label>
            </div>
            <button onClick={handleRecommendation}>Get Recommendation</button>
            <div>
                <h3>Recommendation:</h3>
                <p>{recommendation}</p>
            </div>
        </div>
    );
};

export default OutfitSuggestion;
