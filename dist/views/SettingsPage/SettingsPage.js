import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import '../../App.css';
import styles from './SettingsPage.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
const SettingsPage = ({ onSaveSettings }) => {
    const [clothingStyle, setClothingStyle] = useState('Casual');
    const [location, setLocation] = useState('New York');
    const [temperatureScale, setTemperatureScale] = useState('Imperial');
    const [hiTempThreshold, setHiTempThreshold] = useState(50);
    const [lowTempThreshold, setLowTempThreshold] = useState(50);
    const [humidityPreference, setHumidityPreference] = useState(50);
    const navigate = useNavigate();
    const handleSave = async () => {
        const newSettings = {
            clothingStyle,
            location,
            temperatureScale,
            hiTempThreshold,
            lowTempThreshold,
            humidityPreference,
        };
        try {
            await axios.post('/save-settings', newSettings);
        }
        catch (e) {
            console.log('error');
        }
        finally {
            navigate('/');
        }
    };
    const onClose = () => {
        navigate('/');
    };
    return (_jsxs("div", { className: 'App', children: [_jsx("div", { className: styles.closeButtonContainer, children: _jsx(CloseButton, { onClose: onClose, className: styles.closeButton }) }), _jsx("div", { className: 'mt-5', children: _jsx("h2", { className: 'text-white p-4', children: "Settings" }) }), _jsxs("div", { className: `${styles.sliderContainer} mb-4`, children: [_jsx("label", { children: "Preferred Clothing Style:" }), _jsxs("select", { className: 'form-control', value: clothingStyle, onChange: (e) => setClothingStyle(e.target.value), children: [_jsx("option", { children: "Business Casual" }), _jsx("option", { children: "Formal" }), _jsx("option", { children: "Urban" }), _jsx("option", { children: "Cozy" }), _jsx("option", { children: "Preppy" })] })] }), _jsx("div", { className: `${styles.sliderContainer} mb-4`, children: _jsxs("label", { children: ["Location:", _jsx("input", { className: 'form-control', type: 'text', value: location, onChange: (e) => setLocation(e.target.value) })] }) }), _jsxs("div", { className: `${styles.sliderContainer} mb-5`, children: [_jsxs("div", { className: 'btn-group btn-group-toggle', "data-toggle": 'buttons', children: [_jsxs("label", { className: `btn btn-secondary ${temperatureScale === 'Imperial' ? 'active' : ''}`, children: [_jsx("input", { type: 'radio', name: 'options', value: 'Imperial', onClick: () => setTemperatureScale('Imperial'), checked: temperatureScale === 'Imperial', readOnly: true }), "Imperial"] }), _jsxs("label", { className: `btn btn-secondary ${temperatureScale === 'Metric' ? 'active' : ''}`, children: [_jsx("input", { type: 'radio', name: 'options', value: 'Metric', onClick: () => setTemperatureScale('Metric'), checked: temperatureScale === 'Metric', readOnly: true }), "Metric"] })] }), _jsx("div", { className: 'mb-2', children: _jsxs("label", { children: ["Hot Weather Preference: ", `${hiTempThreshold}\u00B0`, _jsx("input", { className: 'form-range', type: 'range', min: '0', max: '100', value: hiTempThreshold, onChange: (e) => setHiTempThreshold(Number(e.target.value)) })] }) }), _jsx("div", { className: 'mb-2', children: _jsxs("label", { children: ["Cold Weather Preference: ", `${lowTempThreshold}\u00B0`, _jsx("input", { className: 'form-range', type: 'range', min: '0', max: '100', value: lowTempThreshold, onChange: (e) => setLowTempThreshold(Number(e.target.value)) })] }) }), _jsx("div", { className: 'mb-2', children: _jsxs("label", { children: ["Humidity Preference: ", humidityPreference, "%", _jsx("input", { className: 'form-range', type: 'range', min: '0', max: '100', value: humidityPreference, onChange: (e) => setHumidityPreference(Number(e.target.value)) })] }) })] }), _jsx("button", { type: 'button', onClick: handleSave, className: 'col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4', children: "Save" })] }));
};
export default SettingsPage;
