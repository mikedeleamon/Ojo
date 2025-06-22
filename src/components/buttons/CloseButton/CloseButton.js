import React from 'react';
import CancelIcon from '../../Icons/CloseIcon/CancelIcon.js';
//import { useNavigate } from 'react-router-dom';

const CloseButton = ({ onClose, className }) => {
    // const navigate = useNavigate();

    // const navigateToSettings = ({onClose}) => {
    //     navigate('/settings');
    // };

    return (
        <button
            type='button'
            className={`${className} btn btn-outline text-white`}
            onClick={onClose}
        >
            <CancelIcon />
        </button>
    );
};

export default CloseButton;
