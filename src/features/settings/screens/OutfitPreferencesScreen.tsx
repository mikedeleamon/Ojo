import { useState } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { StatusMessage } from '../../../components/shared';
import { useSettings } from '../../../hooks/useSettings';
import { useFormSubmit } from '../../../hooks/useFormSubmit';
import {
    colors,
    spacing,
    radius,
    fonts,
    fontSizes,
    fontWeights,
} from '../../../theme/tokens';

const STYLES = [
    'Casual',
    'Business Casual',
    'Formal',
    'Athletic',
    'Streetwear',
    'Minimalist',
    'Urban',
    'Cozy',
    'Preppy',
];

export default function OutfitPreferencesScreen() {
    const { settings, saveSettings } = useSettings();
    const [style, setStyle] = useState(settings.clothingStyle);
    const { status, loading, submit } = useFormSubmit('Saved.', 2000);

    const save = () =>
        submit(() => saveSettings({ ...settings, clothingStyle: style }));

    return (
        <SafeAreaView
            style={st.root}
            edges={['bottom']}
        >
            <ScrollView contentContainerStyle={st.content}>
                <Text style={st.sectionLabel}>Style preference</Text>
                <View style={st.chipGrid}>
                    {STYLES.map((s) => (
                        <Pressable
                            key={s}
                            style={[st.chip, style === s && st.chipActive]}
                            onPress={() => setStyle(s)}
                        >
                            <Text
                                style={[
                                    st.chipText,
                                    style === s && st.chipTextActive,
                                ]}
                            >
                                {s}
                            </Text>
                        </Pressable>
                    ))}
                </View>
                <StatusMessage status={status} />
                <Pressable
                    style={[st.saveBtn, loading && { opacity: 0.5 }]}
                    onPress={save}
                    disabled={loading}
                >
                    <Text style={st.saveBtnText}>
                        {loading ? 'Saving…' : 'Save'}
                    </Text>
                </Pressable>
            </ScrollView>
        </SafeAreaView>
    );
}

const st = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDefault },
    content: {
        padding: spacing.md,
        gap: spacing.md,
        paddingBottom: spacing.xl,
    },
    sectionLabel: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.medium,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.pill,
    },
    chipActive: {
        backgroundColor: colors.saveBtnBg,
        borderColor: colors.saveBtnBg,
    },
    chipText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    chipTextActive: {
        color: colors.saveBtnText,
        fontWeight: fontWeights.semibold,
    },
    saveBtn: {
        paddingVertical: 14,
        backgroundColor: colors.saveBtnBg,
        borderRadius: radius.sm,
        alignItems: 'center',
    },
    saveBtnText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        fontWeight: fontWeights.semibold,
        color: colors.saveBtnText,
    },
});
