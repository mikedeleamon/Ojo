import { useMemo } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import SettingsScreen from '../../src/features/settings/SettingsScreen';
import OjoLogoIcon from '../../src/components/icons/OjoLogoIcon';
import { useAuth } from '../../src/context/AuthContext';
import { useFoldLayout } from '../../src/context/FoldLayoutContext';
import { useTheme } from '../../src/theme/ThemeContext';
import { useSideColumnBack } from '../../src/hooks/useSideColumnBack';

export default function SettingsRoute() {
  const { logout } = useAuth();
  const { mode, axis } = useFoldLayout();
  const twoPane = mode === 'two-pane' && axis === 'row';
  const router = useRouter();
  const { colors } = useTheme();
  // iPhone Duo, two panes: the list's Home button is hidden, so Home is an item
  // in the side column. In one column SettingsScreen declares its own.
  const home = useMemo(
    () => (twoPane ? { label: 'Home', kind: 'home' as const, onPress: () => router.navigate('/(tabs)'), tintColor: colors.textPrimary } : null),
    [twoPane, router, colors.textPrimary],
  );
  useSideColumnBack(home);
  // In two panes the list already sits beside this route (see _layout), so this
  // is just the pane's resting state until a row is chosen.
  if (twoPane) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <OjoLogoIcon decorative />
      </View>
    );
  }
  return <SettingsScreen onLogout={logout} />;
}
