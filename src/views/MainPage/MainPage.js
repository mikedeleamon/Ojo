import React, { useEffect, useState } from 'react';
import '../../App.css'
import WeatherHUD from "../../components/WeatherHUD/WeatherHUD";
import Loading from "../../components/Loading/Loading";

const MainPage = () => {
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    const [isLoading,setIsLoading] = useState(true)
    const location = `${latitude},${longitude}`

    useEffect(() => {
      // Use the Geolocation API to get the current location
        navigator.geolocation.getCurrentPosition(
        (position) => {
            setLatitude(position.coords.latitude);
            setLongitude(position.coords.longitude);
            setIsLoading(false)
        },
        (error) => {
            console.error('Error getting location:', error);
        }
        );
    }, []);

    return (
        isLoading ? <Loading/> :(
        <div className="App">
            <WeatherHUD location={location}/>
        </div>)
    );
}
export default MainPage