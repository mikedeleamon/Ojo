import OnboardingPage from '../../src/views/OnboardingPage/OnboardingPage';
import { useAuth } from '../../src/context/AuthContext';

export default function OnboardingScreen() {
  const { login } = useAuth();
  return <OnboardingPage onComplete={login} />;
}
