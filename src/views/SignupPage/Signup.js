import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignupPage.module.css';
import CloseButton from '../../components/buttons/CloseButton/CloseButton';

const SignupPage = ({ setLoggedIn }) => {
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
            {/* <article> */}
            <div class='form-group mb-4'>
                <label for='firstName'>
                    First Name
                    <input
                        type='text'
                        class='form-control '
                        id='formGroupExampleInput'
                        placeholder='John'
                    />
                </label>
            </div>
            <div class='form-group mb-4'>
                <label for='lastName'>
                    Last Name
                    <input
                        type='text'
                        class='form-control '
                        id='formGroupExampleInput'
                        placeholder='Weatherspoon'
                    />
                </label>
            </div>
            <div class='form-group mb-4'>
                <label for='dob'>
                    Date of Birth
                    <input
                        type='text'
                        class='form-control '
                        id='formGroupExampleInput'
                        placeholder='MM/DD/YYYY'
                    />
                </label>
            </div>
            <div class='form-group mb-4'>
                <label for='email'>
                    Email
                    <input
                        type='text'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder='Weatherspoon'
                    />
                </label>
            </div>
            <div class='form-group mb-4'>
                <label for='username'>
                    Username
                    <input
                        type='text'
                        class='form-control '
                        id='formGroupExampleInput'
                        placeholder='@Weatherspoon123'
                    />
                </label>
            </div>
            <div class='form-group mb-4'>
                <label for='password'>
                    Password
                    <input
                        type='password'
                        class='form-control '
                        id='formGroupExampleInput'
                        placeholder=''
                    />
                </label>
            </div>
            <div class='form-group mb-4'>
                <label for='passwordConfirm'>
                    Confirm Password
                    <input
                        type='password'
                        class='form-control '
                        id='formGroupExampleInput'
                        placeholder=''
                    />
                </label>
            </div>
            {/* </article> */}
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
