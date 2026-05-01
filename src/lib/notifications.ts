import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from '../api/client';
import { authHeaders, getToken } from './auth';
import { NotificationSettings } from '../types';

// Show alerts for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export const NOTIF_DEFAULTS: NotificationSettings = {
  morningBriefEnabled:  false,
  morningBriefHourUTC:  12,   // 12 UTC = 7am EST / 4am PST — user sees local hour
  weatherChangeEnabled: false,
  tempSwingEnabled:     false,
  tempSwingThresholdF:  20,
  closetGapEnabled:     false,
  weeklyRecapEnabled:   false,
  weeklyRecapDay:       0,    // Sunday
};

// ─── Permissions ──────────────────────────────────────────────────────────────

export const getPermissionStatus = async (): Promise<PermissionStatus> => {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionStatus;
};

export const requestPermission = async (): Promise<PermissionStatus> => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionStatus;
};

// ─── Push token ───────────────────────────────────────────────────────────────

export const getExpoPushToken = async (): Promise<string | null> => {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    if (!projectId) {
      console.warn('[notifications] No EAS project ID — push token unavailable in dev builds without EAS');
      return null;
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.warn('[notifications] getExpoPushToken failed:', err);
    return null;
  }
};

export const registerPushToken = async (): Promise<string | null> => {
  if (!getToken()) return null;
  const status = await getPermissionStatus();
  if (status !== 'granted') return null;

  const token = await getExpoPushToken();
  if (!token) return null;

  try {
    await axios.post('/api/notifications/token', { pushToken: token }, authHeaders());
    return token;
  } catch (err) {
    console.warn('[notifications] Failed to register push token:', err);
    return null;
  }
};

// ─── Local weekly recap notification ──────────────────────────────────────────
// History lives in AsyncStorage so this is scheduled client-side.

const WEEKLY_RECAP_ID = 'ojo_weekly_recap';

export const scheduleWeeklyRecap = async (dayOfWeek: number): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_RECAP_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_RECAP_ID,
    content: {
      title: 'Weekly Wardrobe Recap',
      body: 'See what you wore this week and discover new outfit ideas.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: dayOfWeek + 1, // Expo: 1=Sun … 7=Sat; our type: 0=Sun … 6=Sat
      hour: 9,
      minute: 0,
    },
  });
};

export const cancelWeeklyRecap = async (): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_RECAP_ID).catch(() => {});
};

// ─── UTC conversion helper ────────────────────────────────────────────────────
// Convert a user's chosen local hour (0–23) to UTC hour for server storage.

export const localHourToUTC = (localHour: number): number => {
  const offsetMinutes = new Date().getTimezoneOffset(); // positive = behind UTC
  return ((localHour + offsetMinutes / 60) % 24 + 24) % 24;
};

export const utcHourToLocal = (utcHour: number): number => {
  const offsetMinutes = new Date().getTimezoneOffset();
  return ((utcHour - offsetMinutes / 60) % 24 + 24) % 24;
};
