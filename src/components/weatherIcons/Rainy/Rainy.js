import React from 'react'
import rainy from '../../../assets/images/weatherIcons/Rainy.png'

const Rainy = ({className}) => {
    return(
        <div>
            <img src = {rainy} alt = {"Rainy"} className = {className}></img>
        </div>
        )
}

export default Rainy