import { useState, useMemo, useRef, useEffect } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../../components/primitives';
import { useSettings } from '../../../hooks/useSettings';
import { hapticSelection } from '../../../lib/haptics';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';

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
    const { colors } = useTheme();
    const st = useMemo(() => StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bgDefault },
        content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
        labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        sectionLabel: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            fontWeight: fontWeights.medium,
            color: colors.textMuted,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        savedTag: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.successText },
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
        hint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.textMuted, lineHeight: fontSizes.sm * 1.5 },
    }), [colors]);

    const { settings, saveSettings } = useSettings();
    const [style, setStyle] = useState(settings.clothingStyle);
    const [justSaved, setJustSaved] = useState(false);
    const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (savedTimer.current) clearTimeout(savedTimer.current);
    }, []);

    // Auto-save on tap — consistent with the Style tab and Units screen.
    const select = (next: string) => {
        if (next === style) return;
        setStyle(next);
        hapticSelection();
        saveSettings({ ...settings, clothingStyle: next }).catch(() => {});
        setJustSaved(true);
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setJustSaved(false), 1500);
    };

    return (
        <SafeAreaView style={st.root} edges={['bottom']}>
            <ScrollView contentContainerStyle={st.content}>
                <View style={st.labelRow}>
                    <Text style={st.sectionLabel}>Style preference</Text>
                    {justSaved && <Text style={st.savedTag}>✓ Saved</Text>}
                </View>
                <View style={st.chipGrid}>
                    {STYLES.map((s) => (
                        <Pressable
                            key={s}
                            style={[st.chip, style === s && st.chipActive]}
                            onPress={() => select(s)}
                            accessibilityRole="radio"
                            accessibilityLabel={s}
                            accessibilityState={{ selected: style === s }}
                        >
                            <Text style={[st.chipText, style === s && st.chipTextActive]}>{s}</Text>
                        </Pressable>
                    ))}
                </View>
                <Text style={st.hint}>Changes save automatically.</Text>
            </ScrollView>
        </SafeAreaView>
    );
}
