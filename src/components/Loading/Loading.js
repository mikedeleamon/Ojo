import React from "react";
import Sunny from "../../assets/images/weatherIcons/Sunny.png";
import '../../App.css';
import styles from './Loading.module.css';

const Loading = () => {
    return (
        <div className={styles.loadMargin}>
            <img src={Sunny} alt="Loading" className={`App-logo`} />
            <h2>Loading</h2>
        </div>
    );
};

export default Loading;