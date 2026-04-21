import { useNavigate } from 'react-router-dom';
import styles from './ScreenShell.module.css';

interface Props {
  title:     string;
  children:  React.ReactNode;
  /**
   * When true the shell header is hidden — used when this screen is rendered
   * inline inside the desktop sidebar layout (the sidebar itself provides nav).
   *
   * React Native migration: delete this component entirely and configure the
   * header via Stack.Screen options in React Navigation.
   */
  embedded?: boolean;
}

const ScreenShell = ({ title, children, embedded = false }: Props) => {
  const navigate = useNavigate();

  return (
    <div className={`${styles.root} ${embedded ? styles.embedded : ''}`}>
      {!embedded && (
        <header className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate(-1)} aria-label="Back">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M11 14l-5-5 5-5" stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <h1 className={styles.title}>{title}</h1>
        </header>
      )}
      <div className={`${styles.content} ${embedded ? styles.embeddedContent : ''}`}>
        {children}
      </div>
    </div>
  );
};

export default ScreenShell;
