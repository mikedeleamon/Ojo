import { useState, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable } from '../../components/primitives';
import {
    AuthScaffold,
    AuthField,
    AuthStatus,
    AuthButton,
    BirthdayField,
    makeAuthStyles,
} from '../../components/auth';
import axios from '../../api/client';
import { AuthState, Settings } from '../../types';
import { getErrorMessage, saveAuth } from '../../lib/auth';
import { markOnboardingPending } from '../../lib/onboarding';
import { setAgeVerificationNeeded } from '../../lib/ageGate';
import { validatePassword } from '../../lib/passwordPolicy';
import { validateBirthday } from '../../lib/age';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { useTheme } from '../../theme/ThemeContext';
import LegalConsentNotice from '../../components/LegalConsentNotice';

/* ─── Validation ─────────────────────────────────────────────────────────── */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
const NAME_RE = /^[a-zA-Z\s'\-]{2,50}$/;

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
            // Same rules the server enforces — see lib/age.ts. This is for
            // immediate feedback only; /api/auth/signup re-checks and refuses
            // an underage date regardless of what happens here.
            const result = validateBirthday(val);
            return result.ok ? undefined : result.message;
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
    const { colors } = useTheme();
    const styles = useMemo(() => makeAuthStyles(colors), [colors]);

    const local = useMemo(
        () =>
            StyleSheet.create({
                title: { fontSize: 32, letterSpacing: -0.02 * 32 },
            }),
        [],
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

    // BirthdayField hands the committed value straight back, so validation reads
    // it directly rather than going through handleBlur — which would see the
    // pre-update `form` when the commit came from the picker.
    const handleBirthdayCommit = (formatted: string) => {
        setTouched(t => new Set(t).add('birthday'));
        const err = validateField('birthday', formatted, { ...form, birthday: formatted });
        setFieldErrors(e => ({ ...e, birthday: err }));
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
            // The form collects a date of birth and the server validated it, so
            // this account is already through the age gate. Recording that keeps
            // a stale flag from a previous account on this device out of the way.
            await setAgeVerificationNeeded(false);
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

                <BirthdayField
                    value={form.birthday}
                    onChange={v => setField('birthday', v)}
                    onCommit={handleBirthdayCommit}
                    error={errorFor('birthday')}
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
        </>
    );
}
