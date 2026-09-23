/**
 * ShareToInstagramSheet — the one bottom sheet every "Share to Instagram" entry
 * point (OutfitSuggestion, TripPlanner, WeatherHUD, Recap) opens. Renders the
 * passed card template at full 9:16 size (so glass/blur/fonts capture correctly
 * — off-screen capture is unreliable for native blur views) but scales it down
 * visually for the preview; captureRef still snapshots the card's own layer at
 * 1080×1920, so the export matches the preview 1:1.
 *
 * Primary action shares to Instagram Stories; the secondary action opens the OS
 * sheet (Save Image / Messages / …), which is also the automatic fallback when
 * Instagram or the Facebook App ID isn't configured.
 *
 * Video mode (docs/prerendered-visuals-plan.md, Phase 1): when the caller
 * passes a `look` and a `renderSticker`, and that look's loop is cached or
 * downloads within VIDEO_WAIT_MS, the Story becomes the loop with the card as a
 * sticker on top. The preview is the loop's poster frame with the sticker over
 * it — a still, so the sheet needs no video player — and "Save or share
 * elsewhere" exports exactly that preview as a PNG. Anything short of that is
 * today's poster flow, unchanged.
 */

import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Platform, StyleSheet, View as RNView, type LayoutChangeEvent } from 'react-native';
import { View, Text, Pressable } from '../primitives';
import { EXPORT_SCALE, useShareCapture } from '../../hooks/useShareCapture';
import {
  shareToInstagramStory,
  shareImageElsewhere,
  isInstagramShareAvailable,
  type ShareStoryOutcome,
} from '../../lib/share/instagramShare';
import { hapticSuccess } from '../../lib/haptics';
import { ensureLocal } from '../../lib/visualLibrary/cache';
import { loopFor } from '../../lib/visualLibrary/manifest';
import type { LoopKey } from '../../lib/visualLibrary/looks';
import styles from './ShareToInstagramSheet.styles';

interface ShareToInstagramSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The card template to render + capture, given the ref it must forward. */
  renderCard: (ref: React.RefObject<RNView | null>) => React.ReactNode;
  attributionURL?: string | null;
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
  /** The weather look (or 'recap') behind this card. With renderSticker, enables video mode. */
  look?: LoopKey;
  /** The same card as a sticker (variant='sticker'), given the ref it must forward. */
  renderSticker?: (ref: React.RefObject<RNView | null>) => React.ReactNode;
}

/**
 * How long the sheet waits for a loop before settling on the poster. A cached
 * loop resolves at once; an uncached one keeps downloading after this and is
 * ready for the next share.
 */
const VIDEO_WAIT_MS = 2000;

/** iOS 17+ only (plan rule 3); older iOS and Android keep the poster. */
const VIDEO_PLATFORM_OK =
  Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 17;

interface VideoStory {
  video: string;
  poster: string;
}

const ShareToInstagramSheet = ({
  visible,
  onClose,
  renderCard,
  attributionURL,
  backgroundTopColor,
  backgroundBottomColor,
  look,
  renderSticker,
}: ShareToInstagramSheetProps) => {
  const { ref, capture, capturing } = useShareCapture();
  const sticker = useShareCapture();
  const [error, setError] = useState<string | null>(null);
  const igAvailable = isInstagramShareAvailable();

  const videoEligible = VIDEO_PLATFORM_OK && igAvailable && !!look && !!renderSticker;
  const [videoStory, setVideoStory] = useState<VideoStory | null>(null);
  const [resolving, setResolving] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const stickerSize = useRef<{ width: number; height: number } | null>(null);

  // Decide the mode each time the sheet opens. The loop and its poster are
  // fetched together; both must land for video mode.
  useEffect(() => {
    if (!visible || !videoEligible || !look) {
      setVideoStory(null);
      setPosterLoaded(false);
      setResolving(false);
      return;
    }
    let cancelled = false;
    const loop = loopFor(look);
    setResolving(true);
    Promise.all([ensureLocal(loop, VIDEO_WAIT_MS), ensureLocal(loop?.poster, VIDEO_WAIT_MS)])
      .then(([video, poster]) => {
        if (!cancelled) setVideoStory(video && poster ? { video, poster } : null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, videoEligible, look]);

  const busy = capturing || sticker.capturing || resolving || (!!videoStory && !posterLoaded);

  const onStickerLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    stickerSize.current = { width: Math.round(width * EXPORT_SCALE), height: Math.round(height * EXPORT_SCALE) };
  };

  /** Haptic + close on success, an error line on failure, nothing on cancel. */
  const settle = (result: ShareStoryOutcome) => {
    if (result.ok) {
      hapticSuccess();
      onClose();
    } else if (result.reason !== 'cancelled') {
      setError("Couldn't share — try again.");
    }
  };

  const handleShare = async () => {
    setError(null);
    try {
      if (videoStory && stickerSize.current) {
        const stickerImage = await sticker.capture(stickerSize.current);
        const result = await shareToInstagramStory({
          kind: 'video',
          backgroundVideo: videoStory.video,
          stickerImage,
          attributionURL,
          backgroundTopColor,
          backgroundBottomColor,
        });
        // Instagram gone since the sheet opened: share the preview as an image instead.
        if (!result.ok && (result.reason === 'not-installed' || result.reason === 'unavailable')) {
          settle(await shareImageElsewhere(await capture()));
        } else {
          settle(result);
        }
        return;
      }
      const image = await capture();
      settle(await shareToInstagramStory({
        kind: 'image',
        backgroundImage: image,
        attributionURL,
        backgroundTopColor,
        backgroundBottomColor,
      }));
    } catch {
      setError("Couldn't capture the card — try again.");
    }
  };

  const handleShareElsewhere = async () => {
    setError(null);
    try {
      // In video mode `ref` is on the preview (poster + sticker), so the PNG matches it.
      settle(await shareImageElsewhere(await capture()));
    } catch {
      setError("Couldn't capture the card — try again.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType='slide' onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole='button'
        accessibilityLabel='Dismiss'
      />
      <View style={styles.sheet}>
        {/* Grabber + scaled preview of the story card */}
        <View style={styles.grabber} />
        <View style={styles.previewWrap} pointerEvents='none'>
          <View style={styles.previewInner}>
            {videoStory && renderSticker ? (
              <RNView ref={ref} style={styles.videoPreview} collapsable={false}>
                <Image
                  source={{ uri: videoStory.poster }}
                  style={StyleSheet.absoluteFill}
                  onLoad={() => setPosterLoaded(true)}
                />
                <RNView onLayout={onStickerLayout}>{renderSticker(sticker.ref)}</RNView>
              </RNView>
            ) : (
              renderCard(ref)
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={handleShare}
            disabled={busy}
            accessibilityRole='button'
            accessibilityLabel={busy ? 'Preparing' : (igAvailable ? 'Share to Instagram Stories' : 'Share')}
            accessibilityState={{ busy, disabled: busy }}
          >
            <Text style={styles.primaryBtnText}>
              {busy
                ? 'Preparing…'
                : igAvailable
                  ? 'Share to Instagram Stories'
                  : 'Share'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={handleShareElsewhere}
            disabled={busy}
            accessibilityRole='button'
            accessibilityLabel='Save or share elsewhere'
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.secondaryBtnText}>Save or share elsewhere…</Text>
          </Pressable>

          <Pressable
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityRole='button'
            accessibilityLabel='Close'
          >
            <Text style={styles.closeBtnText}>Not now</Text>
          </Pressable>

          {error && <Text style={styles.hint}>{error}</Text>}
        </View>
      </View>
    </Modal>
  );
};

export default ShareToInstagramSheet;
