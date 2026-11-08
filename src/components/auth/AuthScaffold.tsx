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
import { useFoldLayout } from '../../context/FoldLayoutContext';
import { BrandPane } from '../layout/BrandPane';

interface Props {
    children: ReactNode;
    /** Vertically center the content (use for short single-card screens). */
    centered?: boolean;
    contentStyle?: StyleProp<ViewStyle>;
    /** Shown under the logo in the brand pane when two panes fit. */
    brandExtra?: ReactNode;
}

/**
 * Standard auth-screen shell: SafeAreaView → KeyboardAvoidingView → ScrollView.
 * Previously copy-pasted into all four auth screens.
 */
export default function AuthScaffold({ children, centered, contentStyle, brandExtra }: Props) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);
    const { mode } = useFoldLayout();
    const twoPane = mode === 'two-pane';
    return (
        <SafeAreaView
            style={[styles.root, twoPane && { flexDirection: 'row' }]}
            edges={twoPane ? ['right'] : undefined}
        >
            {twoPane && <BrandPane>{brandExtra}</BrandPane>}
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
