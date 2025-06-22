import React, { useState } from 'react';

interface Preferences {
    coldThreshold: number;
    warmThreshold: number;
}

interface Props {
    preferences: Preferences;
    setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
}

const SettingsPage: React.FC<Props> = ({ preferences, setPreferences }) => {
    const [coldThreshold, setColdThreshold] = useState(
        preferences.coldThreshold
    );
    const [warmThreshold, setWarmThreshold] = useState(
        preferences.warmThreshold
    );

    const handleSave = () => {
        setPreferences({ coldThreshold, warmThreshold });
        alert('Preferences updated!');
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Settings</h1>
            <label>
                Cold Threshold (°C):{' '}
                <input
                    type='number'
                    value={coldThreshold}
                    onChange={(e) => setColdThreshold(parseInt(e.target.value))}
                />
            </label>
            <br />
            <label>
                Warm Threshold (°C):{' '}
                <input
                    type='number'
                    value={warmThreshold}
                    onChange={(e) => setWarmThreshold(parseInt(e.target.value))}
                />
            </label>
            <br />
            <button onClick={handleSave}>Save</button>
        </div>
    );
};

export default SettingsPage;
