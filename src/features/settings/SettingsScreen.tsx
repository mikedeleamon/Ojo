import { useState, useCallback } from 'react';
import { StyleSheet, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Pressable } from '../../components/primitives';
import { SETTINGS_CONFIG, SettingsAction } from './config';
import SettingsSection from './components/SettingsSection';
import { useSettings } from '../../hooks/useSettings';
import { useAppNavigation } from '../../hooks/useAppNavigation';
import { clearAuth } from '../../lib/auth';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../config/legal';
import {
    colors,
    spacing,
    radius,
    fonts,
    fontSizes,
    fontWeights,
} from '../../theme/tokens';

interface Props {
    onLogout?: () => void;
}

export default function SettingsScreen({ onLogout }: Props) {
    const nav = useAppNavigation();
    const { settings, refreshSettings } = useSettings();
    const [showLogout, setShowLogout] = useState(false);

    useFocusEffect(
        useCallback(() => {
            refreshSettings();
        }, [refreshSettings]),
    );

    const dispatch = (action: SettingsAction) => {
        if (action.type === 'navigate') {
            nav.push(action.to);
        } else if (action.type === 'legal') {
            const doc =
                action.doc === 'privacy' ? PRIVACY_POLICY : TERMS_OF_SERVICE;
            nav.push('Legal', { doc });
        }
    };

    const handleLogout = async () => {
        setShowLogout(false);
        await clearAuth();
        onLogout?.();
    };

    return (
        <SafeAreaView style={styles.root}>
            <View style={styles.header}>
                <Text style={styles.title}>Account</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {SETTINGS_CONFIG.map((section) => (
                    <SettingsSection
                        key={section.title}
                        section={section}
                        settings={settings}
                        onAction={dispatch}
                    />
                ))}

                <Pressable
                    style={styles.logoutBtn}
                    onPress={() => setShowLogout(true)}
                >
                    <Text style={styles.logoutText}>Log out</Text>
                </Pressable>
            </ScrollView>

            <Modal
                visible={showLogout}
                transparent
                animationType='fade'
            >
                <Pressable
                    style={styles.backdrop}
                    onPress={() => setShowLogout(false)}
                />
                <View style={styles.modalCard}>
                    <Text style={styles.modalTitle}>Log out?</Text>
                    <Text style={styles.modalBody}>
                        You'll need to sign in again to access your wardrobe.
                    </Text>
                    <View style={styles.modalActions}>
                        <Pressable
                            style={styles.modalCancel}
                            onPress={() => setShowLogout(false)}
                        >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                        </Pressable>
                        <Pressable
                            style={styles.modalConfirm}
                            onPress={handleLogout}
                        >
                            <Text style={styles.modalConfirmText}>Log out</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bgDefault },
    header: {
        padding: spacing.md,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: colors.glassBorder,
    },
    title: {
        fontFamily: 'DMSerifDisplay',
        fontSize: 28,
        color: colors.textPrimary,
    },
    content: {
        padding: spacing.md,
        gap: spacing.lg,
        paddingBottom: spacing.xl,
    },
    logoutBtn: {
        paddingVertical: 14,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.sm,
        alignItems: 'center',
    },
    logoutText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base,
        color: colors.dangerText,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    modalCard: {
        position: 'absolute',
        left: 24,
        right: 24,
        top: '35%',
        backgroundColor: 'rgba(15,23,42,0.97)',
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: 12,
        borderWidth: 1,
        borderColor: colors.glassBorder,
    },
    modalTitle: {
        fontFamily: fonts.body,
        fontSize: 17,
        fontWeight: fontWeights.semibold,
        color: colors.textPrimary,
    },
    modalBody: {
        fontFamily: fonts.body,
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 14 * 1.6,
    },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
    modalCancel: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.sm,
        alignItems: 'center',
    },
    modalCancelText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base - 1,
        fontWeight: fontWeights.medium,
        color: colors.textSecondary,
    },
    modalConfirm: {
        flex: 1,
        paddingVertical: 12,
        backgroundColor: colors.glassBg,
        borderWidth: 1,
        borderColor: colors.glassBorder,
        borderRadius: radius.sm,
        alignItems: 'center',
    },
    modalConfirmText: {
        fontFamily: fonts.body,
        fontSize: fontSizes.base - 1,
        fontWeight: fontWeights.medium,
        color: colors.textPrimary,
    },
});
