import React from 'react'
import clearNight from '../../../assets/images/weatherIcons/ClearNight.png'

const ClearNight = ({className}) => {
    return(
        <div>
            <img src = {clearNight} alt = {"Clear Night"} className = {className}></img>
        </div>
        )
}

export default ClearNight