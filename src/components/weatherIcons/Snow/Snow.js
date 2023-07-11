import React from 'react'
import snow from '../../../assets/images/weatherIcons/Snow.png'

const Snow = ({className}) => {
    return(
        <div>
            <img src = {snow} alt = {"Snow"} className = {className}></img>
        </div>
        )
}

export default Snow