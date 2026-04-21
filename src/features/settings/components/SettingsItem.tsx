import styles from './SettingsItem.module.css';

interface Props {
  label:     string;
  sublabel?: string;
  onPress:   () => void;
  /** Render a custom right element instead of a chevron (e.g. a toggle). */
  right?:    React.ReactNode;
  /** Visually mute the row — for unavailable features. */
  disabled?: boolean;
}

/**
 * A single settings row.
 *
 * React Native migration note:
 *   <button>      → <TouchableOpacity>
 *   className     → style / StyleSheet
 */
const SettingsItem = ({ label, sublabel, onPress, right, disabled = false }: Props) => (
  <button
    className={`${styles.row} ${disabled ? styles.disabled : ''}`}
    onClick={disabled ? undefined : onPress}
    aria-label={label}
    type="button"
  >
    <span className={styles.label}>{label}</span>

    <span className={styles.right}>
      {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
      {right ?? (
        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </span>
  </button>
);

export default SettingsItem;
