import { createStore, combineReducers } from 'redux';
import weatherReducer from '../app/reducers/weatherReducer';


//reducers go in here
const rootReducer = combineReducers(
{ weather: weatherReducer }
);

//creates store to form global state
const configureStore = () => {
return createStore(rootReducer);
}
export default configureStore;