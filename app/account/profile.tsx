import ProfileScreen from '../../src/features/settings/screens/ProfileScreen';
import { useAuth } from '../../src/context/AuthContext';

export default function ProfileRoute() {
  const { logout } = useAuth();
  return <ProfileScreen onLogout={logout} />;
}
