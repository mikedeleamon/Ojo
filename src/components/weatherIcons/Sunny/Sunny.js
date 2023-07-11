import React from 'react'
import sunny from '../../../assets/images/weatherIcons/Sunny.png'

const Sunny = ({className}) => {
    return(
        <div>
            <img src = {sunny} alt = {"Sunny"} className = {className}></img>
        </div>
        )
}

export default Sunny