import SettingsScreen from '../../src/features/settings/SettingsScreen';
import { useAuth } from '../../src/context/AuthContext';

export default function SettingsRoute() {
  const { logout } = useAuth();
  return <SettingsScreen onLogout={logout} />;
}
