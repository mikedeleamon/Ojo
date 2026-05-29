import { useEffect, useRef } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { captureImage, pickImage } from '../../src/lib/imageService';

// This screen acts as a pure action tab — it shows a transparent background
// and immediately presents the photo-source picker when focused. After the user
// picks an image (or cancels), it navigates to the Closet tab with the result.
export default function CameraTab() {
  const router = useRouter();
  const hasActed = useRef(false);

  useFocusEffect(
    useCallback(() => {
      // Reset guard so the sheet re-opens if the user returns to this tab
      hasActed.current = false;

      const open = async () => {
        if (hasActed.current) return;
        hasActed.current = true;

        Alert.alert('Add Garment', 'Choose a photo source', [
          {
            text: 'Camera',
            onPress: async () => {
              const result = await captureImage();
              if (result.error) {
                Alert.alert('Error', result.error);
                router.replace('/(tabs)/closet');
                return;
              }
              if (result.uri && result.localUri && result.width && result.height) {
                router.replace({
                  pathname: '/(tabs)/closet',
                  params: {
                    quickAddUri: result.uri,
                    quickAddLocalUri: result.localUri,
                    quickAddWidth: String(result.width),
                    quickAddHeight: String(result.height),
                  },
                });
              } else {
                router.replace('/(tabs)/closet');
              }
            },
          },
          {
            text: 'Photo Library',
            onPress: async () => {
              const result = await pickImage();
              if (result.error) {
                Alert.alert('Error', result.error);
                router.replace('/(tabs)/closet');
                return;
              }
              if (result.uri && result.localUri && result.width && result.height) {
                router.replace({
                  pathname: '/(tabs)/closet',
                  params: {
                    quickAddUri: result.uri,
                    quickAddLocalUri: result.localUri,
                    quickAddWidth: String(result.width),
                    quickAddHeight: String(result.height),
                  },
                });
              } else {
                router.replace('/(tabs)/closet');
              }
            },
          },
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => router.replace('/(tabs)/closet'),
          },
        ]);
      };

      open();
    }, []),
  );

  // Transparent screen — the alert sheet is the only visible UI
  return <View style={styles.root} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
