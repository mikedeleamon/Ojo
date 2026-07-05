/**
 * ShareToInstagramSheet — the one modal every "Share to Instagram" entry
 * point (OutfitSuggestion, TripPlanner, WeatherHUD) opens. Renders the
 * passed card template visibly (so glass/blur/fonts capture correctly —
 * off-screen capture is unreliable for native blur views), then captures it
 * on tap via useShareCapture and hands the PNG to instagramShare.ts.
 */

import { useState } from 'react';
import { Modal, View as RNView } from 'react-native';
import { View, Text, Pressable } from '../primitives';
import { useShareCapture } from '../../hooks/useShareCapture';
import {
  shareToInstagramStory,
  isInstagramShareAvailable,
} from '../../lib/share/instagramShare';
import { hapticSuccess } from '../../lib/haptics';
import styles from './ShareToInstagramSheet.styles';

interface ShareToInstagramSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The card template to render + capture, given the ref it must forward. */
  renderCard: (ref: React.RefObject<RNView | null>) => React.ReactNode;
  attributionURL?: string | null;
  backgroundTopColor?: string;
  backgroundBottomColor?: string;
}

const ShareToInstagramSheet = ({
  visible,
  onClose,
  renderCard,
  attributionURL,
  backgroundTopColor,
  backgroundBottomColor,
}: ShareToInstagramSheetProps) => {
  const { ref, capture, capturing } = useShareCapture();
  const [error, setError] = useState<string | null>(null);
  const igAvailable = isInstagramShareAvailable();

  const handleShare = async () => {
    setError(null);
    try {
      const image = await capture();
      const result = await shareToInstagramStory({
        backgroundImage: image,
        attributionURL,
        backgroundTopColor,
        backgroundBottomColor,
      });
      if (result.ok) {
        hapticSuccess();
        onClose();
      } else if (result.reason !== 'cancelled') {
        setError("Couldn't share — try again.");
      }
    } catch {
      setError("Couldn't capture the card — try again.");
    }
  };

  return (
    <Modal visible={visible} transparent animationType='fade' onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel='Dismiss' />
      <View style={styles.container} pointerEvents='box-none'>
        <View style={styles.cardShadowWrap} pointerEvents='none'>
          {renderCard(ref)}
        </View>

        <View style={styles.actions}>
          <Pressable
            style={styles.primaryBtn}
            onPress={handleShare}
            disabled={capturing}
            accessibilityRole='button'
            accessibilityLabel={
              igAvailable ? 'Share to Instagram Stories' : 'Share'
            }
          >
            <Text style={styles.primaryBtnText}>
              {capturing
                ? 'Preparing…'
                : igAvailable
                  ? '📸  Share to Instagram Stories'
                  : '↑  Share'}
            </Text>
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
