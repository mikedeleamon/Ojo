import { jsx as _jsx } from "react/jsx-runtime";
import SettingsIcon from '../../Icons/SettingsIcon/SettingsIcon';
import { useNavigate } from 'react-router-dom';
const SettingsButton = () => {
    const navigate = useNavigate();
    const navigateToSettings = () => {
        navigate('/settings');
    };
    return (_jsx("button", { type: 'button', className: 'btn btn-outline text-white', onClick: navigateToSettings, children: _jsx(SettingsIcon, {}) }));
};
export default SettingsButton;
