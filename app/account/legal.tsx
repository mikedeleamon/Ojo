import { useLocalSearchParams } from 'expo-router';
import LegalWebViewScreen from '../../src/features/settings/screens/LegalWebViewScreen';
import { PRIVACY_POLICY, TERMS_OF_SERVICE } from '../../src/config/legal';

export default function LegalRoute() {
  const { docType } = useLocalSearchParams<{ docType?: string }>();
  const doc = docType === 'terms' ? TERMS_OF_SERVICE : PRIVACY_POLICY;
  return <LegalWebViewScreen doc={doc} />;
}
