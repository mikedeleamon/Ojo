/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */


import {createAppContainer } from "react-navigation";
import {createStackNavigator} from "react-navigation-stack";
//import { createDrawerNavigator } from 'react-navigation-drawer';
import Login from "./app/views/Login";
import Signup from "./app/views/Signup";
import MainPage from "./app/views/MainPage";
import SignupWelcomeScreen from "./app/views/SignupWelcomeScreen"
import HotWeatherPreferencesScreen from "./app/views/HotWeatherPreferencesScreen"
import ColdWeatherPreferencesScreen from "./app/views/ColdWeatherPreferencesScreen"
import HumidityPreferencesScreen from "./app/views/HumidityPreferencesScreen"

//import { connect } from 'react-redux';

const MainNavigator = createStackNavigator({
  Login: {screen: Login},
  Signup: {screen: Signup},
  MainPage: {screen: MainPage},
  SignupWelcomeScreen: {screen: SignupWelcomeScreen},
  HotWeatherPreferencesScreen: {screen: HotWeatherPreferencesScreen},
  ColdWeatherPreferencesScreen: {screen: ColdWeatherPreferencesScreen},
  HumidityPreferencesScreen: {screen: HumidityPreferencesScreen}
});

const App = createAppContainer(MainNavigator);

export default App;

// use when APP is ready to store state w/ redux
//export default connect(mapStateToProps, mapDispatchToProps)(App)