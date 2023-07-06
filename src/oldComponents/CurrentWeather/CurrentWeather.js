import React from 'react';
import moment from "../../node_modules/moment";
import {weatherIcons} from "./weatherIcons"
import {determineWeatherFrame} from "./weatherHelper"
import  './CurrentWeather.css'
//AccuWeather vs. OpenWeatherMap vs. DarkSky

export default  CurrentWeather = (temperature,condition,time) => {
	
	const temperatures = temperature
		const conditions = condition
		const times = time



		//MAKE COMPONENT RENDER PROPERLY BASED ON PROPS PASSED
		//create code block for component, if array is not passed, render 1 
		//if array passed render array of components

return(
<>
		{ typeof temperature != 'object' ? (

				<div className = {'forecast-container'}>
					<image className = {'forecast-image'} source={determineWeatherFrame(condition)}/>
					<p className = {'forecast-text'}> {Math.round(temperature) + '\u00B0'}</p>
				</div>
):(
		//render the array


		{ conditions.map((weatherCondition, index) => {
				<div style={'forcastWeatherStyle'}>
					<p key = {"time" + index} style = {forcastWeatherStyle.text}> {moment(times[index]*1000).format("ha")} </p>
					<image key = {"condition" + index} style = {forcastWeatherStyle.image} source={determineWeatherFrame(weatherCondition)}/>
					<p key = {"temperature"+index} style = {forcastWeatherStyle.text}> {Math.round(temperatures[index]) + '\u00B0'}</p>
				</div>
		}
		)
		}
	)}


</>


)}