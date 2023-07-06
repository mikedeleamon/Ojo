// import React,{Component} from 'react';
// import {View, Text, StyleSheet} from "react-native";
// import Slider from '@react-native-community/slider';
// import { NativeViewGestureHandler } from 'react-native-gesture-handler';

// export default class SliderOption extends Component{
//     constructor(props){
//         super(props)
//         this.state = {
//             value: 70
//         }
        
//     }
//     state = {
//         value: this.props.value,
//       };

//     render(){
//         return(
//             <View>
//                 <Text onValueChange = {value => this.setState({value: value})}>{this.state.value}</Text>
//                 <Slider style={SliderStyle.slider}
//                 minimumValue = {50}
//                 maximumValue = {115}
//                 onValueChange={value => this.setState({value: value})}
//                 step = {1}
//                 />
//             </View>
//         )
//     }
// }

// const SliderStyle = StyleSheet.create({
//     slider: {
//         width: 200,
//         height: 40,
//     },
//     text: {},
// })