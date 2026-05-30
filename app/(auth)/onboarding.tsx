import { useRouter } from 'expo-router';
import OnboardingPage from '../../src/views/OnboardingPage/OnboardingPage';

export default function OnboardingScreen() {
  const router = useRouter();
  // OnboardingPage marks completion in storage before calling onComplete; we
  // navigate explicitly here because the AuthGate effect won't re-fire on a
  // mere storage write.
  return <OnboardingPage onComplete={() => router.replace('/(tabs)')} />;
}
