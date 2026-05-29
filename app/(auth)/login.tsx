import LoginPage from '../../src/views/LoginPage/LoginPage';
import { useAuth } from '../../src/context/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  return <LoginPage onLogin={login} />;
}
