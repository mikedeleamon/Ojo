import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import styles from './CurrentWeatherHeader.module.css';
const CurrentWeatherHeader = ({ cityName, weatherCondition, }) => {
    return (_jsxs("div", { children: [_jsx("h2", { className: styles.text, children: cityName }), _jsx("p", { className: `${styles.mt0} ${styles.text}`, children: weatherCondition })] }));
};
export default CurrentWeatherHeader;
