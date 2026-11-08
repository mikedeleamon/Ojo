import { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { consumeCameraReturning } from '../../src/lib/cameraTabReturn';

/**
 * Camera tab — redirect placeholder.
 *
 * The native tab bar (expo-router/native-tabs) cannot intercept tab
 * presses, so we use the focus event to push the top-level /capture fullScreen
 * modal (defined at app/capture.tsx). The `return` param tells CameraPage
 * where to land on close.
 *
 * The modal route MUST NOT be named /camera: (tabs) is a pathless group, so this
 * very file already owns the URL /camera. A second camera.tsx at the app root
 * collided with it and router.push('/camera') resolved back here (blank screen).
 *
 * Dismissing the modal re-focuses this tab, which would push the camera again.
 * CameraPage flags the return before it dismisses (see cameraTabReturn), and this
 * screen then moves to Home instead.
 */
export default function CameraTabRedirect() {
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      if (consumeCameraReturning()) {
        router.navigate('/(tabs)');
        return;
      }
      // Object form avoids URL-parsing issues with the parens / slashes
      // in the `return` value.
      router.push({
        pathname: '/capture',
        params: { return: '/(tabs)' },
      });
    }, [router]),
  );

  // Blank black screen during the brief moment before the modal slides up.
  return <View style={{ flex: 1, backgroundColor: '#000' }} />;
}
