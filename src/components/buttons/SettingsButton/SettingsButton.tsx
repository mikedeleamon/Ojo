import { useNavigate } from 'react-router-dom';
import styles from './SettingsButton.module.css';

const SettingsButton = () => {
  const navigate = useNavigate();
  return (
    <button className={styles.btn} onClick={() => navigate('/settings')} aria-label='Settings'>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M16.17 10c0-.28.02-.55.05-.83l1.8-1.4a.43.43 0 00.1-.55l-1.7-2.95a.43.43 0 00-.53-.19l-2.12.85c-.44-.34-.91-.63-1.42-.85l-.32-2.26A.42.42 0 0011.6 1.5H8.4a.42.42 0 00-.42.37L7.66 4.1c-.5.22-.98.51-1.42.85l-2.12-.85a.43.43 0 00-.53.19L1.88 7.22a.42.42 0 00.1.55l1.8 1.4A6.6 6.6 0 003.73 10c0 .28-.02.55-.05.83l-1.8 1.4a.43.43 0 00-.1.55l1.7 2.95c.11.2.34.28.53.19l2.12-.85c.44.34.91.63 1.42.85l.32 2.26c.05.22.25.37.47.37h3.2c.22 0 .42-.15.47-.37l.32-2.26c.5-.22.98-.51 1.42-.85l2.12.85a.43.43 0 00.53-.19l1.7-2.95a.42.42 0 00-.1-.55l-1.8-1.4c.03-.28.05-.55.05-.83z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
};

export default SettingsButton;
