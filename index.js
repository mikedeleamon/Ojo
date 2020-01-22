/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import {Provider} from 'react-redux';
//this will pass the store into the app when redux is ready

//import configureStore from './store/configureStore';

//const store = configureStore()

// const RNReduxStore = () => (
//     <Provider>
//         <App/>
//     </Provider>
// )

AppRegistry.registerComponent(appName, () => App);
//use when app is ready for redux
//AppRegistry.registerComponent(appName, () => RNRedux);
