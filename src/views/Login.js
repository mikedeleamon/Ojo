import React, { Component } from 'react';
import { Alert, AppRegistry, Image , Text, TextInput, TouchableOpacity, Form, Button, StyleSheet, View } from 'react-native';
import {createAppContainer } from "react-navigation";
import {createStackNavigator} from "react-navigation-stack";

export default class Login extends Component{
	
//setting state for login credentials
	constructor(props){
		super(props);
		this.state={
			Username: "",
			Password: ""
		};
		this.handleChange = this.handleChange.bind(this);
    	this.handleSubmit = this.handleSubmit.bind(this);
	}

	handleChange(event) {
    this.setState({value: event.target.value});
  	}

	handleSubmit(event) {
	  alert('A name was submitted: ' + this.state.value);
	  event.preventDefault();
	}

	static navigationOptions = {
    // headerTitle instead of title
    header:null
    
  };

	render(){
		const {navigate} = this.props.navigation;
		return(
			
				<View style ={loginStyle.container}>
					<Image style = {loginStyle.image}source={require ('Ojo/app/assets/icons/OjoLogo.png')}/>
					<TextInput placeholder = "Username" style = {loginStyle.infoField} value = {this.state.Username}
					onChangeText={(Username)=>this.setState({Username})}/>

					<TextInput secureTextEntry={true} placeholder = "Password" style = {loginStyle.infoField} value = {this.state.Password}
					onChangeText={(Password)=>this.setState({Password})}/>

					<TouchableOpacity
						style={loginStyle.submitButton}
						//navigate to the main page and ipdate store
						onPress={() => navigate('MainPage')}
						underlayColor='#fff'>
					<Text>Login</Text>
					</TouchableOpacity>
					<TouchableOpacity
						
						onPress={() => navigate('Signup')}
						underlayColor='#fff'>
					<Text style={loginStyle.signUpButton}>new to Ojo? Sign Up</Text>
					</TouchableOpacity>
				</View>
			
			)
	}
}

const loginStyle = StyleSheet.create({
	container: {
	   flex: 1,
	   justifyContent: 'center',
	   alignItems: 'center'
  },
  image: {
  	//flex: 1,
    width: 200,
    height: 200,
    //marginLeft: 300,
     marginBottom: 8,
     //marginTop: 12,
    resizeMode: 'contain',
    alignItems: 'center'
  },
  	infoField:{

  		width: 300,
  		height:40,
  		fontSize:14,
  		textAlign: 'center',
  		borderRadius: 4,
  		backgroundColor: '#ddd',
  		marginVertical:8

  },
  	submitButton:{
  		width:180,
	  	marginRight:40,
	    marginLeft:40,
	    marginTop:10,
	    paddingTop:10,
	    paddingBottom:10,
	    backgroundColor:'#ddd',
	    borderRadius:22,
	    borderWidth: 1,
	    borderColor: '#ddd',
	    marginVertical:8,
	    justifyContent: 'center',
	    alignItems: 'center'
  	},
  	signUpButton:{
  		width:180,
  		//marginRight:40,
	    marginLeft:45,
	    //marginTop:10,
	    //paddingTop:10,
	    //paddingBottom:10,
	    marginVertical:22,
	    justifyContent: 'flex-end',
	    alignItems: 'center',
	    textDecorationLine: 'underline'
  	}

})