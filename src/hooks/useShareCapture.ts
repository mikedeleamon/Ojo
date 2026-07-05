import { useRef, useState, useCallback } from 'react';
import { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

/**
 * Captures whatever is rendered under `ref` as a base64 PNG data URI, for
 * handing straight to instagramShare.ts (no temp-file plumbing needed).
 */
export function useShareCapture() {
  const ref = useRef<View>(null);
  const [capturing, setCapturing] = useState(false);

  const capture = useCallback(async (): Promise<string> => {
    if (!ref.current) throw new Error('Nothing to capture yet');
    setCapturing(true);
    try {
      return await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
    } finally {
      setCapturing(false);
    }
  }, []);

  return { ref, capture, capturing };
}
