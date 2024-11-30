import React from 'react';
import styles from './CurrentWeatherHeader.module.css';

interface CurrentWeatherHeaderProps {
    cityName: string; // Name of the city
    weatherCondition: string; // Description of the current weather
}

const CurrentWeatherHeader: React.FC<CurrentWeatherHeaderProps> = ({
    cityName,
    weatherCondition,
}) => {
    return (
        <div>
            <h2 className={styles.text}>{cityName}</h2>
            <p className={`${styles.mt0} ${styles.text}`}>{weatherCondition}</p>
        </div>
    );
};

export default CurrentWeatherHeader;
