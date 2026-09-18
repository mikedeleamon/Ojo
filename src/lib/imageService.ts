/**
 * imageService.ts — React Native implementation using expo-image-picker.
 * Images are uploaded to Cloudflare R2 via the server.
 */

import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import client from '../api/client';
import { authHeaders } from './auth';

export const MAX_FILE_MB    = 5;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export interface ImageResult {
  uri:      string | null;   // base64 data URI for storage
  localUri: string | null;   // local file URI for on-device ML processing
  width:    number | null;
  height:   number | null;
  error:    string | null;
  /** The OS refused camera or photo access. Callers show
   *  showAccessDeniedAlert rather than `error`, so the user gets a way to
   *  Settings instead of a bare "Error" alert. */
  denied?:  boolean;
}

/**
 * Explains a refused camera or photo permission and links to Settings.
 *
 * Only ever shown after the system prompt has been answered: once iOS has
 * recorded a denial it never asks again, so without this link the button just
 * fails forever. App Review suggested exactly this pairing when it rejected
 * build 31's camera pre-prompt (5.1.1(iv)) — tell the user the feature needs
 * access and link to Settings, rather than nudging them before the prompt.
 */
export const showAccessDeniedAlert = (source: 'camera' | 'library'): void => {
  Alert.alert(
    source === 'camera' ? 'Camera access is off' : 'Photo access is off',
    source === 'camera'
      ? 'To photograph clothing for your closet, turn on camera access for Ojo in Settings.'
      : 'To add clothing photos from your library, turn on photo access for Ojo in Settings.',
    [
      { text: 'Close', style: 'cancel' },
      { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
    ],
  );
};

export const pickImage = async (): Promise<ImageResult> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return { uri: null, localUri: null, width: null, height: null, error: 'Photo library access denied.', denied: true };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality:    0.7,
      base64:     true,
      allowsEditing: true,
      aspect:     [1, 1],
    });

    if (result.canceled) return { uri: null, localUri: null, width: null, height: null, error: null };

    const asset = result.assets[0];
    if (!asset.base64) return { uri: null, localUri: null, width: null, height: null, error: 'Could not read image.' };

    const approxBytes = asset.base64.length * 0.75;
    if (approxBytes > MAX_FILE_BYTES) {
      return {
        uri:      null,
        localUri: null,
        width:    null,
        height:   null,
        error:    `Image must be under ${MAX_FILE_MB}MB.`,
      };
    }

    return {
      uri:      `data:image/jpeg;base64,${asset.base64}`,
      localUri: asset.uri,
      width:    asset.width  ?? null,
      height:   asset.height ?? null,
      error:    null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to pick image.';
    return { uri: null, localUri: null, width: null, height: null, error: msg };
  }
};

export const captureImage = async (): Promise<ImageResult> => {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      return { uri: null, localUri: null, width: null, height: null, error: 'Camera access denied.', denied: true };
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality:    0.7,
      base64:     true,
      allowsEditing: true,
      aspect:     [1, 1],
    });

    if (result.canceled) return { uri: null, localUri: null, width: null, height: null, error: null };

    const asset = result.assets[0];
    if (!asset.base64) return { uri: null, localUri: null, width: null, height: null, error: 'Could not read image.' };

    const approxBytes = asset.base64.length * 0.75;
    if (approxBytes > MAX_FILE_BYTES) {
      return {
        uri:      null,
        localUri: null,
        width:    null,
        height:   null,
        error:    `Image must be under ${MAX_FILE_MB}MB.`,
      };
    }

    return {
      uri:      `data:image/jpeg;base64,${asset.base64}`,
      localUri: asset.uri,
      width:    asset.width  ?? null,
      height:   asset.height ?? null,
      error:    null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to capture image.';
    return { uri: null, localUri: null, width: null, height: null, error: msg };
  }
};

/**
 * Upload base64 image to Cloudflare R2 via the server.
 * Returns the public R2 URL or null on failure.
 */
export const uploadImageToR2 = async (base64: string, closetId: string): Promise<string | null> => {
  try {
    if (!base64.startsWith('data:')) return null;
    const config = authHeaders();
    if (!config.headers) return null;

    const { data } = await client.post<{ imageUrl: string }>(
      `/api/closets/${closetId}/upload-image`,
      { base64 },
      config,
    );
    return data?.imageUrl ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Image upload failed';
    console.error('[imageService] R2 upload error:', msg);
    return null;
  }
};
