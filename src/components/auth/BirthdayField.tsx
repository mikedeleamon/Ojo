import { useMemo, useState } from 'react';
import {
    Modal,
    Platform,
    StyleSheet,
    TouchableOpacity,
    Keyboard,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../primitives';
import AuthField from './AuthField';
import { makeAuthStyles } from './authStyles';
import { useTheme } from '../../theme/ThemeContext';
import { spacing, fonts, fontSizes, fontWeights } from '../../theme/tokens';
import {
    formatBirthdayInput,
    parseBirthday,
    toLocalDate,
    formatLocalDateAsBirthday,
} from '../../lib/age';

interface Props {
    value: string;
    onChange: (formatted: string) => void;
    /** Called when the field loses focus or the picker commits a date. */
    onCommit?: (formatted: string) => void;
    error?: string;
    label?: string;
}

/**
 * Date-of-birth input: a masked MM/DD/YYYY text field plus a native picker.
 *
 * Shared by the sign-up form and the post-OAuth age gate so the two can't drift
 * — they enforce the same rule (lib/age.ts) and should also look and behave the
 * same while doing it.
 *
 * Both entry paths funnel through the same `MM/DD/YYYY` string, which is what
 * the API expects. The picker works in local time and the parser in UTC, so
 * conversions go through toLocalDate / formatLocalDateAsBirthday rather than
 * reading Date fields directly.
 */
export default function BirthdayField({
    value,
    onChange,
    onCommit,
    error,
    label = 'Date of birth',
}: Props) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);

    const [showPicker, setShowPicker] = useState(false);
    const [pickerDate, setPickerDate] = useState<Date>(new Date(2000, 0, 1));

    const local = useMemo(
        () =>
            StyleSheet.create({
                pickerOverlay: {
                    flex: 1,
                    justifyContent: 'flex-end',
                    backgroundColor: 'rgba(0,0,0,0.45)',
                },
                pickerSheet: {
                    backgroundColor: colors.bgDefault,
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    paddingBottom: insets.bottom + spacing.sm,
                },
                pickerHeader: {
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: colors.glassBorder,
                },
                pickerHeaderBtn: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.base,
                    color: colors.textSecondary,
                },
                pickerHeaderBtnDone: {
                    color: colors.textPrimary,
                    fontWeight: fontWeights.semibold,
                },
            }),
        [colors, insets.bottom],
    );

    const openPicker = () => {
        Keyboard.dismiss();
        // Birthdays parse in UTC; the picker renders in local time, so seed it
        // with the local-midnight equivalent or it shows the previous day.
        const existing = parseBirthday(value);
        setPickerDate(existing ? toLocalDate(existing) : new Date(2000, 0, 1));
        setShowPicker(true);
    };

    const applyPickerDate = (date: Date) => {
        const formatted = formatLocalDateAsBirthday(date);
        onChange(formatted);
        onCommit?.(formatted);
    };

    const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowPicker(false);
            if (event.type === 'dismissed' || !date) return;
            applyPickerDate(date);
        } else {
            // iOS spinner: update live, commit on Done
            if (date) setPickerDate(date);
        }
    };

    return (
        <>
            <AuthField
                label={label}
                placeholder="MM/DD/YYYY"
                keyboardType="number-pad"
                maxLength={10}
                value={value}
                onChangeText={v => onChange(formatBirthdayInput(v))}
                onBlur={() => onCommit?.(value)}
                error={error}
                suffix={
                    <Pressable
                        style={styles.inputSuffix}
                        onPress={openPicker}
                        accessibilityRole="button"
                        accessibilityLabel="Open date picker"
                    >
                        <Text style={styles.inputSuffixText}>Pick</Text>
                    </Pressable>
                }
            />

            {/* ── iOS date picker bottom sheet ──────────────────────────────── */}
            {Platform.OS === 'ios' && (
                <Modal
                    visible={showPicker}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowPicker(false)}
                >
                    {/* Outer: tap overlay to dismiss */}
                    <TouchableOpacity
                        style={local.pickerOverlay}
                        activeOpacity={1}
                        onPress={() => setShowPicker(false)}
                    >
                        {/* Inner: absorb taps so they don't reach the overlay */}
                        <TouchableOpacity
                            style={local.pickerSheet}
                            activeOpacity={1}
                            onPress={() => { /* intentionally empty */ }}
                        >
                            <View style={local.pickerHeader}>
                                <Pressable onPress={() => setShowPicker(false)}>
                                    <Text style={local.pickerHeaderBtn}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        applyPickerDate(pickerDate);
                                        setShowPicker(false);
                                    }}
                                >
                                    <Text style={[local.pickerHeaderBtn, local.pickerHeaderBtnDone]}>
                                        Done
                                    </Text>
                                </Pressable>
                            </View>
                            <DateTimePicker
                                value={pickerDate}
                                mode="date"
                                display="spinner"
                                maximumDate={new Date()}
                                minimumDate={new Date(1900, 0, 1)}
                                onChange={handlePickerChange}
                                textColor={isDark ? '#FFFFFF' : '#000000'}
                            />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            )}

            {/* ── Android date picker — renders as system dialog ─────────────── */}
            {Platform.OS === 'android' && showPicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                    onChange={handlePickerChange}
                />
            )}
        </>
    );
}
