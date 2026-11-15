import { Stack } from 'expo-router';

// ─── TripFit stack ───────────────────────────────────────────────────────────
// Like Home, TripFit sits in its own native Stack only so it can own nav-bar
// items. On the iPhone Duo the planner's back button is a native item, which iOS
// places in the side column with the tab rail (see useSideColumnBack). Everywhere
// else the header stays hidden and the planner draws its own back chevron.
export default function TripFitLayout() {
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
