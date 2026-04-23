/**
 * imageService.ts — platform-agnostic image picker + validation.
 *
 * Web:  hidden <input type="file"> + FileReader (current)
 * RN:   replace this file with the Expo version below —
 *       ArticleModal and any other caller stays identical.
 *
 * ─── React Native replacement ────────────────────────────────────────────────
 *
 *   import * as ImagePicker from 'expo-image-picker';
 *
 *   export const pickImage = async (): Promise<ImageResult> => {
 *     const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
 *     if (status !== 'granted') return { uri: null, error: 'Photo library access denied.' };
 *
 *     const result = await ImagePicker.launchImageLibraryAsync({
 *       mediaTypes: ImagePicker.MediaTypeOptions.Images,
 *       quality:    0.7,    // 70% compression — keeps files under 1MB for most photos
 *       base64:     true,
 *       allowsEditing: true,
 *       aspect: [1, 1],
 *     });
 *
 *     if (result.canceled) return { uri: null, error: null };
 *
 *     const asset = result.assets[0];
 *     if (!asset.base64) return { uri: null, error: 'Could not read image.' };
 *
 *     // Validate size from base64 length (each char ≈ 0.75 bytes)
 *     const approxBytes = asset.base64.length * 0.75;
 *     if (approxBytes > MAX_FILE_BYTES) {
 *       return { uri: null, error: `Image must be under ${MAX_FILE_MB}MB.` };
 *     }
 *
 *     return { uri: `data:image/jpeg;base64,${asset.base64}`, error: null };
 *   };
 */

/** Maximum upload size — 5 MB */
export const MAX_FILE_MB    = 5;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/** Allowed MIME types */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface ImageResult {
  /** base64 data URI, or null if cancelled / error */
  uri:   string | null;
  /** Human-readable error message, or null if success / cancelled */
  error: string | null;
}

/**
 * Opens the platform image picker and returns a validated base64 data URI.
 *
 * Returns { uri: null, error: null } when the user cancels without selecting.
 * Returns { uri: null, error: <message> } on validation failure.
 */
export const pickImage = (): Promise<ImageResult> => {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type    = 'file';
    input.accept  = 'image/*';

    // Resolve with cancelled state if the dialog closes without a selection
    const onFocus = () => {
      window.removeEventListener('focus', onFocus);
      setTimeout(() => {
        if (!input.files?.length) resolve({ uri: null, error: null });
      }, 500);
    };
    window.addEventListener('focus', onFocus);

    input.onchange = () => {
      window.removeEventListener('focus', onFocus);
      const file = input.files?.[0];
      if (!file) { resolve({ uri: null, error: null }); return; }

      // ── Validation ──────────────────────────────────────────────────────────
      if (!ALLOWED_TYPES.includes(file.type)) {
        resolve({ uri: null, error: 'Please select a JPEG, PNG, WebP, or GIF image.' });
        return;
      }

      if (file.size > MAX_FILE_BYTES) {
        resolve({ uri: null, error: `Image must be under ${MAX_FILE_MB}MB. This file is ${(file.size / 1024 / 1024).toFixed(1)}MB.` });
        return;
      }

      // ── Read ────────────────────────────────────────────────────────────────
      const reader = new FileReader();
      reader.onload  = () => resolve({ uri: reader.result as string, error: null });
      reader.onerror = () => resolve({ uri: null, error: 'Could not read image file.' });
      reader.readAsDataURL(file);
    };

    input.click();
  });
};
