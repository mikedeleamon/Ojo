import React, { useState } from 'react';
import '../../App.css';
import styles from './SettingsPage.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

import { Settings } from '../../types';

interface SettingsProps {
    onSaveSettings: (settings: Settings) => void;
}

const SettingsPage = ({ onSaveSettings }: SettingsProps) => {
    const [clothingStyle, setClothingStyle] = useState<string>('Casual');
    const [location, setLocation] = useState<string>('New York');
    const [temperatureScale, setTemperatureScale] =
        useState<string>('Imperial');
    const [hiTempThreshold, setHiTempThreshold] = useState<number>(50);
    const [lowTempThreshold, setLowTempThreshold] = useState<number>(50);
    const [humidityPreference, setHumidityPreference] = useState<number>(50);

    const navigate = useNavigate();

    const handleSave = async () => {
        const newSettings: Settings = {
            clothingStyle,
            location,
            temperatureScale,
            hiTempThreshold,
            lowTempThreshold,
            humidityPreference,
        };
        try {
            await axios.post('/save-settings', newSettings);
        } catch (e) {
            console.log('error');
        } finally {
            navigate('/');
        }
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
                    <label
                        className={`btn btn-secondary ${
                            temperatureScale === 'Imperial' ? 'active' : ''
                        }`}
                    >
                        <input
                            type='radio'
                            name='options'
                            value='Imperial'
                            onClick={() => setTemperatureScale('Imperial')}
                            checked={temperatureScale === 'Imperial'}
                            readOnly
                        />
                        Imperial
                    </label>
                    <label
                        className={`btn btn-secondary ${
                            temperatureScale === 'Metric' ? 'active' : ''
                        }`}
                    >
                        <input
                            type='radio'
                            name='options'
                            value='Metric'
                            onClick={() => setTemperatureScale('Metric')}
                            checked={temperatureScale === 'Metric'}
                            readOnly
                        />
                        Metric
                    </label>
                </div>

                <div className='mb-2'>
                    <label>
                        Hot Weather Preference: {`${hiTempThreshold}\u00B0`}
                        <input
                            className='form-range'
                            type='range'
                            min='0'
                            max='100'
                            value={hiTempThreshold}
                            onChange={(e) =>
                                setHiTempThreshold(Number(e.target.value))
                            }
                        />
                    </label>
                </div>
                <div className='mb-2'>
                    <label>
                        Cold Weather Preference: {`${lowTempThreshold}\u00B0`}
                        <input
                            className='form-range'
                            type='range'
                            min='0'
                            max='100'
                            value={lowTempThreshold}
                            onChange={(e) =>
                                setLowTempThreshold(Number(e.target.value))
                            }
                        />
                    </label>
                </div>
                <div className='mb-2'>
                    <label>
                        Humidity Preference: {humidityPreference}%
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

export default SettingsPage;
