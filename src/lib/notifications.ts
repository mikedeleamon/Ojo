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
  tripModeMorningEnabled: false,
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
      // Scheduled ahead of time, so the copy can't reference the week's data —
      // this is the static-safe variant from WEEKLY_RECAP_TEMPLATES.md.
      title: 'The recap is in',
      body: 'Your closet had opinions this week. See what they were.',
      data: { url: 'ojo://recap' },
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

// ─── Trip Mode morning outfit notifications ───────────────────────────────────
// While a saved trip is underway, fire a gentle 8am-local nudge each day pointing
// the user at the outfit TripFit already logged for that day. These are DATE
// triggers scheduled per trip day. Identifiers are namespaced by plan id + date
// so we can cancel a plan's whole set by prefix without a separate registry.
//
// Limitation: these are date-based — they fire during the trip window regardless
// of where the device actually is (no background location). The in-app Trip Mode
// card is what confirms the user is really at the destination.

export const TRIP_MODE_MORNING_PREF_KEY = 'ojo_trip_mode_morning_enabled';
const TRIP_MODE_PREFIX = 'ojo_tripmode_';
const TRIP_MODE_HOUR = 8; // 8am local
const TRIP_MODE_MAX_DAYS = 14;

const morningNotifId = (planId: string, dateISO: string) =>
  `${TRIP_MODE_PREFIX}${planId}_${dateISO}`;

interface TripMorningInput {
  id:          string;
  destination: string;
  startDate:   string;   // ISO yyyy-mm-dd
  endDate:     string;   // ISO yyyy-mm-dd
}

/** Inclusive yyyy-mm-dd dates between start and end (local), capped for safety. */
const datesInRange = (startISO: string, endISO: string): string[] => {
  const out: string[] = [];
  const start = new Date(startISO + 'T12:00:00');
  const end = new Date(endISO + 'T12:00:00');
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return out;
  const d = new Date(start);
  while (d <= end && out.length < TRIP_MODE_MAX_DAYS) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
      ).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return out;
};

/** Cancel every scheduled notification whose identifier starts with `prefix`. */
const cancelByPrefix = async (prefix: string): Promise<void> => {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      all
        .filter((n) => (n.identifier ?? '').startsWith(prefix))
        .map((n) =>
          Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}),
        ),
    );
  } catch {
    /* ignore */
  }
};

/** Cancel a single plan's Trip Mode morning notifications. */
export const cancelTripMorningNotifications = async (planId: string): Promise<void> =>
  cancelByPrefix(`${TRIP_MODE_PREFIX}${planId}_`);

/** Cancel every Trip Mode morning notification (master toggle off). */
export const cancelAllTripMorningNotifications = async (): Promise<void> =>
  cancelByPrefix(TRIP_MODE_PREFIX);

/** (Re)schedule the per-day 8am morning nudges for one trip. */
export const scheduleTripMorningNotifications = async (
  plan: TripMorningInput,
): Promise<void> => {
  // Always clear this plan's existing nudges first so updates don't duplicate.
  await cancelTripMorningNotifications(plan.id);

  const enabled = await storage.getItem(TRIP_MODE_MORNING_PREF_KEY);
  if (enabled !== 'true') return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  const now = new Date();
  for (const dateISO of datesInRange(plan.startDate, plan.endDate)) {
    const fireAt = new Date(dateISO + 'T00:00:00');
    fireAt.setHours(TRIP_MODE_HOUR, 0, 0, 0);
    if (fireAt <= now) continue; // skip days already past 8am

    await Notifications.scheduleNotificationAsync({
      identifier: morningNotifId(plan.id, dateISO),
      content: {
        title: `Good morning in ${plan.destination}! ☀️`,
        body: "Open Ojo to see the outfit you planned for today.",
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    }).catch(() => {});
  }
};
