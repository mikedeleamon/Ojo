import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from '../api/client';
import { authHeaders, getToken } from './auth';
import { NotificationSettings } from '../types';
import { storage } from './storage';

// Show alerts for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
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
  tripPackingEnabled:   false,
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

// ─── Trip packing reminders ───────────────────────────────────────────────────
// Scheduled locally, per saved TripFit plan, when a plan is created or updated.
// Two stages fire at 9am local time: one a week out, one two days before.
// A registry of plan ids is kept so the master toggle can cancel them all
// without needing to import the trip store (which would be circular).

export const TRIP_PACKING_PREF_KEY = 'ojo_trip_packing_enabled';
const TRIP_REGISTRY_KEY = 'ojo_trip_reminder_plan_ids';

const weekReminderId    = (planId: string) => `ojo_trip_${planId}_wk`;
const twoDayReminderId  = (planId: string) => `ojo_trip_${planId}_2d`;

interface TripReminderInput {
  id:          string;          // plan id
  destination: string;
  startDate:   string;          // ISO yyyy-mm-dd
  days?:       { articleIds: string[] }[];
  checkedIds?: string[];
}

const loadRegistry = async (): Promise<string[]> => {
  try {
    const raw = await storage.getItem(TRIP_REGISTRY_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
};

const saveRegistry = (ids: string[]) =>
  storage.setItem(TRIP_REGISTRY_KEY, JSON.stringify([...new Set(ids)]));

/** Builds a 9am-local Date `daysBefore` ahead of the trip start, or null if past. */
const reminderDate = (startISO: string, daysBefore: number): Date | null => {
  const start = new Date(startISO + 'T09:00:00');
  if (isNaN(start.getTime())) return null;
  const d = new Date(start);
  d.setDate(d.getDate() - daysBefore);
  return d > new Date() ? d : null;
};

/** Schedule (or reschedule) the week-out + two-day reminders for one plan. */
export const scheduleTripReminders = async (plan: TripReminderInput): Promise<void> => {
  // Always clear the plan's existing reminders first so updates don't duplicate.
  await cancelTripReminders(plan.id);

  const enabled = await storage.getItem(TRIP_PACKING_PREF_KEY);
  if (enabled !== 'true') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Count items still to pack (unique articles across all days, minus packed).
  const packed = new Set(plan.checkedIds ?? []);
  const toPack = new Set<string>();
  for (const d of plan.days ?? [])
    for (const id of d.articleIds) if (!packed.has(id)) toPack.add(id);
  const remaining = toPack.size;

  const weekDate  = reminderDate(plan.startDate, 7);
  const twoDayDate = reminderDate(plan.startDate, 2);

  if (weekDate) {
    await Notifications.scheduleNotificationAsync({
      identifier: weekReminderId(plan.id),
      content: {
        title: `${plan.destination} is a week away ✈️`,
        body: remaining > 0
          ? `${remaining} item${remaining === 1 ? '' : 's'} still to pack — open your TripFit list.`
          : 'Review your TripFit packing list before you go.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: weekDate },
    }).catch(() => {});
  }

  if (twoDayDate) {
    await Notifications.scheduleNotificationAsync({
      identifier: twoDayReminderId(plan.id),
      content: {
        title: `Pack for ${plan.destination}!`,
        body: 'Your trip starts in 2 days. Check off your TripFit packing list.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: twoDayDate },
    }).catch(() => {});
  }

  if (weekDate || twoDayDate) {
    const reg = await loadRegistry();
    await saveRegistry([...reg, plan.id]);
  }
};

/** Cancel both reminders for a single plan and drop it from the registry. */
export const cancelTripReminders = async (planId: string): Promise<void> => {
  await Notifications.cancelScheduledNotificationAsync(weekReminderId(planId)).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(twoDayReminderId(planId)).catch(() => {});
  const reg = await loadRegistry();
  await saveRegistry(reg.filter(id => id !== planId));
};

/** Cancel every scheduled trip reminder (used when the master toggle is turned off). */
export const cancelAllTripReminders = async (): Promise<void> => {
  const reg = await loadRegistry();
  await Promise.all(reg.map(id => Promise.all([
    Notifications.cancelScheduledNotificationAsync(weekReminderId(id)).catch(() => {}),
    Notifications.cancelScheduledNotificationAsync(twoDayReminderId(id)).catch(() => {}),
  ])));
  await storage.removeItem(TRIP_REGISTRY_KEY);
};

// Back-compat alias — NotificationsScreen imports this to clear reminders when
// the user disables the trip-packing toggle.
export const cancelTripPackingReminder = cancelAllTripReminders;
