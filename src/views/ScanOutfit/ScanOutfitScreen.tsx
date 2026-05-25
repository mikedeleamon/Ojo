/**
 * ScanOutfitScreen.tsx
 * ────────────────────
 * "Score what you're wearing today."
 *
 * Flow:
 *   1. User scans up to 4 garment photos (camera or library).
 *   2. Each image runs through the existing on-device TFLite pipeline
 *      (identifyClothing) to detect garment type + dominant color.
 *   3. Each detected garment is matched against the user's closet articles
 *      by clothingType (+ color as a tiebreaker).
 *   4. Matched articles (or synthetic stand-ins) are scored via generateOutfits.
 *   5. Score, notes, and score breakdown are displayed.
 */

import { useState, useMemo, useCallback } from 'react';
import {
    ScrollView,
    Image,
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from '../../components/primitives';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, fontWeights, radius, spacing } from '../../theme/tokens';
import { useClosets } from '../../hooks/useClosets';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { captureImage, pickImage } from '../../lib/imageService';
import { identifyClothing } from '../../services/clothingIdentifier';
import { GARMENT_TO_FORM_TYPE } from '../../components/ArticleModal/detection';
import { generateOutfits } from '../../lib/outfitEngine';
import type { OutfitResult } from '../../lib/outfitEngine';
import { loadPreferences } from '../../lib/userPreferences';
import { useSettings } from '../../context/SettingsContext';
import type { ClothingArticle, CurrentWeather } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SCANS = 4;

/** Neutral "room temperature" weather used when live weather isn't available. */
const NEUTRAL_WEATHER: CurrentWeather = {
    WeatherText:           'Partly cloudy',
    HasPrecipitation:      false,
    PrecipitationType:     null,
    IsDayTime:             true,
    Temperature:           { Imperial: { Value: 68, Unit: 'F' }, Metric: { Value: 20, Unit: 'C' } },
    RealFeelTemperature:   { Imperial: { Value: 68, Unit: 'F' }, Metric: { Value: 20, Unit: 'C' } },
    Wind:                  { Speed: { Imperial: { Value: 5 }, Metric: { Value: 8 } } },
    RelativeHumidity:      55,
    UVIndexText:           'Moderate',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScannedItem {
    localUri:    string;
    garmentType: string;   // display name after GARMENT_TO_FORM_TYPE mapping
    color:       string | null;
    confidence:  number;
    matched:     ClothingArticle | null;   // best closet match
    synthetic:   ClothingArticle | null;   // synthetic stand-in when no match
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Find the best matching article in the closet for a scanned garment.
 * Matching is by clothingType (required) then optionally by color (tiebreaker).
 */
function matchToCloset(
    formType: string | undefined,
    detectedColor: string | null,
    articles: ClothingArticle[],
): ClothingArticle | null {
    if (!formType) return null;
    const byType = articles.filter(
        a => a.clothingType.toLowerCase() === formType.toLowerCase(),
    );
    if (!byType.length) return null;
    if (!detectedColor || byType.length === 1) return byType[0];
    // Prefer articles whose color matches the detected color
    const colorMatch = byType.find(
        a => a.color?.toLowerCase().includes(detectedColor.toLowerCase()) ||
             detectedColor.toLowerCase().includes((a.color ?? '').toLowerCase()),
    );
    return colorMatch ?? byType[0];
}

/**
 * Build a minimal ClothingArticle that represents an unmatched scan result.
 * Used for scoring when the user's closet doesn't have the detected garment type.
 */
function buildSynthetic(item: ScannedItem, idx: number): ClothingArticle {
    return {
        _id:           `scan-${idx}`,
        clothingType:  item.garmentType || 'Other',
        name:          item.garmentType || 'Scanned item',
        color:         item.color ?? undefined,
        topOrBottom:   undefined,
    };
}

/** Score color for the badge */
const scoreColor = (s: number) =>
    s >= 80 ? 'rgba(52,211,153,0.9)' : s >= 60 ? 'rgba(251,191,36,0.9)' : 'rgba(148,163,184,0.9)';

// ─── Sub-components ───────────────────────────────────────────────────────────

const ScannedItemCard = ({
    item,
    index,
    onRemove,
    colors,
}: {
    item: ScannedItem;
    index: number;
    onRemove: (i: number) => void;
    colors: ReturnType<typeof useTheme>['colors'];
}) => (
    <View style={[scanStyles.itemCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
        <Image source={{ uri: item.localUri }} style={scanStyles.itemThumb} resizeMode="cover" />
        <View style={{ flex: 1, gap: 3 }}>
            <Text style={[scanStyles.itemType, { color: colors.textPrimary }]}>
                {item.garmentType || 'Unknown'}
                {item.color ? ` · ${item.color}` : ''}
            </Text>
            <Text style={[scanStyles.itemMatch, { color: item.matched ? 'rgba(52,211,153,0.9)' : colors.textMuted }]}>
                {item.matched
                    ? `✓ Matched: ${item.matched.name || item.matched.clothingType}`
                    : 'No closet match — using scan data'}
            </Text>
            <Text style={[scanStyles.itemConf, { color: colors.textMuted }]}>
                Confidence: {Math.round(item.confidence * 100)}%
            </Text>
        </View>
        <Pressable
            onPress={() => onRemove(index)}
            hitSlop={8}
            style={scanStyles.removeBtn}
            accessibilityLabel="Remove scan"
        >
            <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
        </Pressable>
    </View>
);

const scanStyles = StyleSheet.create({
    itemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        padding: spacing.sm,
        borderWidth: 1,
        borderRadius: radius.sm,
    },
    itemThumb: {
        width: 52,
        height: 52,
        borderRadius: radius.sm,
    },
    itemType: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.sm,
    },
    itemMatch: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
    },
    itemConf: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
    },
    removeBtn: {
        padding: 4,
    },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ScanOutfitScreen() {
    const { colors } = useTheme();
    const { goBack } = useAppNavigation();
    const { closets } = useClosets();
    const { settings } = useSettings();

    const [items, setItems]     = useState<ScannedItem[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scoring, setScoring]  = useState(false);
    const [result, setResult]    = useState<OutfitResult | null>(null);

    const articles: ClothingArticle[] = useMemo(() => {
        if (!closets.length) return [];
        const preferred = closets.find(c => c.isPreferred) ?? closets[0];
        return preferred.articles;
    }, [closets]);

    const handleScan = useCallback((useCamera: boolean) => {
        if (items.length >= MAX_SCANS) {
            Alert.alert('Limit reached', `You can scan up to ${MAX_SCANS} items.`);
            return;
        }
        setScanning(true);
        const picker = useCamera ? captureImage : pickImage;
        picker().then(async img => {
            if (!img.localUri) { setScanning(false); return; }
            try {
                const id = await identifyClothing(img.localUri);
                const formType = GARMENT_TO_FORM_TYPE[id.garmentType];
                const topColor = id.colors[0]?.name ?? null;
                const matched  = matchToCloset(formType, topColor, articles);
                const item: ScannedItem = {
                    localUri:    img.localUri,
                    garmentType: formType ?? id.garmentType,
                    color:       topColor,
                    confidence:  id.confidence,
                    matched,
                    synthetic:   null,
                };
                setItems(prev => [...prev, item]);
                setResult(null);   // reset previous score when items change
            } catch {
                Alert.alert('Scan failed', 'Could not identify this item. Try a clearer photo.');
            } finally {
                setScanning(false);
            }
        }).catch(() => setScanning(false));
    }, [items.length, articles]);

    const handleRemove = useCallback((idx: number) => {
        setItems(prev => prev.filter((_, i) => i !== idx));
        setResult(null);
    }, []);

    const handleScore = useCallback(async () => {
        if (items.length < 1) return;
        setScoring(true);
        try {
            const profile = await loadPreferences();
            // Build article list: use closet match where available, else synthetic
            const scoringArticles: ClothingArticle[] = items.map((item, i) =>
                item.matched ?? buildSynthetic(item, i),
            );
            const { results } = generateOutfits(
                scoringArticles,
                NEUTRAL_WEATHER,
                settings,
                new Set(),
                1,
                profile,
            );
            setResult(results[0] ?? null);
        } catch {
            Alert.alert('Error', 'Could not score this outfit. Please try again.');
        } finally {
            setScoring(false);
        }
    }, [items, settings]);

    const st = useMemo(() => makeStyles(colors), [colors]);

    return (
        <SafeAreaView style={st.root} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={st.header}>
                <Pressable onPress={goBack} style={st.backBtn} accessibilityLabel="Go back" accessibilityRole="button">
                    <Text style={[st.backArrow, { color: colors.textPrimary }]}>‹</Text>
                </Pressable>
                <Text style={st.title}>Scan Outfit</Text>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">
                {/* Intro */}
                <Text style={[st.intro, { color: colors.textSecondary }]}>
                    Photograph each garment you're wearing. Ojo matches them to your closet and scores the combination.
                </Text>

                {/* Scanned items */}
                {items.map((item, i) => (
                    <ScannedItemCard key={i} item={item} index={i} onRemove={handleRemove} colors={colors} />
                ))}

                {/* Add buttons */}
                {items.length < MAX_SCANS && (
                    <View style={st.addRow}>
                        <Pressable
                            style={[st.addBtn, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                            onPress={() => handleScan(true)}
                            disabled={scanning}
                            accessibilityRole="button"
                        >
                            {scanning ? (
                                <ActivityIndicator color={colors.textPrimary} />
                            ) : (
                                <Text style={[st.addBtnText, { color: colors.textPrimary }]}>📷 Camera</Text>
                            )}
                        </Pressable>
                        <Pressable
                            style={[st.addBtn, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}
                            onPress={() => handleScan(false)}
                            disabled={scanning}
                            accessibilityRole="button"
                        >
                            <Text style={[st.addBtnText, { color: colors.textPrimary }]}>🖼️ Library</Text>
                        </Pressable>
                    </View>
                )}

                {/* Score button */}
                {items.length > 0 && (
                    <Pressable
                        style={[st.scoreBtn, { backgroundColor: colors.saveBtnBg }, scoring && { opacity: 0.6 }]}
                        onPress={handleScore}
                        disabled={scoring}
                        accessibilityRole="button"
                    >
                        {scoring ? (
                            <ActivityIndicator color={colors.saveBtnText} />
                        ) : (
                            <Text style={[st.scoreBtnText, { color: colors.saveBtnText }]}>
                                Score this outfit →
                            </Text>
                        )}
                    </Pressable>
                )}

                {/* Result */}
                {result && result.status === 'ok' && (
                    <View style={[st.resultCard, { backgroundColor: colors.glassBg, borderColor: colors.glassBorder }]}>
                        {/* Score badge */}
                        <View style={[st.scoreBadge, { borderColor: scoreColor(result.score) }]}>
                            <Text style={[st.scoreBadgeText, { color: scoreColor(result.score) }]}>
                                {result.isPersonalized ? 'Your Score' : 'Outfit Score'}: {result.score}
                                {result.isPersonalized ? ' ★' : ''}
                            </Text>
                        </View>
                        {/* Breakdown */}
                        <View style={st.breakdownRow}>
                            {(Object.entries(result.scoreBreakdown) as [string, number][]).map(([key, val]) => (
                                <View key={key} style={st.breakdownItem}>
                                    <Text style={[st.breakdownLabel, { color: colors.textMuted }]}>
                                        {key.charAt(0).toUpperCase() + key.slice(1)}
                                    </Text>
                                    <View style={[st.breakdownBarBg, { backgroundColor: colors.glassBorder }]}>
                                        <View style={[st.breakdownBarFill, { width: `${val}%` as any }]} />
                                    </View>
                                    <Text style={[st.breakdownVal, { color: colors.textSecondary }]}>{val}</Text>
                                </View>
                            ))}
                        </View>
                        {/* Notes */}
                        {result.notes.length > 0 && (
                            <View style={st.notesBlock}>
                                {result.notes.map((n, i) => (
                                    <Text key={i} style={[st.noteText, { color: colors.textSecondary }]}>
                                        · {n}
                                    </Text>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        root: {
            flex: 1,
            backgroundColor: colors.bgDefault,
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            gap: spacing.sm,
        },
        backBtn:  { padding: 4 },
        backArrow: {
            fontSize: 28,
            lineHeight: 32,
        },
        title: {
            fontFamily: fonts.display,
            fontSize: fontSizes.xl,
            color: colors.textPrimary,
        },
        scroll: {
            padding: spacing.md,
            gap: spacing.sm,
            paddingBottom: spacing.xl,
        },
        intro: {
            fontFamily: fonts.body,
            fontSize: fontSizes.sm,
            lineHeight: 20,
            marginBottom: spacing.xs,
        },
        addRow: {
            flexDirection: 'row',
            gap: spacing.sm,
            marginTop: spacing.xs,
        },
        addBtn: {
            flex: 1,
            borderWidth: 1,
            borderRadius: radius.sm,
            paddingVertical: 12,
            alignItems: 'center',
            justifyContent: 'center',
        },
        addBtnText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.sm,
        },
        scoreBtn: {
            borderRadius: radius.sm,
            paddingVertical: 14,
            alignItems: 'center',
            marginTop: spacing.sm,
        },
        scoreBtnText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.base,
        },
        resultCard: {
            borderWidth: 1,
            borderRadius: radius.md,
            padding: spacing.sm,
            gap: spacing.sm,
            marginTop: spacing.sm,
        },
        scoreBadge: {
            alignSelf: 'flex-start',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderWidth: 1,
            borderRadius: radius.pill,
        },
        scoreBadgeText: {
            fontFamily: fonts.bodySemiBold,
            fontSize: fontSizes.sm,
        },
        breakdownRow: {
            gap: 6,
        },
        breakdownItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        breakdownLabel: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            width: 70,
        },
        breakdownBarBg: {
            flex: 1,
            height: 4,
            borderRadius: radius.pill,
            overflow: 'hidden',
        },
        breakdownBarFill: {
            height: '100%' as any,
            borderRadius: radius.pill,
            backgroundColor: 'rgba(99,102,241,0.7)',
        },
        breakdownVal: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            width: 24,
            textAlign: 'right',
        },
        notesBlock: {
            gap: 4,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: 'rgba(148,163,184,0.2)',
            paddingTop: spacing.xs,
        },
        noteText: {
            fontFamily: fonts.body,
            fontSize: fontSizes.xs,
            lineHeight: 17,
        },
    });
}
