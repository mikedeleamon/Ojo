import { useLocalSearchParams } from 'expo-router';
import ResetPasswordPage from '../../src/views/ResetPasswordPage/ResetPasswordPage';
import { useAuth } from '../../src/context/AuthContext';

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { login } = useAuth();
  return <ResetPasswordPage token={token ?? ''} onLogin={login} />;
}
