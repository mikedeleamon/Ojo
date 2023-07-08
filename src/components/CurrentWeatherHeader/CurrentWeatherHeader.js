import React from 'react';
//import moment from "../../node_modules/moment";
// import weatherIcons from "./weatherIcons"
// import {determineWeatherFrame} from "./weatherHelper"
import './CurrentWeatherHeader.css'


const CurrentWeatherHeader = ({cityName,weatherCondition}) =>{

	return(

		<div>
			<p >{cityName}</p>
			<p>{weatherCondition}</p>
		</div>

	)
}
export default CurrentWeatherHeader

