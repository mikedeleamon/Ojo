import { useState, useMemo } from 'react';
import { StyleSheet, Modal } from 'react-native';
import { View, Text } from './primitives';
import LegalWebViewScreen from '../features/settings/screens/LegalWebViewScreen';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../config/legal';
import { fonts, fontSizes } from '../theme/tokens';
import { useTheme } from '../theme/ThemeContext';

type DocKey = 'terms' | 'privacy' | null;

interface Props {
  /** Leading clause, e.g. "By creating an account" or "By continuing". */
  prefix?: string;
}

/**
 * Inline clickwrap consent line for the auth screens. The act of tapping the
 * primary CTA (Sign up / Continue) constitutes agreement; this notice provides
 * the required clear notice plus tappable links to the full documents.
 *
 * The documents open in a self-contained Modal (reusing LegalWebViewScreen)
 * rather than navigating to /account/legal, because that route is behind the
 * AuthGate and would bounce a logged-out user back to login.
 */
export default function LegalConsentNotice({ prefix = 'By continuing' }: Props) {
  const { colors } = useTheme();
  const [openDoc, setOpenDoc] = useState<DocKey>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        text: {
          fontFamily: fonts.body,
          fontSize: fontSizes.xs,
          lineHeight: fontSizes.xs * 1.5,
          color: colors.textMuted,
          textAlign: 'center',
        },
        link: {
          fontFamily: fonts.body,
          fontSize: fontSizes.xs,
          lineHeight: fontSizes.xs * 1.5,
          color: colors.textSecondary,
          textDecorationLine: 'underline',
        },
      }),
    [colors],
  );

  const doc = openDoc === 'terms' ? TERMS_OF_SERVICE : openDoc === 'privacy' ? PRIVACY_POLICY : undefined;

  return (
    <View accessible accessibilityRole="text">
      <Text style={styles.text}>
        {prefix}, you agree to our{' '}
        <Text
          style={styles.link}
          onPress={() => setOpenDoc('terms')}
          accessibilityRole="link"
          accessibilityLabel="View Terms of Service"
        >
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text
          style={styles.link}
          onPress={() => setOpenDoc('privacy')}
          accessibilityRole="link"
          accessibilityLabel="View Privacy Policy"
        >
          Privacy Policy
        </Text>
        .
      </Text>

      <Modal
        visible={openDoc !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpenDoc(null)}
      >
        <LegalWebViewScreen doc={doc} onClose={() => setOpenDoc(null)} />
      </Modal>
    </View>
  );
}
