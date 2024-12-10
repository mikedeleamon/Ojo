import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignupPage.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';

interface SignupPageProps {
    setLoggedIn: (value: boolean) => void;
}

const SignupPage = ({ setLoggedIn }: SignupPageProps) => {
    const navigate = useNavigate();

    const navigateToLoginPage = () => {
        setLoggedIn(false);
        navigate('/');
    };

    const onClose = () => {
        navigate('/');
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
            <div className='form-group mb-4'>
                <label htmlFor='firstName'>
                    First Name
                    <input
                        type='text'
                        className='form-control'
                        id='formGroupExampleInput'
                        placeholder='John'
                    />
                </label>
            </div>
            <div className='form-group mb-4'>
                <label htmlFor='lastName'>
                    Last Name
                    <input
                        type='text'
                        className='form-control'
                        id='formGroupExampleInput'
                        placeholder='Weatherspoon'
                    />
                </label>
            </div>
            <div className='form-group mb-4'>
                <label htmlFor='dob'>
                    Date of Birth
                    <input
                        type='text'
                        className='form-control'
                        id='formGroupExampleInput'
                        placeholder='MM/DD/YYYY'
                    />
                </label>
            </div>
            <div className='form-group mb-4'>
                <label htmlFor='email'>
                    Email
                    <input
                        type='text'
                        className='form-control'
                        id='formGroupExampleInput'
                        placeholder='youremail@example.com'
                    />
                </label>
            </div>
            <div className='form-group mb-4'>
                <label htmlFor='username'>
                    Username
                    <input
                        type='text'
                        className='form-control'
                        id='formGroupExampleInput'
                        placeholder='@Weatherspoon123'
                    />
                </label>
            </div>
            <div className='form-group mb-4'>
                <label htmlFor='password'>
                    Password
                    <input
                        type='password'
                        className='form-control'
                        id='formGroupExampleInput'
                    />
                </label>
            </div>
            <div className='form-group mb-4'>
                <label htmlFor='passwordConfirm'>
                    Confirm Password
                    <input
                        type='password'
                        className='form-control'
                        id='formGroupExampleInput'
                    />
                </label>
            </div>
            <button
                type='submit'
                className='col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4'
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
