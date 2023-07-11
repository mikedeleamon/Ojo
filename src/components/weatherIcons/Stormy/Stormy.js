import React from 'react'
import stormy from '../../../assets/images/weatherIcons/Storm.png'

const Stormy = ({className}) => {
    return(
        <div>
            <img src = {stormy} alt = {"Stormy"} className = {className}></img>
        </div>
        )
}

export default Stormy