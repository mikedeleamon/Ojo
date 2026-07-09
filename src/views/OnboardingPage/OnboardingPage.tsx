import { useState, useEffect, useRef, useMemo } from 'react';
import {
  Animated, TextInput as RNTextInput,
  ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Svg, Path, Circle } from 'react-native-svg';
import { View, Text, Pressable, GlassCard, GlassGroup, AppSlider } from '../../components/primitives';
import OjoLogoIcon from '../../components/icons/OjoLogoIcon';
import { useSettings } from '../../hooks/useSettings';
import { useReduceMotion } from '../../hooks/useReduceMotion';
import { markOnboardingComplete } from '../../lib/onboarding';
import { requestPermission, registerPushToken, NOTIF_DEFAULTS } from '../../lib/notifications';
import { hapticSuccess } from '../../lib/haptics';
import { auth } from '../../lib/auth';
import axios from '../../api/client';
import { spacing, radius } from '../../theme/tokens';
import { fToC, cToF } from '../../lib/units';
import { useTheme } from '../../theme/ThemeContext';
import { ColorTokens } from '../../theme/tokens';
import { makeStyles } from './OnboardingPage.styles';
import { GENDERS } from '../../lib/colors/palettes';

const STYLES_LIST = ['Casual', 'Business Casual', 'Formal', 'Athletic', 'Streetwear', 'Minimalist'];
const TEMP_UNITS  = ['Imperial', 'Metric'] as const;
const TOTAL_STEPS = 5;

// Notification types surfaced on the enable step, so users see the value
// before the OS permission prompt appears.
const NOTIF_HIGHLIGHTS: { emoji: string; title: string; desc: string }[] = [
  { emoji: '🌅', title: 'Morning Outfit Brief', desc: 'Your weather and outfit, ready when you wake up.' },
  { emoji: '🌧️', title: 'Weather Change Alert', desc: 'A heads-up when rain or a cold front moves in.' },
  { emoji: '🌡️', title: 'Temperature Swing Warning', desc: 'Know when to layer up before you head out.' },
];

interface Props { onComplete?: () => void; }

// ── Step progress dots ────────────────────────────────────────────────────────
const Dots = ({ step, colors }: { step: number; colors: ColorTokens }) => (
  <View style={{ flexDirection: 'row', gap: 6, marginBottom: spacing.xs }}>
    {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
      <View
        key={i}
        style={[
          { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.glassBorder },
          i === step - 1 && { width: 18, borderRadius: radius.pill, backgroundColor: colors.saveBtnBg },
          i < step - 1  && { backgroundColor: 'rgba(52,211,153,0.65)' },
        ]}
      />
    ))}
  </View>
);

// ── Circular icon container ───────────────────────────────────────────────────
const StepIcon = ({ children, colors }: { children: React.ReactNode; colors: ColorTokens }) => (
  <View style={{
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: colors.glassBg, borderWidth: 1, borderColor: colors.glassBorder,
    alignItems: 'center', justifyContent: 'center',
  }}>{children}</View>
);

// ── Arrow icon used inside primary buttons ────────────────────────────────────
const ArrowRight = ({ color }: { color: string }) => (
  <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
    <Path
      d="M3 8h10M9 4l4 4-4 4"
      stroke={color}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

// ── Animated loading dots (final step) ────────────────────────────────────────
const LoadingDots = ({ colors }: { colors: ColorTokens }) => {
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
    <View style={{ flexDirection: 'row', gap: 6, marginTop: spacing.sm }}>
      {anims.map((a, i) => (
        <Animated.View key={i} style={[{
          width: 7, height: 7, borderRadius: 3.5,
          backgroundColor: colors.glassBorder,
        }, { opacity: a }]} />
      ))}
    </View>
  );
};


// ─────────────────────────────────────────────────────────────────────────────

export default function OnboardingPage({ onComplete }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const { settings, saveSettings } = useSettings();
  const reduceMotion = useReduceMotion();

  const [step, setStep] = useState(1);

  const [closetName,    setClosetName]    = useState('My Wardrobe');
  const [closetDone,    setClosetDone]    = useState(false);
  const [closetErr,     setClosetErr]     = useState<string | null>(null);
  const [closetLoading, setClosetLoading] = useState(false);

  const [styleChoice,  setStyleChoice]  = useState<string[]>(settings.clothingStyles?.length ? settings.clothingStyles : ['Casual']);
  const [genderChoice, setGenderChoice] = useState<string>(settings.gender || 'All');
  const [tempUnit,     setTempUnit]     = useState<'Imperial' | 'Metric'>(
    (settings.temperatureScale as 'Imperial' | 'Metric') || 'Imperial',
  );
  const isMetric = tempUnit === 'Metric';
  const [hotTemp,  setHotTemp]  = useState(
    isMetric ? Math.round(fToC(settings.hiTempThreshold ?? 85)) : (settings.hiTempThreshold ?? 85),
  );
  const [coldTemp, setColdTemp] = useState(
    isMetric ? Math.round(fToC(settings.lowTempThreshold ?? 55)) : (settings.lowTempThreshold ?? 55),
  );
  const [humidity, setHumidity] = useState(settings.humidityPreference ?? 50);

  const [notifLoading, setNotifLoading] = useState(false);

  const slideAnim   = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const transition = (toStep: number, dir: 'forward' | 'back') => {
    // Reduce Motion: jump straight to the step with no slide/fade.
    if (reduceMotion) {
      setStep(toStep);
      slideAnim.setValue(0);
      opacityAnim.setValue(1);
      return;
    }
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
      hapticSuccess();
    } catch {
      setClosetErr('Could not create closet — you can create one later in My Closet.');
    } finally {
      setClosetLoading(false);
    }
  };

  // Step 3 → 4: persist preferences, then move on to the notifications step.
  // Completion is marked later (when leaving the notifications step) so a user
  // can still back out to tweak preferences.
  const handleFinish = async () => {
    const hiTempF  = isMetric ? cToF(hotTemp)  : hotTemp;
    const lowTempF = isMetric ? cToF(coldTemp) : coldTemp;
    try {
      await saveSettings({
        ...settings,
        clothingStyles:     styleChoice,
        temperatureScale:   tempUnit,
        gender:             genderChoice,
        hiTempThreshold:    hiTempF,
        lowTempThreshold:   lowTempF,
        humidityPreference: humidity,
      });
    } catch { /* non-fatal */ }
    advance(4);
  };

  // Step 4 → 5: mark onboarding done and slide to the "all set" screen.
  const finishOnboarding = async () => {
    await markOnboardingComplete();
    advance(5);
  };

  const handleEnableNotifications = async () => {
    setNotifLoading(true);
    try {
      const status = await requestPermission();
      if (status === 'granted') {
        await registerPushToken();
        // Turn on the three briefs we just showcased so granting permission
        // actually produces notifications. Without this the toggle is a no-op
        // and the user hears nothing until they dig into Settings. They can
        // still fine-tune or disable any of these there.
        await axios.put(
          '/api/notifications/settings',
          {
            ...NOTIF_DEFAULTS,
            morningBriefEnabled:  true,
            weatherChangeEnabled: true,
            tempSwingEnabled:     true,
          },
          auth(),
        );
      }
    } catch { /* non-fatal — proceed regardless of the permission outcome */ }
    finally {
      setNotifLoading(false);
      finishOnboarding();
    }
  };

  const handleSkip = async () => {
    await markOnboardingComplete();
    onComplete?.();
  };

  useEffect(() => {
    if (step === 5) {
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
          <GlassCard style={st.card}>
            <Animated.View
              style={{ opacity: opacityAnim, transform: [{ translateX: slideAnim }] }}
            >

              {/* ── Step 1: Welcome ─────────────────────────────────────────── */}
              {step === 1 && (
                <View style={st.stepShell}>
                  <Dots step={1} colors={colors} />
                  <OjoLogoIcon width={st.logo.width} height={st.logo.height} />
                  <Text style={st.heading}>Welcome to Ojo</Text>
                  <Text style={st.sub}>
                    Let's take 60 seconds to set up your wardrobe so Ojo can suggest
                    perfect outfits every day.
                  </Text>
                  <GlassGroup spacing={12} style={st.illustrationRow}>
                    <GlassCard style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M12 2a3 3 0 0 1 3 3v1l4 2v14H5V8l4-2V5a3 3 0 0 1 3-3z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </GlassCard>
                    <GlassCard style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 6l4-3h10l4 3-4 4v11H7V10L3 6z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </GlassCard>
                    <GlassCard style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M3 16l4-8h4l1 4h9v4H3z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </GlassCard>
                    <GlassCard style={st.iconPill}>
                      <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
                        <Path d="M4 6l3-3 5 3 5-3 3 3v14H4V6z"
                          stroke={colors.textSecondary} strokeWidth={1.4} strokeLinejoin="round" />
                      </Svg>
                    </GlassCard>
                  </GlassGroup>
                  <Pressable
                    style={st.primaryBtn}
                    onPress={() => advance(2)}
                    accessibilityRole="button"
                    accessibilityLabel="Let's go"
                  >
                    <Text style={st.primaryBtnText}>Let's go</Text>
                    <ArrowRight color={colors.saveBtnText} />
                  </Pressable>
                  <Pressable
                    onPress={handleSkip}
                    accessibilityRole="button"
                    accessibilityLabel="Skip setup"
                  >
                    <Text style={st.skipLink}>Skip setup</Text>
                  </Pressable>
                </View>
              )}

              {/* ── Step 2: Create Closet ────────────────────────────────────── */}
              {step === 2 && (
                <View style={st.stepShell}>
                  <Dots step={2} colors={colors} />
                  <StepIcon colors={colors}>
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
                        accessibilityRole="button"
                        accessibilityLabel={closetLoading ? 'Creating closet' : 'Create closet'}
                        accessibilityState={{ busy: closetLoading, disabled: closetLoading || !closetName.trim() }}
                      >
                        <Text style={st.primaryBtnText}>{closetLoading ? 'Creating…' : 'Create closet'}</Text>
                      </Pressable>
                    </>
                  )}

                  <View style={st.navRow}>
                    <Pressable
                      style={st.ghostBtn}
                      onPress={() => goBack(1)}
                      accessibilityRole="button"
                      accessibilityLabel="Back"
                    >
                      <Text style={st.ghostBtnText}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={[st.primaryBtn, (!closetDone && !closetErr) && st.primaryBtnDisabled]}
                      onPress={() => advance(3)}
                      disabled={!closetDone && !closetErr}
                      accessibilityRole="button"
                      accessibilityLabel={closetErr ? 'Skip this step' : 'Next'}
                      accessibilityState={{ disabled: !closetDone && !closetErr }}
                    >
                      <Text style={st.primaryBtnText}>{closetErr ? 'Skip this step' : 'Next'}</Text>
                      <ArrowRight color={colors.saveBtnText} />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ── Step 3: Preferences ──────────────────────────────────────── */}
              {step === 3 && (
                <View style={st.stepShell}>
                  <Dots step={3} colors={colors} />
                  <StepIcon colors={colors}>
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
                      {STYLES_LIST.map(s => {
                        const active = styleChoice.includes(s);
                        return (
                          <Pressable
                            key={s}
                            style={[st.chip, active && st.chipActive]}
                            onPress={() => {
                              setStyleChoice(prev =>
                                prev.includes(s)
                                  ? prev.length > 1 ? prev.filter(x => x !== s) : prev
                                  : [...prev, s]
                              );
                            }}
                            accessibilityRole="checkbox"
                            accessibilityLabel={s}
                            accessibilityState={{ checked: active }}
                          >
                            <Text style={[st.chipText, active && st.chipTextActive]}>{s}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>

                  <View style={st.prefSection}>
                    <Text style={st.prefLabel}>Wardrobe style</Text>
                    <View style={st.chipGrid}>
                      {GENDERS.map(g => (
                        <Pressable
                          key={g}
                          style={[st.chip, genderChoice === g && st.chipActive]}
                          onPress={() => setGenderChoice(g)}
                          accessibilityRole="radio"
                          accessibilityLabel={g}
                          accessibilityState={{ selected: genderChoice === g }}
                        >
                          <Text style={[st.chipText, genderChoice === g && st.chipTextActive]}>{g}</Text>
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
                          onPress={() => {
                            if (u === tempUnit) return;
                            if (u === 'Metric') {
                              setHotTemp(Math.round(fToC(hotTemp)));
                              setColdTemp(Math.round(fToC(coldTemp)));
                            } else {
                              setHotTemp(Math.round(cToF(hotTemp)));
                              setColdTemp(Math.round(cToF(coldTemp)));
                            }
                            setTempUnit(u);
                          }}
                          accessibilityRole="radio"
                          accessibilityLabel={u === 'Imperial' ? 'Fahrenheit, Imperial' : 'Celsius, Metric'}
                          accessibilityState={{ selected: tempUnit === u }}
                        >
                          <Text style={[st.segText, tempUnit === u && st.segTextActive]}>
                            {u === 'Imperial' ? '°F Imperial' : '°C Metric'}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={st.prefSection}>
                    <Text style={st.prefLabel}>Temperature feel</Text>
                    <View style={st.sliderRow}>
                      <View style={st.sliderMeta}>
                        <Text style={st.sliderLabel}>Hot above</Text>
                        <Text style={st.sliderValue}>{Math.round(hotTemp)}°{isMetric ? 'C' : 'F'}</Text>
                      </View>
                      <AppSlider
                        minimumValue={isMetric ? 10 : 50}
                        maximumValue={isMetric ? 49 : 120}
                        value={hotTemp}
                        step={1}
                        onValueChange={setHotTemp}
                        style={{ width: '100%' }}
                        accessibilityLabel="Hot above temperature"
                      />
                    </View>
                    <View style={st.sliderRow}>
                      <View style={st.sliderMeta}>
                        <Text style={st.sliderLabel}>Cold below</Text>
                        <Text style={st.sliderValue}>{Math.round(coldTemp)}°{isMetric ? 'C' : 'F'}</Text>
                      </View>
                      <AppSlider
                        minimumValue={isMetric ? -18 : 0}
                        maximumValue={isMetric ? 21 : 70}
                        value={coldTemp}
                        step={1}
                        onValueChange={setColdTemp}
                        style={{ width: '100%' }}
                        accessibilityLabel="Cold below temperature"
                      />
                    </View>
                  </View>

                  <View style={st.prefSection}>
                    <Text style={st.prefLabel}>Humidity sensitivity</Text>
                    <View style={st.sliderRow}>
                      <View style={st.sliderMeta}>
                        <Text style={st.sliderLabel}>Threshold</Text>
                        <Text style={st.sliderValue}>{Math.round(humidity)}%</Text>
                      </View>
                      <AppSlider
                        minimumValue={0}
                        maximumValue={100}
                        value={humidity}
                        step={1}
                        onValueChange={setHumidity}
                        style={{ width: '100%' }}
                        accessibilityLabel="Humidity sensitivity threshold"
                      />
                    </View>
                  </View>

                  <View style={st.navRow}>
                    <Pressable
                      style={st.ghostBtn}
                      onPress={() => goBack(2)}
                      accessibilityRole="button"
                      accessibilityLabel="Back"
                    >
                      <Text style={st.ghostBtnText}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={st.primaryBtn}
                      onPress={handleFinish}
                      accessibilityRole="button"
                      accessibilityLabel="Finish setup"
                    >
                      <Text style={st.primaryBtnText}>Finish setup</Text>
                      <ArrowRight color={colors.saveBtnText} />
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ── Step 4: Notifications ────────────────────────────────────── */}
              {step === 4 && (
                <View style={st.stepShell}>
                  <Dots step={4} colors={colors} />
                  <StepIcon colors={colors}>
                    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
                        stroke={colors.textSecondary} strokeWidth={1.5}
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                      <Path
                        d="M13.73 21a2 2 0 0 1-3.46 0"
                        stroke={colors.textSecondary} strokeWidth={1.5}
                        strokeLinecap="round" strokeLinejoin="round"
                      />
                    </Svg>
                  </StepIcon>
                  <Text style={st.stepHeading}>Stay one step ahead</Text>
                  <Text style={st.stepDesc}>
                    Let Ojo send timely nudges so you're always dressed for what's
                    outside. You're in control — fine-tune everything in Settings.
                  </Text>

                  <View style={st.notifList}>
                    {NOTIF_HIGHLIGHTS.map(n => (
                      <View key={n.title} style={st.notifRow}>
                        <Text style={st.notifEmoji}>{n.emoji}</Text>
                        <View style={st.notifTextWrap}>
                          <Text style={st.notifRowTitle}>{n.title}</Text>
                          <Text style={st.notifRowDesc}>{n.desc}</Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  <View style={st.navRow}>
                    <Pressable
                      style={st.ghostBtn}
                      onPress={() => goBack(3)}
                      disabled={notifLoading}
                      accessibilityRole="button"
                      accessibilityLabel="Back"
                    >
                      <Text style={st.ghostBtnText}>Back</Text>
                    </Pressable>
                    <Pressable
                      style={[st.primaryBtn, notifLoading && st.primaryBtnDisabled]}
                      onPress={handleEnableNotifications}
                      disabled={notifLoading}
                      accessibilityRole="button"
                      accessibilityLabel={notifLoading ? 'Enabling notifications' : 'Enable notifications'}
                      accessibilityState={{ busy: notifLoading, disabled: notifLoading }}
                    >
                      <Text style={st.primaryBtnText}>
                        {notifLoading ? 'Enabling…' : 'Enable notifications'}
                      </Text>
                      <ArrowRight color={colors.saveBtnText} />
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={finishOnboarding}
                    disabled={notifLoading}
                    accessibilityRole="button"
                    accessibilityLabel="Maybe later"
                  >
                    <Text style={st.skipLink}>Maybe later</Text>
                  </Pressable>
                </View>
              )}

              {/* ── Step 5: Done ─────────────────────────────────────────────── */}
              {step === 5 && (
                <View style={st.stepShell}>
                  <Dots step={5} colors={colors} />
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
                  <LoadingDots colors={colors} />
                </View>
              )}

            </Animated.View>
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
