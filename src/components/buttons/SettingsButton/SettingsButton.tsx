import React from 'react';
import SettingsIcon from '../../Icons/SettingsIcon/SettingsIcon';
import { useNavigate } from 'react-router-dom';

const SettingsButton: React.FC = () => {
    const navigate = useNavigate();

    const navigateToSettings = (): void => {
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
