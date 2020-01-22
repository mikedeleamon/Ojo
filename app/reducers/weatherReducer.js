import {WEATHER_CHANGE} from '../constants'

const initialWeather = {
    Weather : 'Sunny'
}

const weatherReducer =(state = initialWeather, action ) => {
    switch(action.type){
        case WEATHER_CHANGE:
            return{
                ...state,
                weather:action.payload
            };
            default: 
            return state;
    }
}

export default weatherReducer;