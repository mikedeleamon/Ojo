import React, { useEffect, useState } from 'react';

interface Preferences {
    coldThreshold: number;
    warmThreshold: number;
}

interface Props {
    preferences: Preferences;
}

const HomePage: React.FC<Props> = ({ preferences }) => {
    const [temperature, setTemperature] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchWeather = async (lat: number, lon: number) => {
            try {
                const response = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=cGUHq7oSsi9m3l8s0tUrwHipm9H1PAoq`
                );
                const data = await response.json();
                setTemperature(data.main.temp);
            } catch (err) {
                setError('Unable to fetch weather data.');
            }
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                fetchWeather(latitude, longitude);
            },
            () => setError('Location permission denied.')
        );
    }, []);

    const getBackgroundColor = () => {
        if (temperature === null) return 'lightgray';
        if (temperature < preferences.coldThreshold) return 'lightblue';
        if (temperature < preferences.warmThreshold) return 'lightgreen';
        return 'lightcoral';
    };

    const getOutfitSuggestion = () => {
        if (temperature === null) return 'Loading...';
        if (temperature < preferences.coldThreshold)
            return 'Wear a heavy jacket!';
        if (temperature < preferences.warmThreshold)
            return 'A light sweater will do.';
        return 'Shorts and a T-shirt are perfect!';
    };

    return (
        <div
            style={{
                backgroundColor: getBackgroundColor(),
                height: '100vh',
                padding: '20px',
            }}
        >
            {error ? (
                <p>{error}</p>
            ) : (
                <>
                    <h1>Ojo Weather App</h1>
                    <p>
                        Current Temperature:{' '}
                        {temperature !== null
                            ? `${temperature}°C`
                            : 'Loading...'}
                    </p>
                    <p>{getOutfitSuggestion()}</p>
                </>
            )}
        </div>
    );
};

export default HomePage;
