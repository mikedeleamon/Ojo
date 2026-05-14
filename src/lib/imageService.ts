/**
 * imageService.ts — React Native implementation using expo-image-picker.
 * File picking is re-enabled (was URL-only on web pending image hosting).
 * Interface identical to web version — ArticleModal unchanged.
 *
 * Note: Images are still stored as base64 in MongoDB.
 * Add Cloudinary/S3 before launch to avoid the 16MB document limit.
 */

import * as ImagePicker from 'expo-image-picker';

export const MAX_FILE_MB    = 5;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

export interface ImageResult {
  uri:      string | null;   // base64 data URI for storage
  localUri: string | null;   // local file URI for on-device ML processing
  width:    number | null;
  height:   number | null;
  error:    string | null;
}

export const pickImage = async (): Promise<ImageResult> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return { uri: null, localUri: null, width: null, height: null, error: 'Photo library access denied.' };
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
      return { uri: null, localUri: null, width: null, height: null, error: 'Camera access denied.' };
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
