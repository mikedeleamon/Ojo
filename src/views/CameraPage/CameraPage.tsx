/**
 * CameraPage — fullScreen native camera with swipe-up / gallery-button access
 * to the photo roll, plus a crop step before the ArticleModal opens.
 *
 * Lifecycle:
 *   - CameraView is mounted ONLY when the screen is focused, so the camera
 *     hardware is released the moment the user dismisses or background.
 *   - Close (X) → dismisses the fullScreenModal back to /(tabs).
 *
 * Flow:
 *   shutter / swipe / gallery  →  raw image (state: 'captured')
 *   user pans crop frame       →  cropped image (state: 'cropped')
 *   confirm crop               →  ArticleModal opens with cropped image
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Pressable,
  Alert,
  View,
  Text,
  TextInput,
  Image,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { BlurView } from 'expo-blur';
import { GlassView, isGlassEffectAPIAvailable } from 'expo-glass-effect';
import {
  Gesture,
  GestureDetector,
} from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Svg, Path, Circle } from 'react-native-svg';
import * as ImageManipulator from 'expo-image-manipulator';
import ArticleModal from '../../components/ArticleModal/ArticleModal';
import { useClosets } from '../../hooks/useClosets';
import { hapticImpact } from '../../lib/haptics';
import axios from '../../api/client';
import { auth } from '../../lib/auth';
import { useTheme } from '../../theme/ThemeContext';
import { pickImage, MAX_FILE_BYTES } from '../../lib/imageService';
import { ArticleFormData } from '../../types';
import { fonts, fontSizes, fontWeights, radius, spacing } from '../../theme/tokens';

// ─── Constants ────────────────────────────────────────────────────────────────

const LIQUID_GLASS = isGlassEffectAPIAvailable();

// Swipe-up threshold: translationY more negative than this triggers gallery
const SWIPE_Y_THRESHOLD  = -60;
const SWIPE_VY_THRESHOLD = -200;

// ─── Icons ────────────────────────────────────────────────────────────────────

const FlipIcon = ({ color }: { color: string }) => (
  <Svg
    width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
  >
    <Path d="M1 4v6h6" />
    <Path d="M23 20v-6h-6" />
    <Path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" />
  </Svg>
);

const GalleryIcon = ({ color }: { color: string }) => (
  <Svg
    width={24} height={24} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
  >
    <Path d="M21 9V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h4" />
    <Path d="m21 15-3.1-3.1a2 2 0 0 0-2.814.014L9 18" />
    <Path d="m14 19.5 3 3 3-3" />
    <Path d="M17 22v-9" />
    <Circle cx={9} cy={10} r={2} fill={color} stroke="none" />
  </Svg>
);

const CloseIcon = ({ color }: { color: string }) => (
  <Svg
    width={22} height={22} viewBox="0 0 24 24" fill="none"
    stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
  >
    <Path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

// ─── Permission / no-closet screens ──────────────────────────────────────────

function PermissionScreen({
  onRequest,
  onCancel,
}: {
  onRequest: () => void;
  onCancel: () => void;
}) {
  const { colors } = useTheme();
  const st = useMemo(() => makePStyles(colors), [colors]);
  return (
    <View style={st.root}>
      <Text style={st.title}>Camera Access</Text>
      <Text style={st.body}>
        Ojo needs camera permission to capture garments for your closet.
      </Text>
      <Pressable style={st.btn} onPress={onRequest} accessibilityRole="button">
        <Text style={st.btnText}>Allow Camera</Text>
      </Pressable>
      <Pressable
        style={st.linkBtn}
        onPress={onCancel}
        accessibilityRole="button"
      >
        <Text style={st.linkText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function NoClosetScreen({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const st = useMemo(() => makePStyles(colors), [colors]);
  const inputStyle = useMemo(() => StyleSheet.create({
    input: {
      width: '100%',
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
      backgroundColor: colors.glassBg,
      borderWidth: 1,
      borderColor: colors.glassBorder,
      borderRadius: radius.sm,
      color: colors.textPrimary,
      fontFamily: fonts.body,
      fontSize: fontSizes.base,
      textAlign: 'center',
    },
    errorText: {
      fontFamily: fonts.body,
      fontSize: fontSizes.xs,
      color: 'rgba(252,165,165,0.9)',
      textAlign: 'center',
    },
  }), [colors]);

  const [name, setName] = useState('My Wardrobe');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError(null);
    try {
      await axios.post('/api/closets', { name: trimmed }, auth());
      router.replace('/(tabs)/closet');
    } catch {
      setCreateError('Could not create closet. Try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={st.root}>
      <Text style={st.title}>No closet yet</Text>
      <Text style={st.body}>
        Name your first closet to start adding garments.
      </Text>
      <TextInput
        style={inputStyle.input}
        value={name}
        onChangeText={setName}
        placeholder="My Wardrobe"
        placeholderTextColor={colors.textMuted}
        returnKeyType="done"
        onSubmitEditing={create}
        accessibilityLabel="Closet name"
      />
      {createError ? <Text style={inputStyle.errorText}>{createError}</Text> : null}
      <Pressable
        style={[st.btn, (creating || !name.trim()) && { opacity: 0.5 }]}
        onPress={create}
        disabled={creating || !name.trim()}
        accessibilityRole="button"
        accessibilityLabel={creating ? 'Creating closet' : 'Create closet'}
      >
        <Text style={st.btnText}>{creating ? 'Creating…' : 'Create & open closet'}</Text>
      </Pressable>
      <Pressable
        style={st.linkBtn}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={st.linkText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

// Theme-driven version of the permission / empty-state styles. Previously
// hardcoded to dark, so the screen stayed dark when the user switched to light.
const makePStyles = (colors: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    root: {
      flex: 1, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.bgDefault, padding: spacing.lg, gap: spacing.md,
    },
    title: { fontFamily: fonts.display, fontSize: fontSizes.xl, color: colors.textPrimary },
    body: {
      fontFamily: fonts.body, fontSize: fontSizes.base,
      color: colors.textSecondary, textAlign: 'center',
    },
    btn: {
      paddingVertical: 14, paddingHorizontal: spacing.lg,
      borderRadius: radius.pill, backgroundColor: colors.saveBtnBg,
    },
    btnText: {
      fontFamily: fonts.body, fontSize: fontSizes.base,
      fontWeight: fontWeights.semibold, color: colors.saveBtnText,
    },
    linkBtn: { paddingVertical: 8 },
    linkText: {
      fontFamily: fonts.body, fontSize: fontSizes.sm,
      color: colors.textSecondary,
    },
  });

// ─── Captured / cropped image shapes ──────────────────────────────────────────

interface ImageData {
  uri:      string;   // base64 data URI  ("data:image/jpeg;base64,…")
  localUri: string;   // local file path
  width:    number;
  height:   number;
}

// ─── Crop preview ─────────────────────────────────────────────────────────────
// 1:1 crop with pan-to-position. Image is rendered at a scale that just covers
// the crop frame, so panning can position any portion of the image inside it.

interface CropPreviewProps {
  image:    ImageData;
  onCancel: () => void;
  onConfirm: (cropped: ImageData) => void;
}

function CropPreview({ image, onCancel, onConfirm }: CropPreviewProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // Crop frame sized to fit screen width minus padding, capped to height region
  const FRAME_PAD = spacing.lg;
  const CONTROLS_H = 120 + (insets.bottom || 0);
  const TOP_BAR_H  = 60 + (insets.top || 0);
  const verticalRoom = screenH - CONTROLS_H - TOP_BAR_H;
  const cropSize = Math.min(screenW - FRAME_PAD * 2, verticalRoom - FRAME_PAD * 2);

  // Image area = full content area between top bar and bottom controls
  const contentTop    = TOP_BAR_H;
  const contentHeight = screenH - CONTROLS_H - TOP_BAR_H;

  // Frame coords (in screen space, relative to content area top)
  const frameX = (screenW - cropSize) / 2;
  const frameY = contentTop + (contentHeight - cropSize) / 2;

  // Image is rendered at a scale that *covers* the crop frame
  const baseScale = Math.max(cropSize / image.width, cropSize / image.height);
  const dispW = image.width  * baseScale;
  const dispH = image.height * baseScale;

  // Initial position centers image in the crop frame
  const initTX = frameX + cropSize / 2 - dispW / 2;
  const initTY = frameY + cropSize / 2 - dispH / 2;

  // Allowed pan bounds — image must always cover the frame
  const minTX = frameX + cropSize - dispW;
  const maxTX = frameX;
  const minTY = frameY + cropSize - dispH;
  const maxTY = frameY;

  const translateX = useSharedValue(initTX);
  const translateY = useSharedValue(initTY);
  const ctxX = useSharedValue(0);
  const ctxY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      'worklet';
      ctxX.value = translateX.value;
      ctxY.value = translateY.value;
    })
    .onUpdate(e => {
      'worklet';
      const nx = ctxX.value + e.translationX;
      const ny = ctxY.value + e.translationY;
      translateX.value = Math.max(minTX, Math.min(maxTX, nx));
      translateY.value = Math.max(minTY, Math.min(maxTY, ny));
    });

  const animStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: dispW,
    height: dispH,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const [processing, setProcessing] = useState(false);

  const applyCrop = useCallback(async () => {
    if (processing) return;
    setProcessing(true);
    try {
      // Compute the crop region in original image natural-pixel coordinates
      const tx = translateX.value;
      const ty = translateY.value;
      const originX = Math.max(0, Math.round((frameX - tx) / baseScale));
      const originY = Math.max(0, Math.round((frameY - ty) / baseScale));
      const cropW = Math.min(
        image.width - originX,
        Math.round(cropSize / baseScale),
      );
      const cropH = Math.min(
        image.height - originY,
        Math.round(cropSize / baseScale),
      );

      const result = await ImageManipulator.manipulateAsync(
        image.localUri,
        [{ crop: { originX, originY, width: cropW, height: cropH } }],
        {
          format: ImageManipulator.SaveFormat.JPEG,
          compress: 0.85,
          base64: true,
        },
      );

      if (!result.base64) {
        throw new Error('Crop produced no image data.');
      }

      const approxBytes = result.base64.length * 0.75;
      if (approxBytes > MAX_FILE_BYTES) {
        Alert.alert('Image too large', 'Try a smaller crop region.');
        return;
      }

      onConfirm({
        uri:      `data:image/jpeg;base64,${result.base64}`,
        localUri: result.uri,
        width:    result.width,
        height:   result.height,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not crop image.';
      Alert.alert('Crop failed', msg);
    } finally {
      setProcessing(false);
    }
  }, [
    processing, translateX, translateY, frameX, frameY, baseScale,
    cropSize, image.localUri, image.width, image.height, onConfirm,
  ]);

  return (
    <View style={cropStyles.root}>
      {/* Image with pan transform */}
      <GestureDetector gesture={pan}>
        <View style={StyleSheet.absoluteFill}>
          <Animated.View style={animStyle}>
            <Image
              source={{ uri: image.uri }}
              style={{ width: dispW, height: dispH }}
              resizeMode="cover"
            />
          </Animated.View>

          {/* Frame overlay — dims everything outside the 1:1 crop region */}
          {/* Top dim */}
          <View
            style={[
              cropStyles.dim,
              { top: 0, left: 0, right: 0, height: frameY },
            ]}
          />
          {/* Bottom dim */}
          <View
            style={[
              cropStyles.dim,
              { top: frameY + cropSize, left: 0, right: 0, bottom: 0 },
            ]}
          />
          {/* Left dim */}
          <View
            style={[
              cropStyles.dim,
              { top: frameY, left: 0, width: frameX, height: cropSize },
            ]}
          />
          {/* Right dim */}
          <View
            style={[
              cropStyles.dim,
              {
                top: frameY,
                left: frameX + cropSize,
                right: 0,
                height: cropSize,
              },
            ]}
          />
          {/* Frame border */}
          <View
            style={[
              cropStyles.frame,
              { top: frameY, left: frameX, width: cropSize, height: cropSize },
            ]}
            pointerEvents="none"
          />
        </View>
      </GestureDetector>

      {/* Top bar — title only */}
      <View
        style={[cropStyles.topBar, { paddingTop: (insets.top || 0) + 12 }]}
        pointerEvents="box-none"
      >
        <Text style={cropStyles.topTitle}>Crop</Text>
        <Text style={cropStyles.topHint}>Drag to position</Text>
      </View>

      {/* Bottom controls */}
      <View
        style={[
          cropStyles.bottomBar,
          { paddingBottom: (insets.bottom || 0) + 16 },
        ]}
      >
        <Pressable
          style={cropStyles.secondaryBtn}
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Retake photo"
        >
          <Text style={cropStyles.secondaryBtnText}>Retake</Text>
        </Pressable>
        <Pressable
          style={[cropStyles.primaryBtn, processing && { opacity: 0.5 }]}
          onPress={applyCrop}
          disabled={processing}
          accessibilityRole="button"
          accessibilityLabel="Use this crop"
        >
          {processing ? (
            <ActivityIndicator color="#0D1B2A" />
          ) : (
            <Text style={cropStyles.primaryBtnText}>Use Photo</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const cropStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  dim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  frame: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.95)',
    borderRadius: 2,
  },
  topBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 8,
    gap: 2,
  },
  topTitle: {
    fontFamily: fonts.display,
    fontSize: fontSizes.lg,
    color: '#fff',
  },
  topHint: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.55)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    color: 'rgba(255,255,255,0.92)',
  },
  primaryBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
  },
  primaryBtnText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    color: '#0D1B2A',
  },
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function CameraPage() {
  const insets    = useSafeAreaInsets();
  const router    = useRouter();
  const isFocused = useIsFocused();
  const cameraRef = useRef<CameraView>(null);

  // Optional ?return=/(tabs)/<path> — set by the camera-tab redirect at
  // app/(tabs)/camera.tsx. When present, dismissing the modal navigates to
  // that path so the user doesn't land back on the redirect placeholder.
  // When absent (e.g. opened from the Closet add button), dismiss simply
  // pops the modal so the caller's tab stays selected.
  const { return: returnParam, closetId: closetIdParam } =
    useLocalSearchParams<{ return?: string; closetId?: string }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [facing,    setFacing]    = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);
  const [raw,       setRaw]       = useState<ImageData | null>(null);
  const [cropped,   setCropped]   = useState<ImageData | null>(null);

  const { closets, loading: closetsLoading, addArticle, createCloset } = useClosets();
  // Prefer the closet the user launched from (passed by the Closet tab's add
  // chooser); fall back to the preferred/first closet for the global Add tab.
  const targetCloset = useMemo(
    () =>
      (closetIdParam ? closets.find(c => c._id === closetIdParam) : null) ??
      closets.find(c => c.isPreferred) ??
      closets[0] ??
      null,
    [closets, closetIdParam],
  );

  const dismiss = useCallback(() => {
    if (returnParam) {
      // Came from the camera-tab redirect. dismissTo atomically pops the
      // modal AND switches the active (tabs) child to the return path, so
      // the camera-tab placeholder is never re-focused (no push-loop).
      router.dismissTo(returnParam as any);
    } else if (router.canDismiss()) {
      // Came from a non-tab entry (e.g. Closet add button) — just pop;
      // the caller's tab stays selected underneath.
      router.dismiss();
    } else {
      router.back();
    }
  }, [router, returnParam]);

  // ── Capture from camera ────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || capturing) return;
    setCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: false,    // base64 added after crop — keep capture light
        exif: false,
      });
      if (!photo?.uri) return;
      hapticImpact();   // tactile "thunk" confirming the shutter fired
      setRaw({
        uri:      photo.uri,          // local URI is enough for the crop step
        localUri: photo.uri,
        width:    photo.width,
        height:   photo.height,
      });
    } catch (err) {
      Alert.alert('Capture failed', 'Could not take a photo. Please try again.');
    } finally {
      setCapturing(false);
    }
  }, [capturing]);

  // ── Pick from gallery ──────────────────────────────────────────────────────
  const handleGallery = useCallback(async () => {
    const result = await pickImage();
    if (result.error) {
      Alert.alert('Error', result.error);
      return;
    }
    if (result.uri && result.localUri && result.width && result.height) {
      setRaw({
        uri:      result.uri,
        localUri: result.localUri,
        width:    result.width,
        height:   result.height,
      });
    }
  }, []);

  // ── Swipe-up gesture → gallery ────────────────────────────────────────────
  const swipeUp = Gesture.Pan().onEnd(e => {
    'worklet';
    if (
      e.translationY < SWIPE_Y_THRESHOLD &&
      e.velocityY < SWIPE_VY_THRESHOLD
    ) {
      runOnJS(handleGallery)();
    }
  });

  // ── ArticleModal handlers ──────────────────────────────────────────────────
  const handleModalClose = useCallback(() => {
    // Closing the modal returns to the crop preview (or camera if no crop yet)
    setCropped(null);
  }, []);

  const handleModalSubmit = useCallback(
    async (data: ArticleFormData) => {
      // First-ever item with no closet yet: create a default closet on the fly
      // instead of silently dropping the save (the old dead end — the form
      // just did nothing). Errors propagate to ArticleModal's inline error.
      const closetId =
        targetCloset?._id ?? (await createCloset('My Closet'))._id;
      await addArticle(closetId, data);
      setCropped(null);
      setRaw(null);
      // Atomically dismiss the modal AND land on Closet so the user sees
      // their new item. dismissTo is essential here when returnParam is set
      // (came from camera tab) — otherwise the camera-tab placeholder would
      // re-focus and re-push the modal.
      router.dismissTo('/(tabs)/closet');
    },
    [targetCloset, addArticle, createCloset, router],
  );

  // ─── Guards ─────────────────────────────────────────────────────────────────
  if (!permission) return null;
  if (!permission.granted) {
    return (
      <PermissionScreen onRequest={requestPermission} onCancel={dismiss} />
    );
  }
  if (closetsLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center',
                     backgroundColor: '#0F172A' }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  if (!targetCloset) return <NoClosetScreen onClose={dismiss} />;

  // ── Stage 2: Crop ─────────────────────────────────────────────────────────
  if (raw && !cropped) {
    return (
      <CropPreview
        image={raw}
        onCancel={() => setRaw(null)}
        onConfirm={(croppedImg) => setCropped(croppedImg)}
      />
    );
  }

  // ── Control bar (bottom) ───────────────────────────────────────────────────
  const iconColor = 'rgba(255,255,255,0.92)';
  const barBottom = insets.bottom + spacing.md;

  const ControlBar = () => {
    const inner = (
      <View style={st.barInner}>
        <Pressable
          style={st.sideBtn}
          onPress={handleGallery}
          accessibilityRole="button"
          accessibilityLabel="Open photo library"
        >
          <GalleryIcon color={iconColor} />
        </Pressable>

        <Pressable
          style={[st.shutter, capturing && { opacity: 0.6 }]}
          onPress={handleCapture}
          disabled={capturing}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
        >
          <View style={st.shutterInner} />
        </Pressable>

        <Pressable
          style={st.sideBtn}
          onPress={() => setFacing(f => (f === 'back' ? 'front' : 'back'))}
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
        >
          <FlipIcon color={iconColor} />
        </Pressable>
      </View>
    );

    return (
      <View style={[st.barWrap, { bottom: barBottom }]}>
        {LIQUID_GLASS ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme="dark"
            style={st.barGlass}
          >
            {inner}
          </GlassView>
        ) : (
          <BlurView tint="dark" intensity={70} style={st.barBlur}>
            <View style={[StyleSheet.absoluteFill, st.barOverlay]} />
            {inner}
          </BlurView>
        )}
      </View>
    );
  };

  // ── Close button (top-left) — dismisses the camera modal back to (tabs) ──
  const closeTop = (insets.top || 0) + 8;

  const CloseButton = () => {
    const inner = (
      <View style={st.closeInner}>
        <CloseIcon color={'rgba(255,255,255,0.95)'} />
      </View>
    );
    return (
      <Pressable
        style={[st.closeWrap, { top: closeTop }]}
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Close camera and return"
        hitSlop={8}
      >
        {LIQUID_GLASS ? (
          <GlassView
            glassEffectStyle="regular"
            colorScheme="dark"
            style={st.closeGlass}
          >
            {inner}
          </GlassView>
        ) : (
          <BlurView tint="dark" intensity={60} style={st.closeBlur}>
            <View style={[StyleSheet.absoluteFill, st.closeOverlay]} />
            {inner}
          </BlurView>
        )}
      </Pressable>
    );
  };

  return (
    <View style={st.root}>
      <GestureDetector gesture={swipeUp}>
        <View style={StyleSheet.absoluteFill}>
          {/* Mount the live camera ONLY when this screen is focused.
              When unfocused (modal dismissed or backgrounded), the hardware
              is released. */}
          {isFocused ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />
          )}

          {/* Swipe hint above the control bar */}
          <View style={[st.swipeHint, { bottom: barBottom + 80 }]}>
            <Text style={st.swipeHintText}>↑  swipe for library</Text>
          </View>
        </View>
      </GestureDetector>

      <CloseButton />
      <ControlBar />

      {/* ArticleModal — shown after crop confirm */}
      {cropped && (
        <ArticleModal
          closetId={targetCloset._id}
          onClose={handleModalClose}
          onSubmit={handleModalSubmit}
          initialImageData={cropped}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Close (X) — top-left
  closeWrap: {
    position: 'absolute',
    left: spacing.md,
    width: 42, height: 42,
    borderRadius: 21,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  closeGlass: {
    width: '100%', height: '100%',
    borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  closeBlur: {
    width: '100%', height: '100%',
    borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  closeOverlay: {
    borderRadius: 21,
    backgroundColor: 'rgba(10,10,20,0.55)',
  },
  closeInner: {
    width: '100%', height: '100%',
    alignItems: 'center', justifyContent: 'center',
  },

  // Control bar
  barWrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    borderRadius: radius.pill,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  barGlass: {
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  barBlur: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  barOverlay: {
    borderRadius: radius.pill,
    backgroundColor: 'rgba(10,10,20,0.55)',
  },
  barInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },

  sideBtn: {
    width: 48, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },

  // Shutter — white ring with white fill
  shutter: {
    width: 72, height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.90)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: {
    width: 58, height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },

  swipeHint: {
    position: 'absolute',
    alignSelf: 'center',
  },
  swipeHintText: {
    fontFamily: fonts.body,
    fontSize: fontSizes.xs,
    color: 'rgba(255,255,255,0.40)',
    letterSpacing: 0.3,
  },
});
