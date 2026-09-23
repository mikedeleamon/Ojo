import { useRef, useState, useCallback } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { CARD_WIDTH, CARD_HEIGHT } from '../components/ShareCard/ShareCardFrame.styles';

// Every share card renders inside the CARD_WIDTH×CARD_HEIGHT (9:16) frame. We
// capture at a fixed 3× so the output is always exactly 1080×1920 — Instagram
// Stories' native resolution — regardless of the device's pixel density (a 2×
// phone would otherwise export 720×1280 and get upscaled).
export const EXPORT_SCALE = 3;

/**
 * Captures whatever is rendered under `ref` as a base64 PNG data URI, for
 * handing straight to instagramShare.ts (no temp-file plumbing). Sized to
 * 1080×1920 unless `size` (in pixels) says otherwise — a Story sticker is
 * captured at its own size. PNG keeps transparency outside rounded corners.
 */
export function useShareCapture() {
  const ref = useRef<View>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (size?: { width: number; height: number }): Promise<string> => {
    if (!ref.current) throw new Error('Nothing to capture yet');
    setCapturing(true);
    try {
      return await captureRef(ref, {
        format: 'png',
        quality: 1,
        result: 'data-uri',
        width: size?.width ?? CARD_WIDTH * EXPORT_SCALE,
        height: size?.height ?? CARD_HEIGHT * EXPORT_SCALE,
      });
    } finally {
      setCapturing(false);
    }
  }, []);

  return { ref, capture, capturing };
}
