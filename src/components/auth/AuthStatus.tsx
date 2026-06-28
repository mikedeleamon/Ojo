import { ReactNode, useMemo } from 'react';
import { View, Text } from '../primitives';
import { useTheme } from '../../theme/ThemeContext';
import { makeAuthStyles } from './authStyles';

interface Props {
    variant?: 'error' | 'success';
    /** Primary message line. Optional when only rendering children. */
    message?: string;
    /** Extra content rendered below the message (e.g. an action link). */
    children?: ReactNode;
}

/**
 * Accessible status banner for auth screens — red for errors, green for success.
 * Replaces the four hand-rolled errorBox/successBox blocks.
 */
export default function AuthStatus({ variant = 'error', message, children }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);
    const isSuccess = variant === 'success';
    return (
        <View
            style={isSuccess ? styles.successBox : styles.errorBox}
            accessible
            accessibilityLiveRegion={isSuccess ? 'polite' : 'assertive'}
            accessibilityLabel={message}
        >
            {message ? (
                <Text style={isSuccess ? styles.successText : styles.errorText}>
                    {message}
                </Text>
            ) : null}
            {children}
        </View>
    );
}
