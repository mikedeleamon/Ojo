import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import OjoLogoLight from '../../components/logos/OjoLogoLight/OjoLogoLight';
import styles from './LoginPage.module.css';
import { useNavigate } from 'react-router-dom';
const LoginPage = ({ setLoggedIn }) => {
    const navigate = useNavigate();
    const navigateToPage = () => {
        setLoggedIn(true);
        navigate('/');
    };
    const navigateToSignupPage = () => {
        navigate('/signup');
    };
    return (_jsxs("div", { className: `${styles.center} mt-5`, children: [_jsx(OjoLogoLight, { className: 'currentWeatherLogo' }), _jsx("div", { className: 'col-8 col-sm-4 col-lg-2', children: _jsx("input", { type: 'email', className: 'form-control', "aria-describedby": 'emailHelp', placeholder: 'Username' }) }), _jsx("div", { className: 'col-8 col-sm-4 col-lg-2', children: _jsx("input", { type: 'password', className: 'form-control mt-3', placeholder: 'Password' }) }), _jsx("button", { onClick: navigateToPage, type: 'submit', className: 'col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4', children: "Submit" }), _jsxs("p", { className: `${styles.blkText} mt-2`, children: ["Don't have an account?", ' ', _jsx("a", { className: styles.blueText, onClick: navigateToSignupPage, children: "Sign Up" })] })] }));
};
export default LoginPage;
