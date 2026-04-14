import Sunny from '../../assets/images/weatherIcons/Sunny.png';
import styles from './Loading.module.css';

const Loading = () => (
  <div className={styles.root}>
    <img src={Sunny} alt='Loading' className={styles.spin} />
    <p className={styles.label}>Loading</p>
  </div>
);

export default Loading;
