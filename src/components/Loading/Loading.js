import React from "react";
import Sunny from "../../assets/images/weatherIcons/Sunny.png"
import '../../App.css'
import styles from './Loading.module.css'
const Loading = () => {
    return(<>
        <img src={Sunny} alt="Loading" className={`App-logo ${styles.loadMargin}`}></img>
        <h2>Loading</h2>
    </>
    )
}

export default Loading