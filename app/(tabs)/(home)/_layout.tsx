import { Stack } from 'expo-router';

// ─── Home stack ──────────────────────────────────────────────────────────────
// Home sits in its own native Stack only so it can own nav-bar items. On the
// iPhone Duo, MainPage declares Location and Settings as Stack.Toolbar items and
// iOS places them in the side column with the tab rail (the Duo HIG puts the
// toolbar, nav buttons included, on the side). Everywhere else no toolbar is
// declared, the header stays hidden, and the HUD's own buttons render as before.
//
// The header is transparent so the sky runs underneath it, and has no title:
// the city already leads the screen.
export default function HomeLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTransparent: true,
        headerShadowVisible: false,
        title: '',
      }}
    />
  );
}
