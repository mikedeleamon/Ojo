import { Pressable, View, Text } from '../../../components/primitives';
import styles from './SettingsItem.module.css';

interface Props {
  label:     string;
  sublabel?: string;
  onPress:   () => void;
  right?:    React.ReactNode;
  disabled?: boolean;
}

/**
 * A single settings row.
 *
 * React Native migration:
 *   Pressable → Pressable (react-native) — identical prop shape
 *   View      → View      (react-native)
 *   Text      → Text      (react-native)
 *   className → style={styles.x} via StyleSheet
 */
const SettingsItem = ({ label, sublabel, onPress, right, disabled = false }: Props) => (
  <Pressable
    onPress={onPress}
    style={`${styles.row} ${disabled ? styles.disabled : ''}`}
    disabled={disabled}
    accessibilityLabel={label}
  >
    <Text style={styles.label}>{label}</Text>

    <View style={styles.right}>
      {sublabel && <Text style={styles.sublabel}>{sublabel}</Text>}
      {right ?? (
        <svg className={styles.chevron} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </View>
  </Pressable>
);

export default SettingsItem;
