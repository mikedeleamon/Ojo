import React from "react";
import OjoLogoLight from "../../components/logos/OjoLogoLight/OjoLogoLight";
import styles from './LoginPage.module.css';
import { useNavigate } from 'react-router-dom';

const LoginPage = ({setLoggedIn}) => {
    const navigate = useNavigate();

    const navigateToPage = () => {
        setLoggedIn(true)
        navigate('/');
    };
    const navigateToSignupPage = () => {
        navigate('/signup')
    }

    return (
        <div className={`${styles.center} mt-5`}>
            <OjoLogoLight className="currentWeatherLogo " />

            <div className="col-8 col-sm-4 col-lg-2">
                <input type="email" className="form-control" aria-describedby="emailHelp" placeholder="Username" />
            </div>

            <div className="col-8 col-sm-4 col-lg-2">
                <input type="password" className="form-control mt-3" placeholder="Password" />
            </div>

            <button onClick={navigateToPage} type="submit" className="col-8 col-sm-4 col-lg-2 btn btn-block btn-secondary mt-4">Submit</button>

            <p className= {`${styles.blkText} mt-2`}>Don't have an account? <a onClick={navigateToSignupPage}>Sign Up</a></p>
        </div>
    );
}

export default LoginPage;
