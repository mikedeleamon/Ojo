import React from 'react'
import darkModeLogo from '../../../assets/images/logos/ojoLogo.png'

const OjoLogoDark = ({className}) => {
    return(
        <div>
            <img src = {darkModeLogo} alt = {"Ojo Logo"} className = {className}></img>
        </div>
        )
}

export default OjoLogoDark