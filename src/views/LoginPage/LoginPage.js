import React from "react";
import OjoLogoLight from "../../components/logos/OjoLogoLight/OjoLogoLight";
import styles from './LoginPage.module.css'
const LoginPage = () => {
    return(
    <div className={styles.center}>
        <OjoLogoLight className={'currentWeatherLogo'}/>
        <input type='text' placeholder="Username"></input>
        <input type="password" placeholder="Password"></input>
        <button>enter</button>
    </div>)
}
export default LoginPage