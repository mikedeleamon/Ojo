import React from 'react'
import partlyCloudy from '../../../assets/images/weatherIcons/PartlyCloudy.png'

const PartlyCloudy = ({className}) => {
    return(
        <div>
            <img src = {partlyCloudy} alt = {"Partly Cloudy"} className = {className}></img>
        </div>
        )
}

export default PartlyCloudy