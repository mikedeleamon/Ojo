import { useNavigate } from 'react-router-dom';
import styles from './ClosetButton.module.css';

const ClosetButton = () => {
  const navigate = useNavigate();
  return (
    <button className={styles.btn} onClick={() => navigate('/closet')} aria-label='My Closet'>
      {/* Hanger icon */}
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
};

export default ClosetButton;
