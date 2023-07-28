import React,{Component} from 'react';
import {Image,TouchableOpacity, Text, StyleSheet,View} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

export default class HumidityPreferencesScreen extends Component{
	constructor(props){
		super(props)
		this.state = {
            hotLimit: 85,
            coldLimit: 67,
            humiditySetting: false
		} 
    }
    static navigationOptions = {
        // headerTitle instead of title
        header:null
        
      };


 render(){
     const {navigate} = this.props.navigation;
     return(
         <LinearGradient colors = {["#86FF8A","#FFF119"]} style = {WeatherPreferenceStyle.container}>
             <View style= {WeatherPreferenceStyle.card}>
                 <Text style ={WeatherPreferenceStyle.text}>
                     Do you like it when it is humid?
                 </Text>
                 <TouchableOpacity 
                    onPress={()=> navigate('MainPage')}
                    style = {WeatherPreferenceStyle.SubmitButton}>
                       
                     <Text>Yes</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                    onPress={()=> navigate('MainPage')}
                    style = {WeatherPreferenceStyle.SubmitButton}>
                       
                     <Text>No</Text>
                 </TouchableOpacity>
                
                 <TouchableOpacity 
                    onPress={()=> navigate('MainPage')}
                    style = {WeatherPreferenceStyle.SubmitButton}>
                       
                     <Text>skip</Text>
                 </TouchableOpacity>
                 
             </View>
         </LinearGradient>
     )
 }


}

const WeatherPreferenceStyle = StyleSheet.create({
    container:{
		justifyContent: 'center',
		alignItems: 'center',
		flex:1
    },
    image:{
		height: 50,
		width: 50,
		justifyContent: 'center',
		alignItems: 'center'
	},
	text:{
		fontSize: 14,
		//color: '#fff',
		textAlign:'center',
		alignItems: 'center'
    },
    card:{
		backgroundColor: 'white',
        borderRadius: 22,
        padding:30,
        alignItems: 'center'
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
})