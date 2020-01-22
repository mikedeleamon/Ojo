import {WEATHER_CHANGE} from '../constants'

export function changeWeather(weather){
    return {
        type: WEATHER_CHANGE,
        payload: WeatherCondition
    }
}
