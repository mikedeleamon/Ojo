import { useState, useMemo } from 'react';
import {
    StyleSheet,
    Platform,
    Modal,
    TouchableOpacity,
    Keyboard,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, Pressable } from '../../components/primitives';
import {
    AuthScaffold,
    AuthField,
    AuthStatus,
    AuthButton,
    makeAuthStyles,
} from '../../components/auth';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { markOnboardingPending } from '../../lib/onboarding';
import { validatePassword } from '../../lib/passwordPolicy';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { spacing, fonts, fontSizes, fontWeights } from '../../theme/tokens';
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
            return validatePassword(val);
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
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);

    // Date-picker bottom sheet styles — unique to this screen.
    const local = useMemo(
        () =>
            StyleSheet.create({
                title: { fontSize: 32, letterSpacing: -0.02 * 32 },
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

    const errorFor = (key: keyof FormState) =>
        touched.has(key) ? fieldErrors[key] : undefined;

    /* ── Birthday ──────────────────────────────────────────────────────────── */

    const handleBirthdayChange = (text: string) => {
        setField('birthday', formatBirthday(text));
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
        <>
            <AuthScaffold>
                <Text style={[styles.title, local.title]}>Create account</Text>

                {error ? <AuthStatus message={error} /> : null}

                <AuthField
                    label="First name"
                    placeholder="Jane"
                    autoCapitalize="words"
                    textContentType="givenName"
                    value={form.firstName}
                    onChangeText={v => setField('firstName', v)}
                    onBlur={() => handleBlur('firstName')}
                    error={errorFor('firstName')}
                />

                <AuthField
                    label="Last name"
                    placeholder="Doe"
                    autoCapitalize="words"
                    textContentType="familyName"
                    value={form.lastName}
                    onChangeText={v => setField('lastName', v)}
                    onBlur={() => handleBlur('lastName')}
                    error={errorFor('lastName')}
                />

                <AuthField
                    label="Date of birth"
                    placeholder="MM/DD/YYYY"
                    keyboardType="number-pad"
                    maxLength={10}
                    value={form.birthday}
                    onChangeText={handleBirthdayChange}
                    onBlur={() => handleBlur('birthday')}
                    error={errorFor('birthday')}
                    suffix={
                        <Pressable
                            style={styles.inputSuffix}
                            onPress={openDatePicker}
                            accessibilityRole="button"
                            accessibilityLabel="Open date picker"
                        >
                            <Text style={styles.inputSuffixText}>Pick</Text>
                        </Pressable>
                    }
                />

                <AuthField
                    label="Username"
                    placeholder="janedoe"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="username"
                    value={form.username}
                    // Strip disallowed chars as the user types
                    onChangeText={v =>
                        setField('username', v.replace(/[^a-zA-Z0-9_]/g, ''))
                    }
                    onBlur={() => handleBlur('username')}
                    error={errorFor('username')}
                />

                <AuthField
                    label="Email"
                    placeholder="jane@example.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    autoCorrect={false}
                    value={form.email}
                    onChangeText={v => setField('email', v)}
                    onBlur={() => handleBlur('email')}
                    error={errorFor('email')}
                />

                <AuthField
                    label="Password"
                    placeholder="8+ chars · 1 uppercase · 1 number"
                    secureToggle
                    textContentType="newPassword"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={form.password}
                    onChangeText={v => setField('password', v)}
                    onBlur={() => handleBlur('password')}
                    error={errorFor('password')}
                />

                <AuthField
                    label="Confirm password"
                    placeholder="Same password"
                    secureToggle
                    textContentType="newPassword"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={form.confirmPassword}
                    onChangeText={v => setField('confirmPassword', v)}
                    onBlur={() => handleBlur('confirmPassword')}
                    error={errorFor('confirmPassword')}
                />

                <AuthButton
                    label="Create account"
                    loadingLabel="Creating account…"
                    loading={loading}
                    onPress={handleSubmit}
                />

                <LegalConsentNotice prefix="By creating an account" />

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Already have an account? </Text>
                    <Pressable
                        onPress={() => nav.goBack()}
                        accessibilityRole="link"
                        accessibilityLabel="Sign in"
                    >
                        <Text style={styles.link}>Sign in</Text>
                    </Pressable>
                </View>
            </AuthScaffold>

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
                        style={local.pickerOverlay}
                        activeOpacity={1}
                        onPress={() => setShowDatePicker(false)}
                    >
                        {/* Inner: absorb taps so they don't reach the overlay */}
                        <TouchableOpacity
                            style={local.pickerSheet}
                            activeOpacity={1}
                            onPress={() => { /* intentionally empty */ }}
                        >
                            <View style={local.pickerHeader}>
                                <Pressable onPress={() => setShowDatePicker(false)}>
                                    <Text style={local.pickerHeaderBtn}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => {
                                        applyPickerDate(pickerDate);
                                        setShowDatePicker(false);
                                    }}
                                >
                                    <Text
                                        style={[
                                            local.pickerHeaderBtn,
                                            local.pickerHeaderBtnDone,
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
        </>
    );
}
