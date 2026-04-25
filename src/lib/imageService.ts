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
  uri:   string | null;
  error: string | null;
}

export const pickImage = async (): Promise<ImageResult> => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return { uri: null, error: 'Photo library access denied.' };
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality:    0.7,
      base64:     true,
      allowsEditing: true,
      aspect:     [1, 1],
    });

    if (result.canceled) return { uri: null, error: null };

    const asset = result.assets[0];
    if (!asset.base64) return { uri: null, error: 'Could not read image.' };

    const approxBytes = asset.base64.length * 0.75;
    if (approxBytes > MAX_FILE_BYTES) {
      return {
        uri:   null,
        error: `Image must be under ${MAX_FILE_MB}MB.`,
      };
    }

    return { uri: `data:image/jpeg;base64,${asset.base64}`, error: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to pick image.';
    return { uri: null, error: msg };
  }
};
