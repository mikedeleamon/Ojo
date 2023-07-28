import React, { useState } from 'react';
import '../../App.css';
import styles from './Settings.module.css';

const Settings = ({ onSaveSettings }) => {
    const [clothingStyle, setClothingStyle] = useState('Casual');
    const [location, setLocation] = useState('New York');
    // Add more state variables for other settings as needed

    const handleSave = () => {
        const settings = {
            clothingStyle,
            location,
            // Add other settings to the object as needed
        };

        // Pass the settings object to the parent component (e.g., App.js)
        onSaveSettings(settings);
    };

    return (
        <div className='App'>
            <h2>Settings</h2>
            <div>
                <label>
                    Preferred Clothing Style:
                    <input
                        type='text'
                        value={clothingStyle}
                        onChange={(e) => setClothingStyle(e.target.value)}
                    />
                </label>
            </div>
            <div>
                <label>
                    Location:
                    <input
                        type='text'
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                </label>
            </div>
            <div>
                <label>
                    Preferred Clothing Style: {clothingStyle}
                    <input
                        type='range'
                        min='0'
                        max='100'
                        value={clothingStyle}
                        onChange={(e) => setClothingStyle(e.target.value)}
                    />
                </label>
            </div>
            <div>
                <label>
                    Location: {location}
                    <input
                        type='range'
                        min='0'
                        max='100'
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                </label>
            </div>
            {/* Add more input fields for other settings as needed */}
            <button onClick={handleSave}>Save</button>
        </div>
    );
};

export default Settings;
