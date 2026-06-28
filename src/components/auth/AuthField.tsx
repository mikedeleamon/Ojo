import { ReactNode, useMemo, useState } from 'react';
import { TextInputProps } from 'react-native';
import { View, Text, TextInput, Pressable } from '../primitives';
import { useTheme } from '../../theme/ThemeContext';
import { makeAuthStyles } from './authStyles';

interface Props extends TextInputProps {
    label: string;
    /** Field-level error message; also turns the input border red when set. */
    error?: string;
    /** Render a Show/Hide toggle that manages its own secureTextEntry state. */
    secureToggle?: boolean;
    /** Custom trailing element (e.g. a date "Pick" button). Ignored when secureToggle is set. */
    suffix?: ReactNode;
}

/**
 * Labeled text input with optional Show/Hide reveal toggle and inline error.
 * The reveal state lives here, so password screens no longer track it themselves.
 */
export default function AuthField({
    label,
    error,
    secureToggle,
    suffix,
    accessibilityLabel,
    ...inputProps
}: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);
    const [reveal, setReveal] = useState(false);

    return (
        <View style={styles.field}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.inputRow, !!error && styles.inputRowError]}>
                <TextInput
                    style={styles.input}
                    placeholderTextColor={colors.textMuted}
                    accessibilityLabel={accessibilityLabel ?? label}
                    secureTextEntry={secureToggle ? !reveal : inputProps.secureTextEntry}
                    {...inputProps}
                />
                {secureToggle ? (
                    <Pressable
                        style={styles.inputSuffix}
                        onPress={() => setReveal((r) => !r)}
                        accessibilityRole="button"
                        accessibilityLabel={reveal ? `Hide ${label}` : `Show ${label}`}
                    >
                        <Text style={styles.inputSuffixText}>
                            {reveal ? 'Hide' : 'Show'}
                        </Text>
                    </Pressable>
                ) : (
                    suffix
                )}
            </View>
            {error ? <Text style={styles.fieldError}>{error}</Text> : null}
        </View>
    );
}
