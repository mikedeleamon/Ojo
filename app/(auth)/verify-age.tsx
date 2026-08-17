import { useRouter } from 'expo-router';
import AgeGatePage from '../../src/views/AgeGatePage/AgeGatePage';

export default function VerifyAgeScreen() {
  const router = useRouter();
  // AgeGatePage clears the stored flag before calling onVerified; we navigate
  // explicitly here because the AuthGate effect won't re-fire on a mere storage
  // write (same reason as the onboarding screen).
  return <AgeGatePage onVerified={() => router.replace('/(tabs)')} />;
}
