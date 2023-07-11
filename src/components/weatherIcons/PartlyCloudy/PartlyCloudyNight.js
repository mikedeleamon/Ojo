import React from 'react'
import partlyCloudyNight from '../../../assets/images/weatherIcons/PartlyCloudyNight.png'

const PartlyCloudyNight = ({className}) => {
    return(
        <div>
            <img src = {partlyCloudyNight} alt = {"Partly Cloudy"} className = {className}></img>
        </div>
        )
}

export default PartlyCloudyNight