import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { View, Text, Pressable, GlassCard } from '../primitives';
import { CloseIcon } from '../icons/ClosetIcons';
import { useTheme } from '../../theme/ThemeContext';
import { fonts, fontSizes, radius } from '../../theme/tokens';

interface Props {
  title:     string;
  body:      string;
  cta:       string;
  onPress:   () => void;
  onDismiss: () => void;
  /** 'theme' follows light/dark; 'ink' is for always-dark screens (Recap). */
  tone?:     'theme' | 'ink';
}

/**
 * One quiet inline row that points at Ojo Pro at a moment it is relevant.
 * Never a pop-up, and shown at most once (see useOneTimeMoment): the person
 * can read it, follow it, or close it, and nothing else on the screen moves.
 */
export default function ProMoment({ title, body, cta, onPress, onDismiss, tone = 'theme' }: Props) {
  const { colors } = useTheme();
  const ink = tone === 'ink';
  const st = useMemo(() => StyleSheet.create({
    card:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: radius.md, padding: 13 },
    text:  { flex: 1, gap: 3 },
    title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: ink ? '#F2F0EA' : colors.textPrimary },
    body:  {
      fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 19,
      color: ink ? 'rgba(242,240,234,0.8)' : colors.textSecondary,
    },
    cta:   {
      fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, marginTop: 4,
      color: ink ? '#BDF2D2' : colors.textPrimary,
    },
    close: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: -4, marginRight: -4 },
  }), [colors, ink]);

  return (
    <GlassCard style={st.card}>
      <Pressable style={st.text} onPress={onPress} accessibilityRole='button' accessibilityLabel={`${title}. ${cta}`}>
        <Text style={st.title}>{title}</Text>
        <Text style={st.body}>{body}</Text>
        <Text style={st.cta}>{cta} →</Text>
      </Pressable>
      <Pressable style={st.close} onPress={onDismiss} hitSlop={8} accessibilityRole='button' accessibilityLabel='Dismiss'>
        <CloseIcon size={12} color={ink ? 'rgba(242,240,234,0.6)' : colors.textMuted} decorative />
      </Pressable>
    </GlassCard>
  );
}
