import { useMemo } from 'react';
import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text } from '../../../components/primitives';
import { makeStyles } from './screens.styles';
import { spacing } from '../../../theme/tokens';
import { useTheme } from '../../../theme/ThemeContext';
import { ColorTokens } from '../../../theme/tokens';

const makeLocalStyles = (colors: ColorTokens) => StyleSheet.create({
  root:    { flex: 1, backgroundColor: colors.bgDefault },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
});

const Root = ({ children }: { children: React.ReactNode }) => {
  const { colors } = useTheme();
  const st = useMemo(() => makeLocalStyles(colors), [colors]);
  return (
    <SafeAreaView style={st.root} edges={['bottom', 'right']}>
      <ScrollView contentContainerStyle={st.content}>{children}</ScrollView>
    </SafeAreaView>
  );
};

const InfoCard = ({ title, body }: { title: string; body: string }) => {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.infoCard}>
      <Text style={s.infoTitle}>{title}</Text>
      <Text style={s.infoBody}>{body}</Text>
    </View>
  );
};

// ─── Permissions ──────────────────────────────────────────────────────────────

export const PermissionsScreen = () => (
  <Root>
    <InfoCard title="Location"
      body="When you pick “My Location,” your device's GPS is read while you use Ojo to look up local weather, and rounded to about 1 km before it leaves your phone. The latest rounded location is saved to your account so scheduled notifications, like your morning brief, can fetch local weather while the app is closed. We keep only the most recent one, never a history of where you've been. Prefer not to share GPS? Add your cities by name in Locations and skip it entirely." />
    <InfoCard title="Background location (optional)"
      body="Off unless you turn it on. If you allow “Always” location from Push Notifications, iOS wakes Ojo when your phone moves about 25 km (15 miles) from where it was. Each time it reads your location once, updates your widgets, morning brief and weather alerts for where you are, and sends the same rounded location. Ojo may also refresh now and then in the background: the first refresh after a move reads your location once more to see where you ended up, and the rest use the last place it read without reading it again. It doesn't follow your movements continuously. To stop it, set Ojo's location access back to “While Using” in the iOS Settings app." />
    <InfoCard title="Camera & Photos"
      body="Camera and photo library access are requested only when you add clothes with a photo, or save a shared image to your photos. Clothing photos are stored securely and only used to display your items." />
    <InfoCard title="Notifications"
      body="Notifications are optional. You choose which alerts to receive in Account → Push Notifications, and you can turn them off at any time." />
    <InfoCard title="Other"
      body="No microphone or contacts access is requested." />
  </Root>
);

// ─── Data Usage ───────────────────────────────────────────────────────────────

export const DataUsageScreen = () => (
  <Root>
    <InfoCard title="What we store"
      body="Your account, closets, clothes, outfit history, style preferences, and your most recent location rounded to about 1 km are stored in our secure cloud database." />
    <InfoCard title="What we don't do"
      body="We don't sell your data, use it for advertising, or share it with third parties beyond what's needed to run the app." />
    <InfoCard title="Delete your data"
      body="Go to Account → Profile → Delete Account to permanently remove all your data within 30 days." />
  </Root>
);
