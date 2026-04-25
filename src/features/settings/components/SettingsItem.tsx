import { View, Text, Pressable } from '../../../components/primitives';
import { styles } from './SettingsItem.styles';
import { Svg, Path } from 'react-native-svg';
import { colors } from '../../../theme/tokens';

interface Props {
  label:     string;
  sublabel?: string;
  onPress:   () => void;
  right?:    React.ReactNode;
  disabled?: boolean;
}

const Chevron = () => (
  <Svg width={14} height={14} viewBox="0 0 14 14" fill="none">
    <Path d="M5 2l5 5-5 5" stroke={colors.textSecondary} strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
  </Svg>
);

const SettingsItem = ({ label, sublabel, onPress, right, disabled = false }: Props) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={({ pressed }) => [
      styles.row,
      disabled && styles.disabled,
      pressed && !disabled && { opacity: 0.7 },
    ]}
    accessibilityLabel={label}
  >
    <Text style={styles.label}>{label}</Text>
    <View style={styles.right}>
      {sublabel ? <Text style={styles.sublabel} numberOfLines={1}>{sublabel}</Text> : null}
      {right ?? <Chevron />}
    </View>
  </Pressable>
);

export default SettingsItem;
