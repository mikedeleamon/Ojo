import { Stack } from 'expo-router';

// ─── Closet stack ────────────────────────────────────────────────────────────
// Like Home and TripFit, the Closet sits in its own native Stack only so it can
// own nav-bar items. On the iPhone Duo the white Add button is a native item,
// which iOS places in the side column with the tab rail (useSideColumnAction in
// ClosetView). Everywhere else the header stays hidden and the floating + shows.
export default function ClosetLayout() {
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
