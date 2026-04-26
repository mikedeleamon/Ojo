import { useState, useEffect, useRef } from 'react';
import {
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import {
    View,
    Text,
    TextInput,
    Pressable,
} from '../../../components/primitives';
import { useSettings } from '../../../hooks/useSettings';
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

interface SliderFieldProps {
    label: string;
    value: number;
    unit: string;
    min: number;
    max: number;
    onChange: (v: number) => void;
    onSave: (v: number) => void;
}

const SliderField = ({
    label,
    value,
    unit,
    min,
    max,
    onChange,
    onSave,
}: SliderFieldProps) => (
    <View style={styles.sliderRow}>
        <View style={styles.sliderMeta}>
            <Text style={styles.sliderLabel}>{label}</Text>
            <Text style={styles.sliderValue}>
                {value}
                {unit}
            </Text>
        </View>
        <Slider
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
        />
    </View>
);

export default function PreferencesScreen() {
    const { settings, saveSettings, settingsReady } = useSettings();
    const [clothingStyle, setClothingStyle] = useState(settings.clothingStyle);
    const [location, setLocation] = useState(settings.location);
    const [tempScale, setTempScale] = useState<'Imperial' | 'Metric'>(
        settings.temperatureScale as 'Imperial' | 'Metric',
    );
    const [hiTemp, setHiTemp] = useState(settings.hiTempThreshold);
    const [lowTemp, setLowTemp] = useState(settings.lowTempThreshold);
    const [humidity, setHumidity] = useState(settings.humidityPreference);

    const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!settingsReady) return;
        setClothingStyle(settings.clothingStyle);
        setLocation(settings.location);
        setTempScale(settings.temperatureScale as 'Imperial' | 'Metric');
        setHiTemp(settings.hiTempThreshold);
        setLowTemp(settings.lowTempThreshold);
        setHumidity(settings.humidityPreference);
    }, [settings, settingsReady]);

    const currentSettings = (overrides: Partial<typeof settings>) => ({
        clothingStyle,
        location,
        temperatureScale: tempScale,
        hiTempThreshold: hiTemp,
        lowTempThreshold: lowTemp,
        humidityPreference: humidity,
        ...overrides,
    });

    const handleStyleChange = (s: string) => {
        setClothingStyle(s);
        saveSettings(currentSettings({ clothingStyle: s })).catch(() => {});
    };

    const handleScaleChange = (scale: 'Imperial' | 'Metric') => {
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
        <SafeAreaView
            style={styles.root}
            edges={['bottom']}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps='handled'
                >
                    {/* Style preference */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Style preference
                        </Text>
                        <View style={styles.chipGrid}>
                            {STYLES.map((s) => (
                                <Pressable
                                    key={s}
                                    style={[
                                        styles.chip,
                                        clothingStyle === s &&
                                            styles.chipActive,
                                    ]}
                                    onPress={() => handleStyleChange(s)}
                                >
                                    <Text
                                        style={[
                                            styles.chipText,
                                            clothingStyle === s &&
                                                styles.chipTextActive,
                                        ]}
                                    >
                                        {s}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Location */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Default location
                        </Text>
                        <TextInput
                            style={styles.input}
                            placeholder='City name'
                            placeholderTextColor={colors.textMuted}
                            value={location}
                            onChangeText={handleLocationChange}
                            returnKeyType='done'
                        />
                    </View>

                    {/* Temperature unit */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Temperature unit
                        </Text>
                        <View style={styles.segmented}>
                            {(['Imperial', 'Metric'] as const).map((scale) => (
                                <Pressable
                                    key={scale}
                                    style={[
                                        styles.seg,
                                        tempScale === scale && styles.segActive,
                                    ]}
                                    onPress={() => handleScaleChange(scale)}
                                >
                                    <Text
                                        style={[
                                            styles.segText,
                                            tempScale === scale &&
                                                styles.segTextActive,
                                        ]}
                                    >
                                        {scale === 'Imperial' ? '°F' : '°C'}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Temperature feel */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Temperature feel
                        </Text>
                        <SliderField
                            label='Hot above'
                            value={hiTemp}
                            unit='°'
                            min={50}
                            max={120}
                            onChange={setHiTemp}
                            onSave={(v) =>
                                saveSettings(
                                    currentSettings({ hiTempThreshold: v }),
                                ).catch(() => {})
                            }
                        />
                        <SliderField
                            label='Cold below'
                            value={lowTemp}
                            unit='°'
                            min={0}
                            max={70}
                            onChange={setLowTemp}
                            onSave={(v) =>
                                saveSettings(
                                    currentSettings({ lowTempThreshold: v }),
                                ).catch(() => {})
                            }
                        />
                    </View>

                    {/* Humidity */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Humidity sensitivity
                        </Text>
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
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
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
    segActive: { backgroundColor: 'rgba(255,255,255,0.14)' },
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
});
