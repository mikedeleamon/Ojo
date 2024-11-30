import React from 'react';
import Sunny from '../../assets/images/weatherIcons/Sunny.png';
import '../../App.css';
import styles from './Loading.module.css';

const Loading: React.FC = () => {
    return (
        <div className={styles.loadMargin}>
            <img
                src={Sunny}
                alt='Loading'
                className='App-logo'
            />
            <h1 className='display-4'>Loading</h1>
        </div>
    );
};

export default Loading;
