import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignupPage.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';
import axios from 'axios';
import FormInput from '../../components/inputs/FormInput/FormInput';
import { formatDate } from '../../helpers/formatTools.js';
const SignupPage = ({ setLoggedIn }) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthday, setBirthday] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const navigateToLoginPage = () => {
        setLoggedIn(false);
        navigate('/');
    };
    const onClose = () => {
        navigate('/');
    };
    const onSubmit = async () => {
        if (password !== passwordConfirmation) {
            setError('Passwords do not match');
            return;
        }
        const userInfo = {
            firstName,
            lastName,
            birthday,
            email,
            username,
            password,
        };
        console.log(userInfo);
        try {
            await axios.post('/add-user', userInfo);
            setLoggedIn(true);
            navigate('/');
        }
        catch (error) {
            console.error('ERRRRRRROOOORRRRRRR:', error);
            setError('Failed to register. Please try again later.');
        }
    };
    return (_jsxs("div", { className: 'App', children: [_jsx("div", { className: styles.closeButtonContainer, children: _jsx(CloseButton, { onClose: onClose, className: styles.closeButton }) }), _jsx("div", { className: 'mt-5', children: _jsx("h1", { className: 'text-white p-4', children: "Sign Up" }) }), error && _jsx("p", { className: 'text-danger', children: error }), _jsx(FormInput, { label: 'First Name', type: 'text', value: firstName, onChange: (e) => setFirstName(e.target.value), placeholder: 'John', id: 'firstName' }), _jsx(FormInput, { label: 'Last Name', type: 'text', value: lastName, onChange: (e) => setLastName(e.target.value), placeholder: 'Weatherspoon', id: 'lastName' }), _jsx(FormInput, { label: 'Date of Birth', type: 'text', value: birthday, onChange: (e) => setBirthday(formatDate(e)), placeholder: 'MM/DD/YYYY', id: 'dob' }), _jsx(FormInput, { label: 'Email', type: 'email', value: email, onChange: (e) => setEmail(e.target.value), placeholder: 'youremail@example.com', id: 'email' }), _jsx(FormInput, { label: 'Username', type: 'text', value: username, onChange: (e) => setUsername(e.target.value), placeholder: '@Weatherspoon123', id: 'username' }), _jsx(FormInput, { label: 'Password', type: 'password', value: password, onChange: (e) => setPassword(e.target.value), id: 'password' }), _jsx(FormInput, { label: 'Confirm Password', type: 'password', value: passwordConfirmation, onChange: (e) => setPasswordConfirmation(e.target.value), id: 'passwordConfirm' }), _jsx("button", { type: 'submit', className: 'col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4', onClick: onSubmit, children: "Submit" }), _jsx("div", { children: _jsxs("p", { className: `${styles.blkText} mt-2`, children: ["Have an account?", ' ', _jsx("a", { className: styles.blueText, onClick: navigateToLoginPage, children: "Sign in" })] }) })] }));
};
export default SignupPage;
