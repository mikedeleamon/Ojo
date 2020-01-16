import React,{Component} from 'react';
import {Image, Text, ScrollView, StyleSheet, TouchOpacity, ActivityIndicator,View} from 'react-native';
import moment from "../../node_modules/moment";
import {weatherIcons} from "./weatherIcons"
import {determineWeatherFrame} from "./weatherHelper"
//AccuWeather vs. OpenWeatherMap vs. DarkSky

export default class CurrentWeather extends Component{
	constructor(props){
		super(props)
		this.state = {
			
		} 
	}


render(){
		//MAKE COMPONENT RENDER PROPERLY BASED ON PROPS PASSED
		//create code block for component, if array is not passed, render 1 
		//if array passed render array of components
		

		if (typeof this.props.Temperature != 'object' && typeof this.props.WeatherCondition != 'object'){
		return(
			
				<View style = {CurrentWeatherStyle.View}>
					<Image style = {CurrentWeatherStyle.image} source={determineWeatherFrame(this.props.WeatherCondition)}/>
					<Text style = {CurrentWeatherStyle.text}> {Math.round(this.props.Temperature) + '\u00B0'}</Text>
					
				</View>
	
			)
	}else{
		//render the array
		const temperatures = this.props.Temperature
		const conditions = this.props.WeatherCondition
		const times = this.props.Time

		forcastConditions = conditions.map((condition, index) => 
				<View style={forcastWeatherStyle.view}>
					<Text key = {"time" + index} style = {forcastWeatherStyle.text}> {moment(times[index]*1000).format("ha")} </Text>
					<Image key = {"condition" + index} style = {forcastWeatherStyle.image} source={determineWeatherFrame(condition)}/>
					<Text key = {"temperature"+index} style = {forcastWeatherStyle.text}> {Math.round(temperatures[index]) + '\u00B0'}</Text>
				</View>
			);

		return(
			<View>
				<ScrollView horizontal={true}>{forcastConditions}</ScrollView>
			</View>
			)
		}


	}

};

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
	
	view:{
		//borderTopWidth:3,
		borderBottomWidth: 3,
		borderColor:"#fff",
		
        
	},
	image:{
		height: 60,
		width: 60,
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