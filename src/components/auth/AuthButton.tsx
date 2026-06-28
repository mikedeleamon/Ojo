import { useMemo } from 'react';
import { Text, Pressable } from '../primitives';
import { useTheme } from '../../theme/ThemeContext';
import { makeAuthStyles } from './authStyles';

interface Props {
    label: string;
    /** Label shown while loading; defaults to `label`. */
    loadingLabel?: string;
    loading?: boolean;
    disabled?: boolean;
    onPress: () => void;
}

/** Primary auth submit button with the shared loading/disabled treatment. */
export default function AuthButton({
    label,
    loadingLabel,
    loading,
    disabled,
    onPress,
}: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);
    const isDisabled = !!loading || !!disabled;
    const shown = loading ? loadingLabel ?? label : label;
    return (
        <Pressable
            style={[styles.btn, isDisabled && { opacity: 0.5 }]}
            onPress={onPress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={shown}
            accessibilityState={{ busy: !!loading, disabled: isDisabled }}
        >
            <Text style={styles.btnText}>{shown}</Text>
        </Pressable>
    );
}
