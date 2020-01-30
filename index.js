/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {Provider} from 'react-redux';



AppRegistry.registerComponent(appName, () => App);
//use when app is ready for redux
//AppRegistry.registerComponent(appName, () => RNRedux);
