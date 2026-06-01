import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Switch,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    View,
    Text,
    TextInput,
    Pressable,
    AppSlider,
    GlassCard,
} from '../../../components/primitives';
import { useSettings } from '../../../hooks/useSettings';
import { useTabBarPadding } from '../../../hooks/useTabBarPadding';
import { useFocusEffect } from 'expo-router';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import { fToC, cToF } from '../../../lib/units';
import { loadHistory } from '../../../lib/outfitHistory';
import {
    loadPreferences,
    UserPreferenceProfile,
    computeStyleDNA,
    StyleDNA,
    PERSONALIZATION_THRESHOLD,
} from '../../../lib/userPreferences';
import { OutfitHistoryEntry } from '../../../types';
import { CSS_COLORS } from '../../../lib/colors/cssColors';
import { GENDERS } from '../../../lib/colors/palettes';

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


interface SliderFieldProps {
    label: string;
    value: number;
    unit: string;
    min: number;
    max: number;
    onChange: (v: number) => void;
    onSave: (v: number) => void;
    styles: ReturnType<typeof makeStyles>;
    colors: ReturnType<typeof useTheme>['colors'];
}

const makeStyles = (colors: ReturnType<typeof useTheme>['colors']) => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDefault },
    content: {
        padding: spacing.md,
        gap: spacing.lg,
        paddingBottom: spacing.xl,
    },
    section: { gap: spacing.sm },
    sectionTitle: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        fontWeight: fontWeights.medium,
        letterSpacing: 0.08 * fontSizes.xs,
        textTransform: 'uppercase',
        color: colors.textMuted,
        borderBottomWidth: 1,
        borderBottomColor: colors.glassBorder,
        paddingBottom: 4,
    },
    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
        paddingVertical: 7,
        paddingHorizontal: 16,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.pill,
    },
    chipActive: { backgroundColor: colors.saveBtnBg, borderWidth: 0 },
    chipText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    chipTextActive: {
        color: colors.saveBtnText,
        fontWeight: fontWeights.semibold,
    },
    input: {
        paddingVertical: 12,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.sm,
        color: colors.textPrimary,
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
    },
    segmented: {
        flexDirection: 'row',
        gap: 4,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.sm,
        padding: 4,
        alignSelf: 'flex-start',
    },
    seg: {
        paddingVertical: 8,
        paddingHorizontal: 24,
        borderRadius: 6,
        alignItems: 'center',
    },
    segActive: { backgroundColor: colors.glassBgStrong },
    segText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        fontWeight: fontWeights.medium,
        color: colors.textSecondary,
    },
    segTextActive: { color: colors.textPrimary },
    sliderRow: { gap: 6 },
    sliderMeta: { flexDirection: 'row', justifyContent: 'space-between' },
    sliderLabel: {
        fontFamily: fonts.body,
        fontSize: fontSizes.sm,
        color: colors.textSecondary,
    },
    sliderValue: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        fontWeight: fontWeights.medium,
        color: colors.textPrimary,
    },
    historyEmpty: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        fontStyle: 'italic',
        paddingVertical: 4,
    },
    historyCard: {
        backgroundColor: colors.glassBg,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        padding: 10,
        gap: 4,
    },
    historyCardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    historyDate: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
    },
    historyCloset: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
    },
    historySummary: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        lineHeight: fontSizes.xs * 1.4,
    },
    patternRow: {
        gap: 6,
    },
    patternItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    patternLabel: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textSecondary,
        width: 72,
    },
    patternBarBg: {
        flex: 1,
        height: 5,
        backgroundColor: colors.glassBg,
        borderRadius: 3,
        overflow: 'hidden',
    },
    patternBarFill: {
        height: 5,
        borderRadius: 3,
        backgroundColor: colors.textSecondary,
    },
    patternCount: {
        fontFamily: fonts.body,
        fontSize: 10,
        color: colors.textMuted,
        width: 18,
        textAlign: 'right',
    },
    colorSwatch: {
        width: 10,
        height: 10,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.12)',
    },
    sensitivityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 6,
        paddingHorizontal: 2,
    },
    sensitivityLabel: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: colors.textSecondary,
    },
    sensitivitySub: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
        color: colors.textMuted,
        marginTop: 1,
    },
    // Style DNA card — matches historyCard pattern so theme changes apply
    dnaCard: {
        backgroundColor: colors.glassBg,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        padding: 10,
        gap: 8,
    },
    dnaHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    dnaTitle: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.sm,
    },
    dnaLevel: {
        fontFamily: fonts.bodySemiBold,
        fontSize: fontSizes.xs,
    },
    dnaBarBg: {
        height: 4,
        borderRadius: radius.pill,
        overflow: 'hidden',
    },
    dnaBarFill: {
        height: '100%' as any,
        borderRadius: radius.pill,
    },
    dnaSub: {
        fontFamily: fonts.body,
        fontSize: fontSizes.xs,
    },
});

const SliderField = ({
    label,
    value,
    unit,
    min,
    max,
    onChange,
    onSave,
    styles,
    colors,
}: SliderFieldProps) => (
    <View style={styles.sliderRow}>
        <View style={styles.sliderMeta}>
            <Text style={styles.sliderLabel}>{label}</Text>
            <Text style={styles.sliderValue}>
                {Math.round(value)}
                {unit}
            </Text>
        </View>
        <AppSlider
            minimumValue={min}
            maximumValue={max}
            value={value}
            step={1}
            onValueChange={onChange}
            onSlidingComplete={onSave}
            minimumTrackTintColor={colors.textPrimary}
            maximumTrackTintColor={colors.glassBorder}
            thumbTintColor={colors.saveBtnBg}
            style={{ width: '100%' }}
            accessibilityLabel={label}
        />
    </View>
);

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatWornAt = (iso: string): string => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7) return `${diff} days ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const topEntries = (map: Record<string, number>, n = 5) =>
    Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);

// ─── Sub-sections ─────────────────────────────────────────────────────────────

const HistorySection = ({
    history,
    styles,
}: {
    history: OutfitHistoryEntry[];
    styles: ReturnType<typeof makeStyles>;
}) => {
    if (history.length === 0) {
        return (
            <Text style={styles.historyEmpty}>
                Log outfits with "Wore this today" to see your history here.
            </Text>
        );
    }
    return (
        <>
            {history.slice(0, 8).map((entry) => (
                <GlassCard key={entry.id} style={styles.historyCard}>
                    <View style={styles.historyCardRow}>
                        <Text style={styles.historyDate}>{formatWornAt(entry.wornAt)}</Text>
                        <Text style={styles.historyCloset}>{entry.closetName}</Text>
                    </View>
                    <Text style={styles.historySummary} numberOfLines={2}>
                        {entry.articleSummary}
                    </Text>
                </GlassCard>
            ))}
        </>
    );
};

// ─── Style DNA card ──────────────────────────────────────────────────────────

const LEVEL_LABELS: Record<StyleDNA['level'], string> = {
    none:     'Building profile…',
    learning: 'Learning your style',
    active:   'Personalized ★',
};
const LEVEL_COLORS: Record<StyleDNA['level'], string> = {
    none:     'rgba(148,163,184,0.8)',
    learning: 'rgba(251,191,36,0.9)',
    active:   'rgba(99,102,241,0.9)',
};

const StyleDNACard = ({
    prefs,
    styles,
}: {
    prefs: UserPreferenceProfile;
    styles: ReturnType<typeof makeStyles>;
}) => {
    const { colors } = useTheme();
    const dna = computeStyleDNA(prefs);
    const levelColor = LEVEL_COLORS[dna.level];
    // Continuous progress: 0 → 30 outfits maps linearly to 0% → 100%, so the
    // bar tracks how close the user is to "Personalized" rather than jumping
    // in three discrete steps tied only to `level`.
    const progress = Math.min(1, dna.totalOutfits / PERSONALIZATION_THRESHOLD);

    return (
        <View style={styles.dnaCard}>
            <View style={styles.dnaHeaderRow}>
                <Text style={[styles.dnaTitle, { color: colors.textPrimary }]}>Style Ranker</Text>
                <Text style={[styles.dnaLevel, { color: levelColor }]}>
                    {LEVEL_LABELS[dna.level]}
                </Text>
            </View>
            {/* Progress bar */}
            <View style={[styles.dnaBarBg, { backgroundColor: colors.glassBorder }]}>
                <View style={[styles.dnaBarFill, { width: `${Math.round(progress * 100)}%` as any, backgroundColor: levelColor }]} />
            </View>
            <Text style={[styles.dnaSub, { color: colors.textMuted }]}>
                {dna.totalOutfits} outfits logged · {dna.level === 'active' ? 'Score badge now shows "Your Score"' : dna.level === 'learning' ? `${30 - dna.totalOutfits} more to fully personalize` : `${10 - dna.totalOutfits} outfits until the ranker starts learning`}
            </Text>
            {dna.topColors.length > 0 && (
                <Text style={[styles.dnaSub, { color: colors.textSecondary, marginTop: 2 }]}>
                    Signature colors: {dna.topColors.join(', ')}
                    {dna.topFabric ? ` · Fabric: ${dna.topFabric}` : ''}
                </Text>
            )}
        </View>
    );
};

const PatternsSection = ({
    prefs,
    styles,
}: {
    prefs: UserPreferenceProfile;
    styles: ReturnType<typeof makeStyles>;
}) => {
    const colorEntries = topEntries(prefs.colors, 5);
    const fabricEntries = topEntries(prefs.fabrics, 4);
    if (prefs.totalOutfits === 0) return null;

    const maxColor = colorEntries[0]?.[1] ?? 1;
    const maxFabric = fabricEntries[0]?.[1] ?? 1;

    return (
        <>
            {colorEntries.length > 0 && (
                <View style={styles.patternRow}>
                    {colorEntries.map(([color, count]) => (
                        <View key={color} style={styles.patternItem}>
                            <View
                                style={[
                                    styles.colorSwatch,
                                    { backgroundColor: CSS_COLORS[color] ?? '#888' },
                                ]}
                            />
                            <Text style={[styles.patternLabel, { width: 62 }]} numberOfLines={1}>
                                {color}
                            </Text>
                            <View style={styles.patternBarBg}>
                                <View
                                    style={[
                                        styles.patternBarFill,
                                        { width: `${Math.round((count / maxColor) * 100)}%` as any },
                                    ]}
                                />
                            </View>
                            <Text style={styles.patternCount}>{count}</Text>
                        </View>
                    ))}
                </View>
            )}
            {fabricEntries.length > 0 && (
                <View style={[styles.patternRow, { marginTop: 6 }]}>
                    {fabricEntries.map(([fabric, count]) => (
                        <View key={fabric} style={styles.patternItem}>
                            <Text style={styles.patternLabel} numberOfLines={1}>{fabric}</Text>
                            <View style={styles.patternBarBg}>
                                <View
                                    style={[
                                        styles.patternBarFill,
                                        {
                                            width: `${Math.round((count / maxFabric) * 100)}%` as any,
                                            backgroundColor: 'rgba(134,211,214,0.7)',
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.patternCount}>{count}</Text>
                        </View>
                    ))}
                </View>
            )}
        </>
    );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PreferencesScreen() {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    // NativeTabs reports a baseline safe-area inset, but the iOS 26 floating
    // tab bar still occludes the last scroll item — pad explicitly.
    const tabPad = useTabBarPadding();

    const [history, setHistory] = useState<OutfitHistoryEntry[]>([]);
    const [prefs, setPrefs] = useState<UserPreferenceProfile>({
        colors: {}, fabrics: {}, categories: {}, colorPairs: {}, totalOutfits: 0,
    });

    useFocusEffect(
        useCallback(() => {
            loadHistory().then(setHistory).catch(() => {});
            loadPreferences().then(setPrefs).catch(() => {});
        }, []),
    );

    const { settings, saveSettings, settingsReady } = useSettings();
    const [clothingStyle, setClothingStyle] = useState(settings.clothingStyle);
    const [gender,        setGender]        = useState(settings.gender || 'All');
    const [location, setLocation] = useState(settings.location);
    const [tempScale, setTempScale] = useState<'Imperial' | 'Metric'>(
        settings.temperatureScale as 'Imperial' | 'Metric',
    );
    const [hiTemp, setHiTemp] = useState(settings.hiTempThreshold);
    const [lowTemp, setLowTemp] = useState(settings.lowTempThreshold);
    const [hiTempDisp, setHiTempDisp] = useState(
        settings.temperatureScale === 'Metric'
            ? fToC(settings.hiTempThreshold)
            : settings.hiTempThreshold,
    );
    const [lowTempDisp, setLowTempDisp] = useState(
        settings.temperatureScale === 'Metric'
            ? fToC(settings.lowTempThreshold)
            : settings.lowTempThreshold,
    );
    const [humidity, setHumidity] = useState(settings.humidityPreference);
    const [allergies, setAllergies] = useState(settings.sensitivities?.allergies ?? false);
    const [asthma,    setAsthma]    = useState(settings.sensitivities?.asthma    ?? false);

    const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!settingsReady) return;
        const isCelsius = settings.temperatureScale === 'Metric';
        setClothingStyle(settings.clothingStyle);
        setGender(settings.gender || 'All');
        setLocation(settings.location);
        setTempScale(settings.temperatureScale as 'Imperial' | 'Metric');
        setHiTemp(settings.hiTempThreshold);
        setLowTemp(settings.lowTempThreshold);
        setHiTempDisp(isCelsius ? fToC(settings.hiTempThreshold) : settings.hiTempThreshold);
        setLowTempDisp(isCelsius ? fToC(settings.lowTempThreshold) : settings.lowTempThreshold);
        setHumidity(settings.humidityPreference);
        setAllergies(settings.sensitivities?.allergies ?? false);
        setAsthma(settings.sensitivities?.asthma ?? false);
    }, [settings, settingsReady]);

    const currentSettings = (overrides: Partial<typeof settings>) => ({
        clothingStyle,
        gender,
        location,
        temperatureScale: tempScale,
        hiTempThreshold: hiTemp,
        lowTempThreshold: lowTemp,
        humidityPreference: humidity,
        sensitivities: { allergies, asthma },
        ...overrides,
    });

    const handleSensitivityChange = (key: 'allergies' | 'asthma', value: boolean) => {
        if (key === 'allergies') setAllergies(value);
        else setAsthma(value);
        const newSens = key === 'allergies'
            ? { allergies: value, asthma }
            : { allergies, asthma: value };
        saveSettings(currentSettings({ sensitivities: newSens })).catch(() => {});
    };

    const handleStyleChange = (s: string) => {
        setClothingStyle(s);
        saveSettings(currentSettings({ clothingStyle: s })).catch(() => {});
    };

    const handleGenderChange = (g: string) => {
        setGender(g);
        saveSettings(currentSettings({ gender: g })).catch(() => {});
    };

    const handleScaleChange = (scale: 'Imperial' | 'Metric') => {
        const toC = scale === 'Metric';
        setHiTempDisp(toC ? fToC(hiTemp) : hiTemp);
        setLowTempDisp(toC ? fToC(lowTemp) : lowTemp);
        setTempScale(scale);
        saveSettings(currentSettings({ temperatureScale: scale })).catch(() => {});
    };

    const handleLocationChange = (text: string) => {
        setLocation(text);
        if (locationTimer.current) clearTimeout(locationTimer.current);
        locationTimer.current = setTimeout(() => {
            saveSettings(currentSettings({ location: text })).catch(() => {});
        }, 800);
    };

    return (
        <SafeAreaView style={styles.root} edges={[]}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={[styles.content, { paddingBottom: tabPad }]}
                    keyboardShouldPersistTaps='handled'
                >
                    {/* Outfit history */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Outfit history</Text>
                        <HistorySection history={history} styles={styles} />
                    </View>

                    {/* Style Ranker DNA card */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Personal Style Ranker</Text>
                        <StyleDNACard prefs={prefs} styles={styles} />
                    </View>

                    {/* Wear patterns */}
                    {prefs.totalOutfits > 0 && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                Your patterns · {prefs.totalOutfits} outfits logged
                            </Text>
                            <PatternsSection prefs={prefs} styles={styles} />
                        </View>
                    )}

                    {/* Style preference */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Style preference</Text>
                        <View style={styles.chipGrid}>
                            {STYLES.map((s) => (
                                <Pressable
                                    key={s}
                                    style={[
                                        styles.chip,
                                        clothingStyle === s && styles.chipActive,
                                    ]}
                                    onPress={() => handleStyleChange(s)}
                                    accessibilityRole="radio"
                                    accessibilityLabel={s}
                                    accessibilityState={{ selected: clothingStyle === s }}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        clothingStyle === s && styles.chipTextActive,
                                    ]}>
                                        {s}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Wardrobe gender */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Wardrobe style</Text>
                        <View style={styles.chipGrid}>
                            {GENDERS.map((g) => (
                                <Pressable
                                    key={g}
                                    style={[
                                        styles.chip,
                                        gender === g && styles.chipActive,
                                    ]}
                                    onPress={() => handleGenderChange(g)}
                                    accessibilityRole="radio"
                                    accessibilityLabel={g}
                                    accessibilityState={{ selected: gender === g }}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        gender === g && styles.chipTextActive,
                                    ]}>
                                        {g}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Location */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Default location</Text>
                        <TextInput
                            style={styles.input}
                            placeholder='City name'
                            placeholderTextColor={colors.textMuted}
                            value={location}
                            onChangeText={handleLocationChange}
                            returnKeyType='done'
                            accessibilityLabel="Default location"
                        />
                    </View>

                    {/* Temperature unit */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Temperature unit</Text>
                        <View style={styles.segmented}>
                            {(['Imperial', 'Metric'] as const).map((scale) => (
                                <Pressable
                                    key={scale}
                                    style={[
                                        styles.seg,
                                        tempScale === scale && styles.segActive,
                                    ]}
                                    onPress={() => handleScaleChange(scale)}
                                    accessibilityRole="radio"
                                    accessibilityLabel={scale === 'Imperial' ? 'Fahrenheit' : 'Celsius'}
                                    accessibilityState={{ selected: tempScale === scale }}
                                >
                                    <Text style={[
                                        styles.segText,
                                        tempScale === scale && styles.segTextActive,
                                    ]}>
                                        {scale === 'Imperial' ? '°F' : '°C'}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Temperature feel */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Temperature feel</Text>
                        <SliderField
                            label='Hot above'
                            value={hiTempDisp}
                            unit='°'
                            min={tempScale === 'Metric' ? 10 : 50}
                            max={tempScale === 'Metric' ? 49 : 120}
                            onChange={(v) => {
                                setHiTempDisp(v);
                                setHiTemp(tempScale === 'Metric' ? cToF(v) : v);
                            }}
                            onSave={(v) =>
                                saveSettings(
                                    currentSettings({ hiTempThreshold: tempScale === 'Metric' ? cToF(v) : v }),
                                ).catch(() => {})
                            }
                            styles={styles}
                            colors={colors}
                        />
                        <SliderField
                            label='Cold below'
                            value={lowTempDisp}
                            unit='°'
                            min={tempScale === 'Metric' ? -18 : 0}
                            max={tempScale === 'Metric' ? 21 : 70}
                            onChange={(v) => {
                                setLowTempDisp(v);
                                setLowTemp(tempScale === 'Metric' ? cToF(v) : v);
                            }}
                            onSave={(v) =>
                                saveSettings(
                                    currentSettings({ lowTempThreshold: tempScale === 'Metric' ? cToF(v) : v }),
                                ).catch(() => {})
                            }
                            styles={styles}
                            colors={colors}
                        />
                    </View>

                    {/* Humidity */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Humidity sensitivity</Text>
                        <SliderField
                            label='Threshold'
                            value={humidity}
                            unit='%'
                            min={0}
                            max={100}
                            onChange={setHumidity}
                            onSave={(v) =>
                                saveSettings(
                                    currentSettings({ humidityPreference: v }),
                                ).catch(() => {})
                            }
                            styles={styles}
                            colors={colors}
                        />
                    </View>

                    {/* Sensitivities */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Sensitivities</Text>
                        <View style={styles.sensitivityRow}>
                            <View>
                                <Text style={styles.sensitivityLabel}>Allergies</Text>
                                <Text style={styles.sensitivitySub}>Get pollen warnings & fabric tips</Text>
                            </View>
                            <Switch
                                value={allergies}
                                onValueChange={(v) => handleSensitivityChange('allergies', v)}
                                trackColor={{ true: colors.toggleThumbActive }}
                                thumbColor={colors.white}
                            />
                        </View>
                        <View style={styles.sensitivityRow}>
                            <View>
                                <Text style={styles.sensitivityLabel}>Asthma</Text>
                                <Text style={styles.sensitivitySub}>Get air quality fabric guidance</Text>
                            </View>
                            <Switch
                                value={asthma}
                                onValueChange={(v) => handleSensitivityChange('asthma', v)}
                                trackColor={{ true: colors.toggleThumbActive }}
                                thumbColor={colors.white}
                            />
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
