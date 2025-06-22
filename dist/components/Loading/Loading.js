import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Sunny from '../../assets/images/weatherIcons/Sunny.png';
import '../../App.css';
import styles from './Loading.module.css';
const Loading = () => {
    return (_jsxs("div", { className: styles.loadMargin, children: [_jsx("img", { src: Sunny, alt: 'Loading', className: 'App-logo' }), _jsx("h1", { className: 'display-4', children: "Loading" })] }));
};
export default Loading;
