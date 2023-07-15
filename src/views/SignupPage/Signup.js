import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignupPage.module.css'

const SignupPage = () => {
    const navigate = useNavigate();
    return (
        <div className={`big-weather-width ${styles.left} mt-5`}>
            <h1>Sign Up</h1>
            <article>
                <div class='form-group'>
                    <label for='firstName'>First Name</label>
                    <input
                        type='text'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder='John'
                    ></input>
                </div>
                <div class='form-group'>
                    <label for='lastName'>Last Name</label>
                    <input
                        type='text'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder='Weatherspoon'
                    ></input>
                </div>
                <div class='form-group'>
                    <label for='dob'>Date of Birth</label>
                    <input
                        type='text'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder='MM/DD/YYYY'
                    ></input>
                </div>
                <div class='form-group'>
                    <label for='email'>Email</label>
                    <input
                        type='text'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder='Weatherspoon'
                    ></input>
                </div>
                <div class='form-group'>
                    <label for='username'>Username</label>
                    <input
                        type='text'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder='@Weatherspoon123'
                    ></input>
                </div>
                <div class='form-group'>
                    <label for='password'>Password</label>
                    <input
                        type='password'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder=''
                    ></input>
                </div>
                <div class='form-group'>
                    <label for='passwordConfirm'>Confirm Password</label>
                    <input
                        type='password'
                        class='form-control'
                        id='formGroupExampleInput'
                        placeholder=''
                    ></input>
                </div>
            </article>
            <button type="submit" className="col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4">Submit</button>
        </div>
    );
};
export default SignupPage;
