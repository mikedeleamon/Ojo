import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Animated, TextInput as RNTextInput,
  Image, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, Circle } from 'react-native-svg';
import { View, Text, Pressable } from '../../components/primitives';
import { useSettings } from '../../hooks/useSettings';
import { storage } from '../../lib/storage';
import { auth } from '../../lib/auth';
import axios from '../../api/client';
import { colors, spacing, radius, fonts, fontSizes, fontWeights, shadows } from '../../theme/tokens';

const ONBOARD_KEY = 'ojo_onboarding_done';
const STYLES_LIST = ['Casual', 'Business Casual', 'Formal', 'Athletic', 'Streetwear', 'Minimalist'];
const TEMP_UNITS  = ['Imperial', 'Metric'] as const;
const TOTAL_STEPS = 4;

interface Props { onComplete?: () => void; }

// ── Step progress dots ────────────────────────────────────────────────────────
const Dots = ({ step }: { step: number }) => (
  <View style={st.dots}>
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <View
        key={i}
        style={[
          st.dot,
          i === step - 1 && st.dotActive,
          i < step - 1  && st.dotDone,
        ]}
      />
    ))}
  </View>
);

// ── Circular icon container ───────────────────────────────────────────────────
const StepIcon = ({ children }: { children: React.ReactNode }) => (
  <View style={st.stepIcon}>{children}</View>
);

// ── Arrow icon used inside primary buttons ────────────────────────────────────
const ArrowRight = () => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M3 8h10M9 4l4 4-4 4"
      stroke={colors.saveBtnText}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ── Animated loading dots (step 4) ────────────────────────────────────────────
const LoadingDots = () => {
  const anims = useRef([
    new Animated.Value(0.4),
    new Animated.Value(0.4),
    new Animated.Value(0.4),
  ]).current;

  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 200),
          Animated.timing(a, { toValue: 1,   duration: 400, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.4, duration: 400, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  return (
    <View style={st.loadingDots}>
      {anims.map((a, i) => (
        <Animated.View key={i} style={[st.loadingDot, { opacity: a }]} />
      ))}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingPage({ onComplete }: Props) {
  const { settings, saveSettings } = useSettings();

  const [step, setStep] = useState(1);

  // Step 2 — closet creation
  const [closetName,    setClosetName]    = useState('My Wardrobe');
  const [closetDone,    setClosetDone]    = useState(false);
  const [closetErr,     setClosetErr]     = useState<string | null>(null);
  const [closetLoading, setClosetLoading] = useState(false);

  // Step 3 — preferences
  const [styleChoice, setStyleChoice] = useState(settings.clothingStyle || 'Casual');
  const [tempUnit,    setTempUnit]    = useState<'Imperial' | 'Metric'>(
    (settings.temperatureScale as 'Imperial' | 'Metric') || 'Imperial',
  );

  // Card slide + fade animation
  const slideAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const transition = (toStep: number, dir: 'forward' | 'back') => {
    const outX = dir === 'forward' ? -36 : 36;
    const inX  = dir === 'forward' ?  36 : -36;
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0,    duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim,   { toValue: outX,  duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(toStep);
      slideAnim.setValue(inX);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(slideAnim,   { toValue: 0,  duration: 240, useNativeDriver: true }),
      ]).start();
    });
  };

  const advance = (toStep: number) => transition(toStep, 'forward');
  const goBack  = (toStep: number) => transition(toStep, 'back');

  const handleCreateCloset = async () => {
    if (!closetName.trim()) return;
    setClosetLoading(true);
    setClosetErr(null);
    try {
      await axios.post('/api/closets', { name: closetName.trim() }, auth());
      setClosetDone(true);
    } catch {
      setClosetErr('Could not create closet — you can create one later in My Closet.');
    } finally {
      setClosetLoading(false);
    }
  };

  const handleFinish = async () => {
    try {
      await saveSettings({ ...settings, clothingStyle: styleChoice, temperatureScale: tempUnit });
    } catch { /* non-fatal */ }
    await storage.setItem(ONBOARD_KEY, 'true');
    advance(4);
  };

  const handleSkip = async () => {
    await storage.setItem(ONBOARD_KEY, 'true');
    onComplete?.();
  };

  useEffect(() => {
    if (step === 4) {
      const t = setTimeout(() => onComplete?.(), 1800);
      return () => clearTimeout(t);
    }
  }, [step, onComplete]);

  return (
    <SafeAreaView style={st.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={st.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={st.card}>
            <Animated.View
              style={{ opacity: opacityAnim, transform: [{ translateX: slideAnim }] }}
            >

              {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
              {step === 1 && (
                <View style={st.stepShell}>
                  <Dots step={1} />
                  <Image
                    source={require('../../assets/images/logos/ojoLogo.png')}
                    style={st.logo}
                    resizeMode="contain"
                  />
                  <Text style={st.heading}>Welcome to Ojo</Text>
                  <Text style={st.sub}>
                    Let's take 60 seconds to set up your wardrobe so Ojo can suggest
                    perfect outfits every day.
                  </Text>
                  <View style={st.illustrationRow}>
                    <View style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 2a3 3 0 0 1 3 3v1l4 2v14H5V8l4-2V5a3 3 0 0 1 3-3z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <View style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 6l4-3h10l4 3-4 4v11H7V10L3 6z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <View style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 16l4-8h4l1 4h9v4H3z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </View>
                    <View style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M4 6l3-3 5 3 5-3 3 3v14H4V6z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </View>
                  </View>
                  <Pressable style={st.primaryBtn} onPress={() => advance(2)}>
                    <Text style={st.primaryBtnText}>Let's go</Text>
                    <ArrowRight />
                  </Pressable>
                  <Pressable onPress={handleSkip}>
                    <Text style={st.skipLink}>Skip setup</Text>
                  </Pressable>
                </View>
              )}

              {/* ── Step 2: Create Closet ────────────────────────────────────── */}
              {step === 2 && (
                <View style={st.stepShell}>
                  <Dots step={2} />
                  <StepIcon>
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M12 4a2 2 0 0 1 2 2c0 .74-.4 1.38-1 1.73V9l8 5.5A1 1 0 0 1 20 16H4a1 1 0 0 1-.99-1.5L11 9V7.73A2 2 0 0 1 12 4Z"
                        stroke={colors.textSecondary} strokeWidth={1.5}
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                    </Svg>
                  </StepIcon>
                  <Text style={st.stepHeading}>Name your first closet</Text>
                  <Text style={st.stepDesc}>This will hold your clothes. You can create more later.</Text>

                  {closetDone ? (
                    <View style={st.successBadge}>
                      <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
                        <Circle cx={9} cy={9} r={8} stroke="rgba(52,211,153,0.8)" strokeWidth={1.5} />
                        <Path d="M5.5 9l2.5 2.5 4.5-4.5" stroke="rgba(52,211,153,0.9)"
                          strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                      <Text style={st.successText}>"{closetName}" created!</Text>
                    </View>
                  ) : (
                    <>
                      {closetErr ? <Text style={st.errText}>{closetErr}</Text> : null}
                      <View style={st.inputRow}>
                        <RNTextInput
                          style={st.textInput}
                          value={closetName}
                          onChangeText={setClosetName}
                          placeholder="My Wardrobe"
                          placeholderTextColor={colors.textMuted}
                          onSubmitEditing={handleCreateCloset}
                          returnKeyType="done"
                          autoFocus
                          textAlign="center"
                        />
                      </View>
                      <Pressable
                        style={[st.primaryBtn, (closetLoading || !closetName.trim()) && st.primaryBtnDisabled]}
                        onPress={handleCreateCloset}
                        disabled={closetLoading || !closetName.trim()}
                      >
                        <Text style={st.primaryBtnText}>{closetLoading ? 'Creating…' : 'Create closet'}</Text>
                      </Pressable>
                    </>
                  )}

                  <View style={st.navRow}>
                    <Pressable style={st.ghostBtn} onPress={() => goBack(1)}>
                      <Text style={st.ghostBtnText}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={[st.primaryBtn, (!closetDone && !closetErr) && st.primaryBtnDisabled]}
                      onPress={() => advance(3)}
                      disabled={!closetDone && !closetErr}
                    >
                      <Text style={st.primaryBtnText}>{closetErr ? 'Skip this step' : 'Next'}</Text>
                      <ArrowRight />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ── Step 3: Preferences ──────────────────────────────────────── */}
              {step === 3 && (
                <View style={st.stepShell}>
                  <Dots step={3} />
                  <StepIcon>
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                      <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                        stroke={colors.textSecondary} strokeWidth={1.5} />
                      <Path
                        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                        stroke={colors.textSecondary} strokeWidth={1.5} strokeLinecap="round"
                      />
                    </Svg>
                  </StepIcon>
                  <Text style={st.stepHeading}>Your preferences</Text>
                  <Text style={st.stepDesc}>Help Ojo suggest outfits that match your style.</Text>

                  <View style={st.prefSection}>
                    <Text style={st.prefLabel}>Clothing style</Text>
                    <View style={st.chipGrid}>
                      {STYLES_LIST.map(s => (
                        <Pressable
                          key={s}
                          style={[st.chip, styleChoice === s && st.chipActive]}
                          onPress={() => setStyleChoice(s)}
                        >
                          <Text style={[st.chipText, styleChoice === s && st.chipTextActive]}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={st.prefSection}>
                    <Text style={st.prefLabel}>Temperature units</Text>
                    <View style={st.segmented}>
                      {TEMP_UNITS.map((u, i) => (
                        <Pressable
                          key={u}
                          style={[
                            st.seg,
                            tempUnit === u && st.segActive,
                            i < TEMP_UNITS.length - 1 && st.segDivider,
                          ]}
                          onPress={() => setTempUnit(u)}
                        >
                          <Text style={[st.segText, tempUnit === u && st.segTextActive]}>
                            {u === 'Imperial' ? '°F Imperial' : '°C Metric'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={st.navRow}>
                    <Pressable style={st.ghostBtn} onPress={() => goBack(2)}>
                      <Text style={st.ghostBtnText}>Back</Text>
                    </Pressable>
                    <Pressable style={st.primaryBtn} onPress={handleFinish}>
                      <Text style={st.primaryBtnText}>Finish setup</Text>
                      <ArrowRight />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ── Step 4: Done ─────────────────────────────────────────────── */}
              {step === 4 && (
                <View style={st.stepShell}>
                  <Dots step={4} />
                  <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
                    <Circle cx={12} cy={12} r={10} stroke="rgba(52,211,153,0.8)" strokeWidth={1.5} />
                    <Path
                      d="M7.5 12l3 3 6-6"
                      stroke="rgba(52,211,153,0.9)"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text style={st.stepHeading}>You're all set!</Text>
                  <Text style={st.stepDesc}>Taking you to your dashboard…</Text>
                  <LoadingDots />
                </View>
              )}

            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bgDefault },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.md },

  // ── Card ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    borderRadius:    radius.lg,
    paddingTop:      spacing.xl,
    paddingBottom:   spacing.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.glass,
  },

  // ── Step shell ────────────────────────────────────────────────────────────
  stepShell: {
    alignItems: 'center',
    gap:        spacing.md,
  },

  // ── Dots ──────────────────────────────────────────────────────────────────
  dots: {
    flexDirection: 'row',
    gap:           6,
    marginBottom:  spacing.xs,
  },
  dot: {
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.glassBorder,
  },
  dotActive: {
    width:           18,
    borderRadius:    radius.pill,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  dotDone: {
    backgroundColor: 'rgba(52,211,153,0.65)',
  },

  // ── Step 1 ────────────────────────────────────────────────────────────────
  logo: {
    height: 36,
    width:  160,
  },
  heading: {
    fontFamily:    fonts.display,
    fontSize:      34,
    color:         colors.textPrimary,
    letterSpacing: -0.02 * 34,
    textAlign:     'center',
    lineHeight:    34 * 1.1,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.base,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: fontSizes.base * 1.65,
  },
  illustrationRow: {
    flexDirection: 'row',
    gap:           spacing.md,
    marginVertical: spacing.sm,
  },
  iconPill: {
    width:           56,
    height:          56,
    borderRadius:    28,
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Step icon circle (steps 2 & 3) ────────────────────────────────────────
  stepIcon: {
    width:           64,
    height:          64,
    borderRadius:    32,
    backgroundColor: colors.glassBg,
    borderWidth:     1,
    borderColor:     colors.glassBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },

  // ── Step typography ───────────────────────────────────────────────────────
  stepHeading: {
    fontFamily:    fonts.display,
    fontSize:      27,
    color:         colors.textPrimary,
    letterSpacing: -0.02 * 27,
    textAlign:     'center',
  },
  stepDesc: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
    textAlign:  'center',
    lineHeight: fontSizes.sm * 1.6,
  },

  // ── Buttons ───────────────────────────────────────────────────────────────
  primaryBtn: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 13,
    paddingHorizontal: 28,
    backgroundColor: colors.saveBtnBg,
    borderRadius:    radius.pill,
  },
  primaryBtnDisabled: {
    opacity: 0.45,
  },
  primaryBtnText: {
    fontFamily:  fonts.body,
    fontSize:    fontSizes.base,
    fontWeight:  fontWeights.semibold,
    color:       colors.saveBtnText,
  },
  ghostBtn: {
    paddingVertical:   12,
    paddingHorizontal: 20,
    backgroundColor:   'transparent',
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.pill,
  },
  ghostBtnText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
  },
  navRow: {
    flexDirection: 'row',
    gap:           spacing.sm,
    alignItems:    'center',
    justifyContent:'center',
    width:         '100%',
    marginTop:     spacing.xs,
  },
  skipLink: {
    fontFamily:         fonts.body,
    fontSize:           12,
    color:              colors.textMuted,
    textDecorationLine: 'underline',
  },

  // ── Step 2: closet input ──────────────────────────────────────────────────
  inputRow: {
    width: '100%',
  },
  textInput: {
    width:             '100%',
    paddingVertical:   14,
    paddingHorizontal: spacing.md,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       'rgba(255,255,255,0.28)',
    borderRadius:      radius.sm,
    color:             colors.textPrimary,
    fontFamily:        fonts.body,
    fontSize:          fontSizes.base,
    textAlign:         'center',
  },
  successBadge: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(52,211,153,0.10)',
    borderWidth:     1,
    borderColor:     'rgba(52,211,153,0.30)',
    borderRadius:    radius.pill,
  },
  successText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      'rgba(52,211,153,0.9)',
  },
  errText: {
    fontFamily: fonts.body,
    fontSize:   12,
    color:      'rgba(252,165,165,0.9)',
    textAlign:  'center',
  },

  // ── Step 3: preferences ───────────────────────────────────────────────────
  prefSection: {
    width: '100%',
    gap:   spacing.sm,
  },
  prefLabel: {
    fontFamily:      fonts.body,
    fontSize:        fontSizes.xs,
    fontWeight:      fontWeights.semibold,
    letterSpacing:   0.1 * fontSizes.xs,
    textTransform:   'uppercase',
    color:           colors.textMuted,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  chip: {
    paddingVertical:   7,
    paddingHorizontal: 16,
    backgroundColor:   colors.glassBg,
    borderWidth:       1,
    borderColor:       colors.glassBorder,
    borderRadius:      radius.pill,
  },
  chipActive: {
    backgroundColor: colors.saveBtnBg,
    borderWidth:     0,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
  },
  chipTextActive: {
    color:      colors.saveBtnText,
    fontWeight: fontWeights.semibold,
  },
  segmented: {
    flexDirection: 'row',
    borderWidth:   1,
    borderColor:   colors.glassBorder,
    borderRadius:  radius.sm,
    overflow:      'hidden',
  },
  seg: {
    flex:            1,
    paddingVertical: 10,
    alignItems:      'center',
    justifyContent:  'center',
  },
  segDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.glassBorder,
  },
  segActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  segText: {
    fontFamily: fonts.body,
    fontSize:   fontSizes.sm,
    color:      colors.textSecondary,
  },
  segTextActive: {
    color:      colors.saveBtnText,
    fontWeight: fontWeights.semibold,
  },

  // ── Step 4: done ──────────────────────────────────────────────────────────
  loadingDots: {
    flexDirection: 'row',
    gap:           6,
    marginTop:     spacing.sm,
  },
  loadingDot: {
    width:           7,
    height:          7,
    borderRadius:    3.5,
    backgroundColor: colors.glassBorder,
  },
});
