import { useMemo } from 'react';
import { View, Text, Pressable } from '../../../components/primitives';
import { makeStyles } from './SettingsItem.styles';
import { Svg, Path } from 'react-native-svg';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
  label:     string;
  sublabel?: string;
  onPress:   () => void;
  right?:    React.ReactNode;
  disabled?: boolean;
  isFirst?:  boolean;
}

const SettingsItem = ({ label, sublabel, onPress, right, disabled = false, isFirst = false }: Props) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const Chevron = () => (
    <Svg width={14} height={14} viewBox="0 0 14 14" fill="none"
      accessibilityElementsHidden={true}
      importantForAccessibility="no"
    >
      <Path d="M5 2l5 5-5 5" stroke={colors.textSecondary} strokeWidth={1.5}
        strokeLinecap="round" strokeLinejoin="round" opacity={0.4} />
    </Svg>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        isFirst && styles.rowFirst,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.7 },
      ]}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {sublabel ? <Text style={styles.sublabel} numberOfLines={1}>{sublabel}</Text> : null}
        {right ?? <Chevron />}
      </View>
    </Pressable>
  );
};

export default SettingsItem;
