/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 * @flow
 */

 //RN imports
import * as React from 'React';
import {createAppContainer } from "react-navigation";
import {createStackNavigator} from "react-navigation-stack";
//import { createDrawerNavigator } from 'react-navigation-drawer';

//Imports of views
import Login from "./app/views/Login";
import Signup from "./app/views/Signup";
import MainPage from "./app/views/MainPage";
import SignupWelcomeScreen from "./app/views/SignupWelcomeScreen"
import HotWeatherPreferencesScreen from "./app/views/HotWeatherPreferencesScreen"
import ColdWeatherPreferencesScreen from "./app/views/ColdWeatherPreferencesScreen"
import HumidityPreferencesScreen from "./app/views/HumidityPreferencesScreen"

//redux imports
import { Provider,connect } from 'react-redux';
import configureStore from './store/configureStore';
import { createStore } from 'redux';

const StackNavigator = createStackNavigator({
  Login: {screen: Login},
  Signup: {screen: Signup},
  MainPage: {screen: MainPage},
  SignupWelcomeScreen: {screen: SignupWelcomeScreen},
  HotWeatherPreferencesScreen: {screen: HotWeatherPreferencesScreen},
  ColdWeatherPreferencesScreen: {screen: ColdWeatherPreferencesScreen},
  HumidityPreferencesScreen: {screen: HumidityPreferencesScreen}
});

const AppContainer = createAppContainer(StackNavigator);

//this will pass the store into the app when redux is ready
let store = configureStore()

export default class App extends React.Component {
  render() {
    return (
      <Provider store={store}>
        <AppContainer />
      </Provider>
    );
  }
}

// use when APP is ready to store state w/ redux
//export default connect(mapStateToProps, mapDispatchToProps)(App)