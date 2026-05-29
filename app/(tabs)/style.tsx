import { SafeAreaView } from 'react-native-safe-area-context';
import PreferencesScreen from '../../src/features/settings/screens/PreferencesScreen';
import { useTheme } from '../../src/theme/ThemeContext';

export default function StyleTab() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bgDefault }} edges={['top']}>
      <PreferencesScreen />
    </SafeAreaView>
  );
}
