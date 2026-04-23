import { useAppNavigation } from '../../../hooks/useAppNavigation';
import styles from './AccountButton.module.css';

const AccountButton = () => {
  const nav = useAppNavigation();
  return (
    <button className={styles.btn} onClick={() => nav.push('/account')} aria-label='Account'>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  );
};

export default AccountButton;
