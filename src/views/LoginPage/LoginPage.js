import React from "react";
import OjoLogoLight from "../../components/logos/OjoLogoLight/OjoLogoLight";
import styles from './LoginPage.module.css'
const LoginPage = () => {
    return(
        <div className={styles.center}>
            <OjoLogoLight className="currentWeatherLogo" />


                <div className="col-8 col-sm-4">
                <input type="email" className=" form-control" aria-describedby="emailHelp" placeholder="Username" />
                </div>
                <div className="col-8 col-sm-4">
                <input type="password" className="  form-control mt-3" placeholder="Password" />
                </div>
                <button type="submit" className="col-8 col-sm-4 btn btn-block btn-secondary mt-4">Submit</button>

            </div>
        );
}

export default LoginPage;