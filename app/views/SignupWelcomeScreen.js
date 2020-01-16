import React,{Component} from 'react';
import {Image,TouchableOpacity, Text, StyleSheet,View, } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {determineWeatherFrame} from "../../app/components/weatherHelper";
//import Mask from "react-native-mask";

export default class SignupWelcomeScreen extends Component{
	constructor(props){
		super(props)
		this.state = {
			
		} 
    }

    static navigationOptions = {
        // headerTitle instead of title
        header:null
        
      };

render(){
    const {navigate} = this.props.navigation
    return (
        <LinearGradient colors = {["#86FF8A","#FFF119"]} style = {WelcomeStyle.container}>
            <View style = {WelcomeStyle.card}>
				<Text style = {WelcomeStyle.headerText}>Getting Started</Text>
                	<Image style ={CurrentWeatherStyle.image} source={determineWeatherFrame("Clear")}/>
				
               
                <Text style ={CurrentWeatherStyle.text}>We're excited to help you figure out what to wear.</Text>
                <Text style ={CurrentWeatherStyle.text}>From extravagant outings to your day to day, we want to be there for you.</Text>
                <Text style ={CurrentWeatherStyle.text}> Swipe or click "Next" to get started </Text>
                
                <TouchableOpacity
                        onPress={() => navigate('HotWeatherPreferencesScreen')}
                        
                        style={WelcomeStyle.SubmitButton}
                        underlayColor='#fff'>
                        <Text>Next</Text>
                </TouchableOpacity>
                
            </View>
        </LinearGradient>
    )
}
}
const CurrentWeatherStyle = StyleSheet.create({
	
	image:{
		height: 200,
		width: 200,
		justifyContent: 'center',
		alignItems: 'center',
		tintColor: 'black'
	},
	text:{
		fontSize: 13,
		color: '#000',
		textAlign:'center',
		alignItems: 'center'
	}
})

const WelcomeStyle = StyleSheet.create({

	container:{
		justifyContent: 'center',
		alignItems: 'center',
		flex:1
	},
	text:{
		fontSize: 10,
		textAlign:'center',
		alignItems: 'center'
	},
	headerText:{
		fontSize:24,
		fontWeight:"bold",
		color: "#aaa"
	},
	card:{
		backgroundColor: 'white',
		borderRadius: 22,
		padding:30,
		alignItems: 'center',
		
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
	    marginVertical:10,
	    justifyContent: 'center',
	    alignItems: 'center'
	}
});