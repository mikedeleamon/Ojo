import React,{Component} from 'react';
import {Image, Text, StyleSheet, TouchOpacity, ActivityIndicator,View} from 'react-native';
//import moment from "../../node_modules/moment";
import weatherIcons from "./weatherIcons"
import {determineWeatherFrame} from "./weatherHelper"


export default class CurrentWeatherHeader extends Component{
	constructor(props){
		super(props)
		this.state = {}
	}

	render(){
		//const {navigate} = this.props.navigation;
		
		return(
			
				<View style = {this.props.style}>
					<Text style = {CurrentWeatherStyle.text}>{this.props.cityName}</Text>
					<Text style = {CurrentWeatherStyle.text}>{this.props.WeatherCondition}</Text>
				</View>
	
			)
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