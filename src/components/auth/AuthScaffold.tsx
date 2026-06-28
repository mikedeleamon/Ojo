import { ReactNode, useMemo } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleProp,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../theme/ThemeContext';
import { makeAuthStyles } from './authStyles';

interface Props {
    children: ReactNode;
    /** Vertically center the content (use for short single-card screens). */
    centered?: boolean;
    contentStyle?: StyleProp<ViewStyle>;
}

/**
 * Standard auth-screen shell: SafeAreaView → KeyboardAvoidingView → ScrollView.
 * Previously copy-pasted into all four auth screens.
 */
export default function AuthScaffold({ children, centered, contentStyle }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);
    return (
        <SafeAreaView style={styles.root}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={[
                        styles.content,
                        centered && styles.contentCentered,
                        contentStyle,
                    ]}
                    keyboardShouldPersistTaps="handled"
                >
                    {children}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
