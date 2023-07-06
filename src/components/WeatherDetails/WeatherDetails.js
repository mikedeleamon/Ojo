import React, { useEffect ,useState } from "react";
import axios from "axios";
import '../../App.css'
import { isDisabled } from "@testing-library/user-event/dist/utils";

//Component Responsible for showing temperature, wind direction, AQ and humidity and feels like details
//takes in a weather object 

export const WeatherDetails = () => {
const [temperature,setTemperature] = useState ('')
const [windSpeed,setWindSpeed] = useState ('')
const [humidity,setHumidity] = useState('')
const [uvIndex, setUvIndex] = useState('')
const [feelsLike, setFeelsLike] = useState ('')
    useEffect(()=>{
        const getWeatherInfo = async () =>{
            await axios.get(`https://dataservice.accuweather.com/currentconditions/v1/349727?&apikey=cGUHq7oSsi9m3l8s0tUrwHipm9H1PAoq&details=true`)
            .then(response => {
                console.log(response)
                setTemperature(response.data[0].Temperature.Imperial.Value)
                setWindSpeed(response.data[0].Wind.Speed.Imperial.Value)
                setHumidity(response.data[0].RelativeHumidity)
                setUvIndex(response.data[0].UVIndexText)
                setFeelsLike(response.data[0].RealFeelTemperature.Imperial.Value)

            })
            .catch(error => {
                console.log('Error fetching weather data:', error);
            });
        }
        getWeatherInfo()
        },[])
    // useEffect(()=>{
    //     console.log(`axios is currently is Disabled`)
    //     setTemperature('70')
    //     setWindSpeed('6')
    //     setHumidity(28)
    //     setFeelsLike('68')
    // },[])
    return(
        <div>
            <p>temperature: {temperature} F </p>
            <p>wind speed: {windSpeed} mi/h</p>
            {/* <p>Air Quality:</p> */}
            <p>UV Index: {uvIndex}</p>
            <p>humidity: {humidity}</p>
            <p>feels like: {feelsLike} F</p>
        </div>
    )
}