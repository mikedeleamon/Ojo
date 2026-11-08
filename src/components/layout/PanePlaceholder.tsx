import { StyleSheet, Text, View } from 'react-native';
import OjoLogoIcon from '../icons/OjoLogoIcon';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, spacing } from '../../theme/tokens';

/**
 * What a detail pane shows when there's nothing to put in it yet (an empty
 * closet, no trips): the logo and one line on what will appear, so the pane
 * beside the list never reads as broken.
 */
export function PanePlaceholder({ message }: { message: string }) {
    const { colors } = useTheme();
    return (
        <View style={styles.root}>
            <OjoLogoIcon decorative />
            <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    root: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
    },
    message: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        textAlign: 'center',
    },
});
