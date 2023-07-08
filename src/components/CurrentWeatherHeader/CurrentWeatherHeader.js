import React from 'react';
//import moment from "../../node_modules/moment";
// import weatherIcons from "./weatherIcons"
// import {determineWeatherFrame} from "./weatherHelper"
import styles from './CurrentWeatherHeader.module.css'


const CurrentWeatherHeader = ({cityName,weatherCondition}) =>{

	return(

		<div>
			<h2 className={styles.text}>{cityName}</h2>
			<p className={`${styles.mt0} ${styles.text}`}>{weatherCondition}</p>
		</div>

	)
}
export default CurrentWeatherHeader

