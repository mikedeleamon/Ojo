import { useState, useMemo } from 'react';
import {
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Modal,
    TouchableOpacity,
    Keyboard,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, TextInput, Pressable } from '../../components/primitives';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { markOnboardingPending } from '../../lib/onboarding';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { spacing, radius, fonts, fontSizes, fontWeights } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeContext';
import LegalConsentNotice from '../../components/LegalConsentNotice';

/* ─── Validation ─────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const NAME_RE = /^[a-zA-Z\s'\-]{2,50}$/;

/** Auto-insert slashes as the user types: 01 → 01/ → 01/15 → 01/15/2000 */
function formatBirthday(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBirthday(val: string): Date | null {
    const parts = val.split('/');
    if (parts.length !== 3) return null;
    const [mm, dd, yyyy] = parts.map(Number);
    if (!mm || !dd || !yyyy || String(yyyy).length !== 4) return null;
    const d = new Date(yyyy, mm - 1, dd);
    // Catch invalid combos like Feb 30
    if (d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return d;
}

function validateField(
    key: keyof FormState,
    val: string,
    all: FormState,
): string | undefined {
    switch (key) {
        case 'firstName':
        case 'lastName':
            if (!val.trim()) return 'Required';
            if (!NAME_RE.test(val.trim()))
                return 'Letters, spaces, hyphens and apostrophes only';
            return undefined;
        case 'username':
            if (!val.trim()) return 'Required';
            if (!USERNAME_RE.test(val))
                return '3–20 characters · letters, numbers and underscores only';
            return undefined;
        case 'email':
            if (!val.trim()) return 'Required';
            if (!EMAIL_RE.test(val.trim())) return 'Enter a valid email address';
            return undefined;
        case 'password':
            if (!val) return 'Required';
            if (val.length < 8) return 'At least 8 characters required';
            if (!/[A-Z]/.test(val)) return 'Must include at least one uppercase letter';
            if (!/\d/.test(val)) return 'Must include at least one number';
            return undefined;
        case 'confirmPassword':
            if (!val) return 'Required';
            if (val !== all.password) return "Passwords don't match";
            return undefined;
        case 'birthday': {
            if (!val) return 'Required';
            const date = parseBirthday(val);
            if (!date) return 'Enter a valid date (MM/DD/YYYY)';
            if (date > new Date()) return 'Birthday cannot be in the future';
            const ageYears =
                (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
            if (ageYears < 13) return 'You must be at least 13 years old to sign up';
            if (ageYears > 120) return 'Enter a valid birthday';
            return undefined;
        }
        default:
            return undefined;
    }
}

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface FormState {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    password: string;
    confirmPassword: string;
    birthday: string;
}

interface Props {
    onLogin?: () => void;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function SignupPage({ onLogin }: Props) {
    const { colors, isDark } = useTheme();
    const insets = useSafeAreaInsets();

    const styles = useMemo(
        () =>
            StyleSheet.create({
                root: { flex: 1, backgroundColor: colors.bgDefault },
                content: { flexGrow: 1, padding: spacing.md, gap: spacing.md },
                title: {
                    fontFamily: 'DMSerifDisplay',
                    fontSize: 32,
                    color: colors.textPrimary,
                    letterSpacing: -0.02 * 32,
                },
                errorBox: {
                    padding: spacing.sm,
                    backgroundColor: colors.errorBg,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: colors.errorBorder,
                },
                errorText: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.sm,
                    color: colors.errorText,
                },
                field: { gap: 4 },
                label: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.xs,
                    fontWeight: fontWeights.medium,
                    letterSpacing: 0.1 * fontSizes.xs,
                    textTransform: 'uppercase',
                    color: colors.textMuted,
                },
                inputRow: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: colors.glassBg,
                    borderWidth: 1,
                    borderColor: colors.glassBorder,
                    borderRadius: radius.sm,
                },
                inputRowError: {
                    borderColor: colors.errorBorder,
                },
                input: {
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: spacing.md,
                    color: colors.textPrimary,
                    fontFamily: fonts.body,
                    fontSize: fontSizes.base,
                },
                inputSuffix: {
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 12,
                },
                inputSuffixText: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.sm,
                    color: colors.textMuted,
                },
                fieldError: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.xs,
                    color: colors.errorText,
                    marginTop: 2,
                },
                btn: {
                    paddingVertical: 14,
                    backgroundColor: colors.saveBtnBg,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                },
                btnText: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.base,
                    fontWeight: fontWeights.semibold,
                    color: colors.saveBtnText,
                },
                footer: {
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                },
                footerText: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.sm,
                    color: colors.textSecondary,
                },
                link: {
                    fontFamily: fonts.body,
                    fontSize: fontSizes.sm,
                    color: colors.textPrimary,
                    textDecorationLine: 'underline',
                },
                // Date picker modal (iOS)
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

    const nav = useAppNavigation();

    const [form, setForm] = useState<FormState>({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        birthday: '',
    });
    const [fieldErrors, setFieldErrors] = useState<
        Partial<Record<keyof FormState, string>>
    >({});
    const [touched, setTouched] = useState<Set<keyof FormState>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerDate, setPickerDate] = useState<Date>(new Date(2000, 0, 1));

    /* ── Field helpers ─────────────────────────────────────────────────────── */

    const setField = (key: keyof FormState, val: string) => {
        setForm(f => ({ ...f, [key]: val }));
        if (touched.has(key)) {
            const err = validateField(key, val, { ...form, [key]: val });
            setFieldErrors(e => ({ ...e, [key]: err }));
        }
    };

    const handleBlur = (key: keyof FormState) => {
        setTouched(t => new Set(t).add(key));
        // Trim whitespace on blur for text fields
        let val = form[key];
        if (['firstName', 'lastName', 'email', 'username'].includes(key)) {
            val = val.trim();
            setForm(f => ({ ...f, [key]: val }));
        }
        const err = validateField(key, val, { ...form, [key]: val });
        setFieldErrors(e => ({ ...e, [key]: err }));
    };

    const hasError = (key: keyof FormState) =>
        touched.has(key) && !!fieldErrors[key];

    /* ── Birthday ──────────────────────────────────────────────────────────── */

    const handleBirthdayChange = (text: string) => {
        const formatted = formatBirthday(text);
        setField('birthday', formatted);
    };

    const openDatePicker = () => {
        Keyboard.dismiss();
        const existing = parseBirthday(form.birthday);
        setPickerDate(existing ?? new Date(2000, 0, 1));
        setShowDatePicker(true);
    };

    const applyPickerDate = (date: Date) => {
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const yyyy = String(date.getFullYear());
        const formatted = `${mm}/${dd}/${yyyy}`;
        setTouched(t => new Set(t).add('birthday'));
        setForm(f => ({ ...f, birthday: formatted }));
        const err = validateField('birthday', formatted, { ...form, birthday: formatted });
        setFieldErrors(e => ({ ...e, birthday: err }));
    };

    const handlePickerChange = (event: DateTimePickerEvent, date?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
            if (event.type === 'dismissed' || !date) return;
            applyPickerDate(date);
        } else {
            // iOS spinner: update live, commit on Done
            if (date) setPickerDate(date);
        }
    };

    /* ── Submit ────────────────────────────────────────────────────────────── */

    const handleSubmit = async () => {
        const allKeys = Object.keys(form) as (keyof FormState)[];
        const newErrors: Partial<Record<keyof FormState, string>> = {};
        for (const key of allKeys) {
            const err = validateField(key, form[key], form);
            if (err) newErrors[key] = err;
        }
        setFieldErrors(newErrors);
        setTouched(new Set(allKeys));

        if (Object.keys(newErrors).length > 0) {
            setError('Please fix the errors highlighted above.');
            return;
        }

        setError(null);
        setLoading(true);
        try {
            const { data } = await axios.post<AuthState & { settings: Settings }>(
                '/api/auth/signup',
                {
                    firstName: form.firstName,
                    lastName: form.lastName,
                    username: form.username,
                    email: form.email,
                    password: form.password,
                    birthday: form.birthday,
                },
            );
            await saveAuth(data.token, data.user);
            // Completing the sign-up form is the only thing that triggers
            // first-run onboarding; AuthGate reads this flag to redirect.
            await markOnboardingPending();
            onLogin?.();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Sign up failed. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    /* ── Render ────────────────────────────────────────────────────────────── */

    return (
        <SafeAreaView style={styles.root}>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.title}>Create account</Text>

                    {error ? (
                        <View
                            style={styles.errorBox}
                            accessibilityLiveRegion="assertive"
                            accessible
                            accessibilityLabel={error}
                        >
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    ) : null}

                    {/* First name */}
                    <View style={styles.field}>
                        <Text style={styles.label}>First name</Text>
                        <View
                            style={[
                                styles.inputRow,
                                hasError('firstName') && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                style={styles.input}
                                placeholder="Jane"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="words"
                                textContentType="givenName"
                                value={form.firstName}
                                onChangeText={v => setField('firstName', v)}
                                onBlur={() => handleBlur('firstName')}
                                accessibilityLabel="First name"
                            />
                        </View>
                        {hasError('firstName') && (
                            <Text style={styles.fieldError}>{fieldErrors.firstName}</Text>
                        )}
                    </View>

                    {/* Last name */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Last name</Text>
                        <View
                            style={[
                                styles.inputRow,
                                hasError('lastName') && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                style={styles.input}
                                placeholder="Doe"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="words"
                                textContentType="familyName"
                                value={form.lastName}
                                onChangeText={v => setField('lastName', v)}
                                onBlur={() => handleBlur('lastName')}
                                accessibilityLabel="Last name"
                            />
                        </View>
                        {hasError('lastName') && (
                            <Text style={styles.fieldError}>{fieldErrors.lastName}</Text>
                        )}
                    </View>

                    {/* Date of birth */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Date of birth</Text>
                        <View
                            style={[
                                styles.inputRow,
                                hasError('birthday') && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                style={styles.input}
                                placeholder="MM/DD/YYYY"
                                placeholderTextColor={colors.textMuted}
                                keyboardType="number-pad"
                                maxLength={10}
                                value={form.birthday}
                                onChangeText={handleBirthdayChange}
                                onBlur={() => handleBlur('birthday')}
                                accessibilityLabel="Date of birth"
                            />
                            <Pressable
                                style={styles.inputSuffix}
                                onPress={openDatePicker}
                                accessibilityRole="button"
                                accessibilityLabel="Open date picker"
                            >
                                <Text style={styles.inputSuffixText}>Pick</Text>
                            </Pressable>
                        </View>
                        {hasError('birthday') && (
                            <Text style={styles.fieldError}>{fieldErrors.birthday}</Text>
                        )}
                    </View>

                    {/* Username */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Username</Text>
                        <View
                            style={[
                                styles.inputRow,
                                hasError('username') && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                style={styles.input}
                                placeholder="janedoe"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                autoCorrect={false}
                                textContentType="username"
                                // Strip disallowed chars as the user types
                                value={form.username}
                                onChangeText={v =>
                                    setField('username', v.replace(/[^a-zA-Z0-9_]/g, ''))
                                }
                                onBlur={() => handleBlur('username')}
                                accessibilityLabel="Username"
                            />
                        </View>
                        {hasError('username') && (
                            <Text style={styles.fieldError}>{fieldErrors.username}</Text>
                        )}
                    </View>

                    {/* Email */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Email</Text>
                        <View
                            style={[
                                styles.inputRow,
                                hasError('email') && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                style={styles.input}
                                placeholder="jane@example.com"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                keyboardType="email-address"
                                textContentType="emailAddress"
                                autoCorrect={false}
                                value={form.email}
                                onChangeText={v => setField('email', v)}
                                onBlur={() => handleBlur('email')}
                                accessibilityLabel="Email"
                            />
                        </View>
                        {hasError('email') && (
                            <Text style={styles.fieldError}>{fieldErrors.email}</Text>
                        )}
                    </View>

                    {/* Password */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Password</Text>
                        <View
                            style={[
                                styles.inputRow,
                                hasError('password') && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                style={styles.input}
                                placeholder="8+ chars · 1 uppercase · 1 number"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry={!showPassword}
                                textContentType="newPassword"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={form.password}
                                onChangeText={v => setField('password', v)}
                                onBlur={() => handleBlur('password')}
                                accessibilityLabel="Password"
                            />
                            <Pressable
                                style={styles.inputSuffix}
                                onPress={() => setShowPassword(s => !s)}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    showPassword ? 'Hide password' : 'Show password'
                                }
                            >
                                <Text style={styles.inputSuffixText}>
                                    {showPassword ? 'Hide' : 'Show'}
                                </Text>
                            </Pressable>
                        </View>
                        {hasError('password') && (
                            <Text style={styles.fieldError}>{fieldErrors.password}</Text>
                        )}
                    </View>

                    {/* Confirm password */}
                    <View style={styles.field}>
                        <Text style={styles.label}>Confirm password</Text>
                        <View
                            style={[
                                styles.inputRow,
                                hasError('confirmPassword') && styles.inputRowError,
                            ]}
                        >
                            <TextInput
                                style={styles.input}
                                placeholder="Same password"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry={!showConfirm}
                                textContentType="newPassword"
                                autoCapitalize="none"
                                autoCorrect={false}
                                value={form.confirmPassword}
                                onChangeText={v => setField('confirmPassword', v)}
                                onBlur={() => handleBlur('confirmPassword')}
                                accessibilityLabel="Confirm password"
                            />
                            <Pressable
                                style={styles.inputSuffix}
                                onPress={() => setShowConfirm(s => !s)}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    showConfirm
                                        ? 'Hide confirm password'
                                        : 'Show confirm password'
                                }
                            >
                                <Text style={styles.inputSuffixText}>
                                    {showConfirm ? 'Hide' : 'Show'}
                                </Text>
                            </Pressable>
                        </View>
                        {hasError('confirmPassword') && (
                            <Text style={styles.fieldError}>
                                {fieldErrors.confirmPassword}
                            </Text>
                        )}
                    </View>

                    <Pressable
                        style={[styles.btn, loading && { opacity: 0.5 }]}
                        onPress={handleSubmit}
                        disabled={loading}
                        accessibilityRole="button"
                        accessibilityLabel={
                            loading ? 'Creating account' : 'Create account'
                        }
                        accessibilityState={{ busy: loading, disabled: loading }}
                    >
                        <Text style={styles.btnText}>
                            {loading ? 'Creating account…' : 'Create account'}
                        </Text>
                    </Pressable>

                    <LegalConsentNotice prefix="By creating an account" />

                    <View style={styles.footer}>
                        <Text style={styles.footerText}>
                            Already have an account?{' '}
                        </Text>
                        <Pressable
                            onPress={() => nav.goBack()}
                            accessibilityRole="link"
                            accessibilityLabel="Sign in"
                        >
                            <Text style={styles.link}>Sign in</Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── iOS date picker bottom sheet ──────────────────────────────── */}
            {Platform.OS === 'ios' && (
                <Modal
                    visible={showDatePicker}
                    transparent
                    animationType="slide"
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    {/* Outer: tap overlay to dismiss */}
                    <TouchableOpacity
                        style={styles.pickerOverlay}
                        activeOpacity={1}
                        onPress={() => setShowDatePicker(false)}
                    >
                        {/* Inner: absorb taps so they don't reach the overlay */}
                        <TouchableOpacity
                            style={styles.pickerSheet}
                            activeOpacity={1}
                            onPress={() => { /* intentionally empty */ }}
                        >
                            <View style={styles.pickerHeader}>
                                <Pressable onPress={() => setShowDatePicker(false)}>
                                    <Text style={styles.pickerHeaderBtn}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        applyPickerDate(pickerDate);
                                        setShowDatePicker(false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.pickerHeaderBtn,
                                            styles.pickerHeaderBtnDone,
                                        ]}
                                    >
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
            {Platform.OS === 'android' && showDatePicker && (
                <DateTimePicker
                    value={pickerDate}
                    mode="date"
                    display="default"
                    maximumDate={new Date()}
                    minimumDate={new Date(1900, 0, 1)}
                    onChange={handlePickerChange}
                />
            )}
        </SafeAreaView>
    );
}
