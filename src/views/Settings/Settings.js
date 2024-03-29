import React, { useState } from 'react';
import '../../App.css';
import styles from './Settings.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';
import { useNavigate } from 'react-router-dom';

const Settings = ({ onSaveSettings }) => {
    const [clothingStyle, setClothingStyle] = useState('Casual');
    const [location, setLocation] = useState('New York');
    const [hiTemp, setHiTemp] = useState(50);
    const [lowTemp, setLowTemp] = useState(50);
    const [humidityPreference, setHumidityPreference] = useState(50);
    // Add more state variables for other settings as needed
    const navigate = useNavigate();

    const handleSave = () => {
        const settings = {
            clothingStyle,
            location,
            // Add other settings to the object as needed
        };

        // Pass the settings object to the parent component (e.g., App.js)
        onSaveSettings(settings);
    };

    const onClose = () => {
        navigate('/');
    };

    return (
        <div className='App'>
            <div className={styles.closeButtonContainer}>
                <CloseButton
                    onClose={onClose}
                    className={styles.closeButton}
                />
            </div>
            <div className='mt-5'>
                <h2 className='text-white p-4'>Settings</h2>
            </div>

            <div className={`${styles.sliderContainer} mb-4`}>
                <label>Preferred Clothing Style:</label>
                <select
                    className='form-control'
                    value={clothingStyle}
                    onChange={(e) => setClothingStyle(e.target.value)}
                >
                    <option>Business Casual</option>
                    <option>Formal</option>
                    <option>Urban</option>
                    <option>Cozy</option>
                    <option>Preppy</option>
                </select>
            </div>
            <div className={`${styles.sliderContainer} mb-4`}>
                <label>
                    Location:
                    <input
                        className='form-control'
                        type='text'
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                </label>
            </div>

            <div className={`${styles.sliderContainer} mb-5`}>
                <div
                    class='btn-group btn-group-toggle'
                    data-toggle='buttons'
                >
                    <label class='btn btn-secondary active'>
                        <input
                            type='radio'
                            name='options'
                            id='Imperialoption1'
                            autoComplete='off'
                            checked
                        />
                        Imperial
                    </label>
                    <label class='btn btn-secondary'>
                        <input
                            type='radio'
                            name='options'
                            id='Metricoption2'
                            autoComplete='off'
                        />
                        Metric
                    </label>
                </div>

                <div className='mb-2'>
                    <label>
                        Hot Weather Preference: {`${hiTemp}\u00B0`}
                        <input
                            className='form-range'
                            type='range'
                            min='0'
                            max='100'
                            value={hiTemp}
                            onChange={(e) => setHiTemp(e.target.value)}
                        />
                    </label>
                </div>
                <div className='mb-2'>
                    <label>
                        Cold Weather Preference: {`${lowTemp}\u00B0`}
                        <input
                            className='form-range'
                            type='range'
                            min='0'
                            max='100'
                            value={lowTemp}
                            onChange={(e) => setLowTemp(e.target.value)}
                        />
                    </label>
                </div>
                <div className='mb-2'>
                    <label>
                        Humidity Preference: {humidityPreference}
                        <input
                            className='form-range'
                            type='range'
                            min='0'
                            max='100'
                            value={humidityPreference}
                            onChange={(e) =>
                                setHumidityPreference(e.target.value)
                            }
                        />
                    </label>
                </div>
            </div>

            {/* Add more input fields for other settings as needed */}
            <button
                type='button'
                onClick={handleSave}
                className='col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4'
            >
                Save
            </button>
        </div>
    );
};

export default Settings;
