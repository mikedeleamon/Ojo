// //functions to help with logic

// import {weatherIcons,weatherGradients} from "./weatherIcons"
// import moment from "../../node_modules/moment";

// //dertermine what PNG will render
// export function determineWeatherFrame(weatherCondition){
// 	var weatherPNG;
// 	switch(weatherCondition){
// 		case "Clear":
// 			weatherPNG = weatherIcons.Sunny
// 			break;

// 		case "Thunderstorm":
// 			weatherPNG = weatherIcons.Storm
// 			break;

// 		case "Clouds":
// 			weatherPNG = weatherIcons.Cloudy
// 			break;

// 		case "Rain":
// 			weatherPNG = weatherIcons.Rainy
// 			break;

// 		case "Drizzle":
// 			weatherPNG = weatherIcons.Rainy

// 		case "Snow":
// 			weatherPNG = weatherIcons.Snow
// 			break;
		
// 		case "Mist":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Smoke":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Haze":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Dust":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Fog":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Sand":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Ash":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Squall":
// 			weatherPNG = weatherIcons.Mist
// 			break;

// 		case "Tornado":
// 			weatherPNG = weatherIcons.Mist
// 			break;
// 	}
	
// 	return  weatherPNG
// }

// //determines the gradinent used based on the weather condition
// export function determineWeatherGradient(weatherCondition){
// 	var gradient;
	

// 	switch(weatherCondition){
// 		case "Clear":
// 			gradient = weatherGradients.Sunny
// 			break;

// 		case "Thunderstorm":
// 			gradient = weatherGradients.Sunny
// 			break;

// 		case "Clouds":
// 			gradient = weatherGradients.Cloudy
// 			break;

// 		case "Rain":
// 			gradient = weatherGradients.Rainy
// 			break;

// 		case "Drizzle":
// 			gradient = weatherGradients.Rainy
// 			break;

// 		case "Snow":
// 			gradient = weatherGradients.Snow
// 			break;
		
// 		case "Mist":
// 			gradient = weatherGradients.Mist
// 			break;

// 		case "Smoke":
// 			gradient = weatherGradients.Sunny
// 			break;

// 		case "Haze":
// 			gradient = weatherGradients.Mist
// 			break;

// 		case "Dust":
// 			gradient = weatherGradients.Sunny
// 			break;

// 		case "Fog":
// 			gradient = weatherGradients.Cloudy
// 			break;

// 		case "Sand":
// 			gradient = weatherGradients.Sunny
// 			break;

// 		case "Ash":
// 			gradient = weatherGradients.Sunny
// 			break;

// 		case "Squall":
// 			gradient = weatherGradients.Sunny
// 			break;

// 		case "Tornado":
// 			gradient = weatherGradients.Sunny
// 			break;
// 	}
 
// 	return gradient

// }

// //determines if it is day or night. returns string
// export function isDay(sunrise,sunset,currentTime){

// 	if(currentTime == null){
// 		var currentTime = moment().unix() * 1000
// 	}
// 	else{
// 		var currentTime = currentTime
// 	}
// 	//var dawn = sunset.add()
// 	var dusk = moment(sunset).minutes(85).utc() * 1000;
// 	var dawn = moment(sunrise).minutes(-85).utc() *1000
// 	var sunrise = moment(sunrise).utc() * 1000 //unix timestamp
// 	var sunset = moment(sunset).utc() * 1000 // unix timestamp
	
// 	//console.log(currentTime)
// 	//console.log(sunrise)
// 	//console.log(sunset)
// 	//console.log(dawn)
// 	//console.log(dusk)
	
// 	if (currentTime > sunrise && currentTime < sunset){
// 		//console.log()
// 		return "DayTime"
// 	}
// 	if(dawn <= currentTime && currentTime<= sunrise){
// 		return "Dawn"
// 		}
// 	if(sunset <= currentTime && currentTime <= dawn){
// 		return "Dusk"
// 		}

// 	return "Night"
// 	}
