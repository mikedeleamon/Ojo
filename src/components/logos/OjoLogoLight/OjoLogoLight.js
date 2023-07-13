import React from 'react'
import lightModeLogo from '../../../assets/images/logos/Ojo word logo 2.png'

const OjoLogoLight = ({className}) => {
    return(
        <div>
            <img src = {lightModeLogo} alt = {"Ojo Logo"} className = {className}></img>
        </div>
        )
}

export default OjoLogoLight