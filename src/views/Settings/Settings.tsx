import React, { useState } from 'react';
import '../../App.css';
import styles from './Settings.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';
import { useNavigate } from 'react-router-dom';

interface SettingsProps {
    onSaveSettings: (settings: {
        clothingStyle: string;
        location: string;
        // Add more properties for additional settings as needed
    }) => void;
}

const Settings: React.FC<SettingsProps> = ({ onSaveSettings }) => {
    const [clothingStyle, setClothingStyle] = useState<string>('Casual');
    const [location, setLocation] = useState<string>('New York');
    const [hiTemp, setHiTemp] = useState<number>(50);
    const [lowTemp, setLowTemp] = useState<number>(50);
    const [humidityPreference, setHumidityPreference] = useState<number>(50);

    const navigate = useNavigate();

    const handleSave = () => {
        const settings = {
            clothingStyle,
            location,
            // Add other settings to the object as needed
        };

        // Pass the settings object to the parent component (e.g., App.tsx)
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
                    className='btn-group btn-group-toggle'
                    data-toggle='buttons'
                >
                    <label className='btn btn-secondary active'>
                        <input
                            type='radio'
                            name='options'
                            id='Imperialoption1'
                            autoComplete='off'
                            defaultChecked
                        />
                        Imperial
                    </label>
                    <label className='btn btn-secondary'>
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
                            onChange={(e) => setHiTemp(Number(e.target.value))}
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
                            onChange={(e) => setLowTemp(Number(e.target.value))}
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
                                setHumidityPreference(Number(e.target.value))
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
