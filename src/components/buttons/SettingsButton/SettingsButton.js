import React from 'react';
import SettingsIcon from '../../Icons/SettingsIcon/SettingsIcon';
import { useNavigate } from 'react-router-dom';

const SettingsButton = () => {
    const navigate = useNavigate();

    const navigateToSettings = () => {
        navigate('/settings');
    };

    return (
        <button
            type='button'
            className='btn btn-outline text-white'
            onClick={navigateToSettings}
        >
            <SettingsIcon />
        </button>
    );
};

export default SettingsButton;
