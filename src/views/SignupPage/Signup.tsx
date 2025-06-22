import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignupPage.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';
import axios from 'axios';
import FormInput from '../../components/inputs/FormInput/FormInput';
import { formatDate } from '../../helpers/formatTools.js';

interface SignupPageProps {
    setLoggedIn: (value: boolean) => void;
}

const SignupPage = ({ setLoggedIn }: SignupPageProps) => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthday, setBirthday] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [error, setError] = useState<string | null>(null);

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
        } catch (error) {
            console.error('ERRRRRRROOOORRRRRRR:', error);
            setError('Failed to register. Please try again later.');
        }
    };

    return (
        <div className={'App'}>
            <div className={styles.closeButtonContainer}>
                <CloseButton
                    onClose={onClose}
                    className={styles.closeButton}
                />
            </div>
            <div className='mt-5'>
                <h1 className={'text-white p-4'}>Sign Up</h1>
            </div>
            {error && <p className='text-danger'>{error}</p>}
            <FormInput
                label='First Name'
                type='text'
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder='John'
                id='firstName'
            />
            <FormInput
                label='Last Name'
                type='text'
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder='Weatherspoon'
                id='lastName'
            />
            <FormInput
                label='Date of Birth'
                type='text'
                value={birthday}
                onChange={(e) => setBirthday(formatDate(e))}
                placeholder='MM/DD/YYYY'
                id='dob'
            />
            <FormInput
                label='Email'
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder='youremail@example.com'
                id='email'
            />
            <FormInput
                label='Username'
                type='text'
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder='@Weatherspoon123'
                id='username'
            />
            <FormInput
                label='Password'
                type='password'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                id='password'
            />
            <FormInput
                label='Confirm Password'
                type='password'
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                id='passwordConfirm'
            />
            <button
                type='submit'
                className='col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4'
                onClick={onSubmit}
            >
                Submit
            </button>
            <div>
                <p className={`${styles.blkText} mt-2`}>
                    Have an account?{' '}
                    <a
                        className={styles.blueText}
                        onClick={navigateToLoginPage}
                    >
                        Sign in
                    </a>
                </p>
            </div>
        </div>
    );
};

export default SignupPage;
