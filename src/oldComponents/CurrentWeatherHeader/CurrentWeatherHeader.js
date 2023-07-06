import React from 'react';
//import moment from "../../node_modules/moment";
// import weatherIcons from "./weatherIcons"
// import {determineWeatherFrame} from "./weatherHelper"
import './CurrentWeatherHeader.css'


const CurrentWeatherHeader = ({cityName,WeatherCondition}) =>{

	return(

		<div>
			<p >{cityName}</p>
			<p>{WeatherCondition}</p>
		</div>

	)
}
export default CurrentWeatherHeader

