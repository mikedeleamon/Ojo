import SignupPage from '../../src/views/SignupPage/Signup';
import { useAuth } from '../../src/context/AuthContext';

export default function SignupScreen() {
  const { login } = useAuth();
  return <SignupPage onLogin={login} />;
}
