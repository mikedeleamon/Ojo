import cloudy from '../../../assets/images/weatherIcons/Cloudy.png'
import React from 'react'

const Cloudy = ({className}) => {
    return(
        <div>
            <img src = {cloudy} alt = {"Cloudy"} className = {className}></img>
        </div>
        )
}

export default Cloudy