import { View } from 'react-native';
import SettingsScreen from '../../src/features/settings/SettingsScreen';
import OjoLogoIcon from '../../src/components/icons/OjoLogoIcon';
import { useAuth } from '../../src/context/AuthContext';
import { useFoldLayout } from '../../src/context/FoldLayoutContext';

export default function SettingsRoute() {
  const { logout } = useAuth();
  const { mode, axis } = useFoldLayout();
  // In two panes the list already sits beside this route (see _layout), so this
  // is just the pane's resting state until a row is chosen.
  if (mode === 'two-pane' && axis === 'row') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <OjoLogoIcon decorative />
      </View>
    );
  }
  return <SettingsScreen onLogout={logout} />;
}
