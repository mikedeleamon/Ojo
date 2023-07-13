import React, { Component } from 'react';
import {  Text ,TextInput,TouchableOpacity, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
export default class Signup extends Component{
	constructor(props){
		super(props);
		this.state={
			FirstName: "",
			LastName: "",
			Username: "",
			DoB: "",
			Password: "",
			Email: ""
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
      //headerTitle instead of title
    	header:null
    
   };

render(){
		const {navigate} = this.props.navigation;
		return(
			<LinearGradient colors = {["#86FF8A","#FFF119"]} style={SignupStyle.container}>
			<View style = {SignupStyle.card}>
			<Text style = {SignupStyle.headerText}>Sign Up</Text>
				<TextInput placeholder = "First Name" style={SignupStyle.infoField} value = {this.state.FirstName}
				onChangeText={(FirstName) => this.setState({FirstName})}/>


				<TextInput placeholder = "Last Name" style={SignupStyle.infoField} value = {this.state.LastName}
				onChangeText={(LastName) => this.setState({LastName})}/>

				<TextInput placeholder = "Date of Birth" style={SignupStyle.infoField} value = {this.state.DoB}
				onChangeText={(DoB) => this.setState({DoB})}/>

				<TextInput placeholder = "Username" style={SignupStyle.infoField} value = {this.state.Username}
				onChangeText={(Username) => this.setState({Username})}/>

				<TextInput placeholder = "Password" style={SignupStyle.infoField} value = {this.state.Password}
				onChangeText={(Password) => this.setState({Password})}/>
				<TextInput placeholder = "Email" style={SignupStyle.infoField} value = {this.state.Email}
				onChangeText={(Email) => this.setState({Email})}/>

				<TouchableOpacity
		        
					onPress={() => navigate('SignupWelcomeScreen')}
					style={SignupStyle.SubmitButton}
					underlayColor='#fff'>
          				<Text>Submit</Text>
				</TouchableOpacity>
			</View>
			</LinearGradient>
			)
	}
};


const SignupStyle = StyleSheet.create({

	container:{
		justifyContent: 'center',
		alignItems: 'center',
		flex:1
	},
	infoField: {
        width:250,
        height:40,
  		fontSize:14,
		marginHorizontal:20,
  		marginVertical:15,
        borderBottomWidth: 3,
        //borderBottomStartRadius:20,
        //borderBottomEndRadius:20,
		borderBottomColor: 'gray',
		
        
	},
	card:{
		backgroundColor: 'white',
		borderRadius: 22,
		padding:30,
		alignItems: 'center'
	},
	headerText:{
		fontSize:24,
		fontWeight:"bold",
		color: "#aaa"
	},
    SubmitButton: {
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
    }
});