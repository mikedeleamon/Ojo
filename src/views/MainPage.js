import React,{Component} from 'react';
import {AppRegistry,ScrollView,Image, Text, StyleSheet, ActivityIndicator,View} from 'react-native';
import {determineWeatherGradient} from "../../app/components/weatherHelper"
import {getWeatherData} from "../../app/Helpers/WeatherApiHelper"
//"../../" <- brings you back 2 folders
import Geolocation from '@react-native-community/geolocation';
import CurrentWeather from '../../app/components/CurrentWeather';
import CurrentWeatherHeader from '../../app/components/CurrentWeatherHeader';
import {changeWeather} from "../actions/weatherAction"
import {createAppContainer } from "react-navigation";
import {createStackNavigator} from "react-navigation-stack";
import LinearGradient from 'react-native-linear-gradient';
import { connect } from 'react-redux';

 class MainPage extends Component{
	constructor(props){
		super(props)
		this.state = {
			isLoading: false,
			cityName:"--",
			longitude:"",
			latitude:"",
			WeatherCondition:"",
			Temperature:"--",
			FeelsLike:"--",
			Humidity:"--",
			WindSpeed:"--",
			Pecipitation:"",
			Visibility:"",
			AirQuality:"",
			Sunrise:"",
			Sunset:"",
			AirQualityIndex:"",
			Pressure: "",
			Day:"",
			forcastWeather:[],
			forcastTemp:[],
			forcastTime:[]

		} 
	}
	static navigationOptions = {
    // headerTitle instead of title
    header:null,
  }

  //loads weather info before page is rendered
componentDidMount(){
	this.props.dispatch(changeWeather)

	//  Geolocation.getCurrentPosition(
	//  	position =>{
	// 		 console.log(position)
	// 		 //let longitude= parseFloat(position.coords.longitude)
	// 		 //let latitude = parseFloat(position.coords.latitude)
	// 	 getWeatherData(position.coords.longitude,position.coords.latitude).then((theWeather) => {
	// 	  console.log(theWeather)
	// 	  this.setState({
	// 		  	isLoading:true,
	// 		  	longitude:theWeather.longitude,
	// 			latitude:theWeather.latitude,
	// 		  	cityName: theWeather.cityName,
	// 		  	WeatherCondition: theWeather.currentWeatherCondition,
	// 		  	Temperature: theWeather.currentTemperature,
	// 				FeelsLike:"",
	// 				Humidity:theWeather.currentHumidity,
	// 				WindSpeed:theWeather.currentWindSpeed,
	// 				Pecipitation:"",
	// 				Visibility:theWeather.currentVisibility,
	// 				AirQuality:"",
	// 				Sunrise:theWeather.currentSunrise,
	// 				Sunset:theWeather.currentSunset,
	// 				AirQualityIndex:"",
	// 				Pressure: theWeather.Pressure,
	// 				forcastWeather:theWeather.forcastWeather,
	// 				forcastTemp:theWeather.forcastTemp,
	// 				forcastTime:theWeather.forcastTime,
	// 				Day:theWeather.Day
	// 		  	})
		  
	// 		  //console.log(determineWeatherGradient(this.state.weatherGradient))
			
	// 		 }) 
	// }, (error) => alert(error.message),
	//         {enableHighAccuracy: false, timeout: 20000, maximumAge: 1000})
	

}


render(){
	weatherTest = ['#1778c6', '#60A1D6', '#7EAEe7']
	
	var pal = determineWeatherGradient(this.state.WeatherCondition)
	//console.log(this.state.WeatherCondition)
	//console.log(pal)
	//console.log(this.state.forcastTemp.bind(this))
	//console.log(determineWeatherGradient(this.state.WeatherCondition))

	if(this.state.isLoading == true){
		console.log(this.state.forcastTemp)
		console.log(this.state.forcastWeather)
	return(

		<LinearGradient colors = {pal} style = {MainPageStyle.container} >
			<View style ={MainPageStyle.loadView} >
				<CurrentWeatherHeader cityName = {this.state.cityName} WeatherCondition = {this.state.WeatherCondition} />
				<CurrentWeather  Temperature = {this.state.Temperature} WeatherCondition = {this.state.WeatherCondition}/>
			</View>
			<View>
				<CurrentWeather Time ={this.state.forcastTime} Temperature = {this.state.forcastTemp} WeatherCondition = {this.state.forcastWeather}/>
			</View>
		</LinearGradient>
		)
	}else{
		return(
			<LinearGradient colors = {weatherTest} style = {MainPageStyle.container} >
				<View>
					<CurrentWeatherHeader cityName = {"Loading"} WeatherCondition = {"Please Wait"} />
					<Text>{"\n"}</Text>
					<ActivityIndicator size="large" color="#00f00f" />
					{/* <CurrentWeather Temperature = {this.state.Temperature} WeatherCondition = {this.state.WeatherCondition}/> */}
				</View>
				
			</LinearGradient>
			)
		}
	}
};

const mapStateToProps = (state) => {
	return {
	  loading: state.loading
	}
  }
  
  export default connect(mapStateToProps, null)(MainPage);

const MainPageStyle = StyleSheet.create({
	container:{
		justifyContent: 'center',
		alignItems: 'center',
		flex:1
	},
	scrollView:{
		height:100
	},
	loadView:{
		paddingTop:600,
		paddingBottom:20
	},

})

const CurrentWeatherStyle = StyleSheet.create({
	
	image:{
		height: 200,
		width: 200,
		justifyContent: 'center',
		alignItems: 'center'
	},
	text:{
		fontSize: 24,
		color: '#fff',
		textAlign:'center',
		alignItems: 'center'
	}
})

const forcastWeatherStyle = StyleSheet.create({
	
	image:{
		height: 50,
		width: 50,
		justifyContent: 'center',
		alignItems: 'center'
	},
	text:{
		fontSize: 10,
		color: '#fff',
		textAlign:'center',
		alignItems: 'center'
	}
})

  