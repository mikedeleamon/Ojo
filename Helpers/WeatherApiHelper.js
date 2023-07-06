import moment from "../../node_modules/moment"
import {isDay} from "../../app/components/weatherHelper"
//ALL WEATHER INFORMATION WILL BE CALLED HERE

export  function getWeatherData(longitude,latitude){
  
  const city = "Baton+Rouge,USA" 
  const fahrenheit = "Imperial"
  const celcius = "Metric"
  const API_KEY = "911f0795f1324b87410d0076a1366412";
  const old_key = "d6543057824be2fa9a5df26e79dba8d2"
  let currentCall = `http://api.openweathermap.org/data/2.5/weather?lon=${longitude}&lat=${latitude}&APPID=${old_key}&units=${fahrenheit}` 
  let forecastCall = `http://api.openweathermap.org/data/2.5/forecast?lon=${longitude}&lat=${latitude}&APPID=${old_key}&units=${fahrenheit}`
  var currentTime = moment().unix() * 1000
  var aDayLater = currentTime + 86400000
  //console.log(currentCall + '\n' + '\n' + forecastCall)
  
let currentWeather = fetch(currentCall).then((response) => response.json()).then((responseJson)=>
    {
      //console.log(responseJson)
      
      var SunriseDate = responseJson.sys.sunrise//moment(SunriseDate).unix().format("dddd, MMMM Do YYYY, h:mm:ss a")
      var SunsetDate = responseJson.sys.sunset//moment(SunsetDate).unix().format("dddd, MMMM Do YYYY, h:mm:ss a")
      var timeOfDay = isDay(SunriseDate, SunsetDate, currentTime)
      return{ 
        longitude: longitude,
        latitude: latitude,
        cityName: responseJson.name,
        currentWeatherCondition: responseJson.weather[0].main,
        currentTemperature: responseJson.main.temp,
        currentFeelsLike:"",
        currentHumidity:responseJson.main.humidity,
        currentWindSpeed:responseJson.wind.speed,
        currentPecipitation:"",
        currentVisibility:responseJson.visibility,
        currentAirQuality:"",
        currentSunrise:SunriseDate,
        currentSunset:SunsetDate,
        currentAirQualityIndex:"",
        currentPressure: responseJson.main.pressure,
        Day: timeOfDay
        }
    });
     // fetches hour forcast
    let hourForcast = fetch(forecastCall).then((response) => response.json()).then((responseJson)=>
      {
        //console.log(responseJson)

        let forcastTime = []
        let forcastWeather = []
        let forcastWeatherDetail = []
        let forcastTemp = []
        let forcastHumidity = []
        let forcastPressure = []
        let forcastWindSpeed = []


        for (var i = 0; i < responseJson.cnt; i++){
          //check if that time has passed. if past, break: else, .push() to array
          if(currentTime < moment.unix(responseJson.list[i].dt)._i && moment.unix(responseJson.list[i].dt)._i < aDayLater){
            
            forcastTime.push(responseJson.list[i].dt)
            
            forcastWeather.push(responseJson.list[i].weather[0].main)
            
            forcastWeatherDetail.push(responseJson.list[i].weather[0].description)
            forcastTemp.push(responseJson.list[i].main.temp)
            forcastHumidity.push(responseJson.list[i].main.humidity)
            forcastPressure.push(responseJson.list[i].main.pressure)
            forcastWindSpeed.push(responseJson.list[i].wind.speed)
          
          }
        }// end of loop

        return {
          forcastTime ,
          forcastWeather ,
          forcastWeatherDetail ,
          forcastTemp ,
          forcastHumidity ,
          forcastPressure ,
          forcastWindSpeed 
            }
      }) 
     // returns Api Data into an object
     return Promise.all([currentWeather, hourForcast])
    .then((responses) => {
      let weatherData = {};
      console.log(responses)
      responses.forEach((response) => {
        weatherData = Object.assign(weatherData, response);
      });
      console.log(weatherData)
      return weatherData;
    });
  }

 

