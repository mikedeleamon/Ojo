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
  sameDayNudgeEnabled:  false,
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
    // The zone rides along with the token because this runs on every cold start,
    // while the settings screen may be visited once and never again — that's
    // what keeps a traveller's server-sent notifications on their new clock.
    await axios.post(
      '/api/notifications/token',
      { pushToken: token, timeZone: deviceTimeZone() },
      authHeaders(),
    );
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

// Weekly recap uses a fixed identifier + repeating WEEKLY trigger, so once
// scheduled it keeps firing with whatever content it was given — it's only
// ever refreshed when the user revisits and saves Notification Settings.
// Anyone who enabled it before recap deep-linking shipped (`data.url` added
// alongside the recap page) is stuck forever on stale copy that doesn't
// navigate on tap. Call this once per launch to self-heal by re-applying the
// current schedule for anyone who already has it enabled.
export const reconcileWeeklyRecap = async (): Promise<void> => {
  if (!getToken()) return;
  try {
    const { data } = await axios.get('/api/notifications/settings', authHeaders());
    if (data?.weeklyRecapEnabled) {
      await scheduleWeeklyRecap(data.weeklyRecapDay ?? 0);
    }
  } catch {
    // Best-effort — NotificationsScreen still refreshes it on next save.
  }
};

// ─── UTC conversion helpers ───────────────────────────────────────────────────
// Convert a user's chosen local hour (0–23) to a UTC hour.
//
// These are no longer the source of truth for scheduling. The hour the user
// picked is now sent to the server as `morningBriefHourLocal` alongside
// `deviceTimeZone()`, and the server re-derives the UTC hour from the zone on
// every cron tick (server/src/lib/timeZone.ts). That is what makes the schedule
// survive a DST change: the offset these helpers read describes the device
// *right now*, so a value computed today is wrong the moment the clocks move,
// and it stayed wrong until the user happened to re-save the settings screen.
//
// They remain because `morningBriefHourUTC` is still written (older servers and
// older clients both read it) and because useMorningBriefScheduler needs a local
// hour when reading back an account that predates `morningBriefHourLocal`.
// utcHourForLocalHour on the server is an exact match for localHourToUTC here —
// see the parity assertion in server/src/lib/__tests__/timeZone.test.ts.
//
// The offset is quantised to whole hours BEFORE the arithmetic, not after.
// That matters in the zones with a sub-hour offset (India +5:30, Nepal +5:45,
// Adelaide, Newfoundland, Chatham): adding the raw offset produced a fractional
// UTC hour, e.g. 8am in India stored as 2.5. Two things broke silently on that
// value — runMorningCheck in the server's notificationService matches
// `morningBriefHourUTC` against an integer `getUTCHours()`, so 2.5 matched no
// hour and the closet-gap nudge simply never fired (and `lastMorningSnapshot`
// was never written, degrading the afternoon weather-change check with it);
// and the round trip was not stable, so re-saving the screen walked the hour
// forward. Rounding the SUM instead would still drift — round(2.5)=3 converts
// back to round(8.5)=9 — because a fractional offset makes integer↔integer
// conversion non-invertible. Quantising the offset makes the pair exact
// inverses for all 24 hours in every zone.
//
// The cost is a sub-hour skew in those zones (India's 8am nudge fires at 8:30
// local). That is inherent, not a regression: the server cron runs hourly on
// the hour, so an integer UTC hour is the finest granularity it can honour.

/**
 * The device's IANA zone name, e.g. "Europe/Berlin", or undefined if the
 * runtime can't report one.
 *
 * This is the value the SERVER schedules from. A zone name carries its own DST
 * rules, so the server can re-derive the correct UTC hour on every cron tick;
 * the fixed offset below can only describe the moment it was read. Sent with
 * every push-token registration (which happens on each cold start) so it also
 * follows the user when they travel.
 */
export const deviceTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
};

/** Device UTC offset in whole hours. Positive = behind UTC (matches getTimezoneOffset). */
const offsetHours = (): number => Math.round(new Date().getTimezoneOffset() / 60);

/** Local hour (0–23) → UTC hour (0–23). Always an integer. */
export const localHourToUTC = (localHour: number): number =>
  ((localHour + offsetHours()) % 24 + 24) % 24;

/** UTC hour (0–23) → local hour (0–23). Exact inverse of localHourToUTC. */
export const utcHourToLocal = (utcHour: number): number =>
  ((utcHour - offsetHours()) % 24 + 24) % 24;

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
        data: { url: `ojo://trip/${plan.id}` },
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
        data: { url: `ojo://trip/${plan.id}` },
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
        data: { url: `ojo://trip/${plan.id}` },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    }).catch(() => {});
  }
};

// ─── Morning Outfit Brief ─────────────────────────────────────────────────────
// A rolling window of per-day DATE triggers at the user's chosen local hour,
// each carrying copy built from that day's forecast and the outfit the engine
// generated for it.
//
// Why DATE-per-day and not a repeating DAILY trigger: a repeating trigger
// freezes its content at schedule time, so it could only ever say something
// generic — which is exactly the failure that got the server-side brief disabled
// (see lib/morningBrief.ts). Discrete days cost us N pending notifications and
// buy real, day-specific copy.
//
// The cost of that choice: the window only advances while the app is open, so a
// user who never opens Ojo eventually runs out. BRIEF_WINDOW_DAYS is the size of
// that grace period. Every home-screen sync re-schedules the whole window, so in
// normal use the near days are always freshly generated.
//
// iOS caps pending local notifications at 64. Budget: 7 here + up to 14 Trip Mode
// + 2 per trip plan + 1 recap + up to 2 same-day nudges.

export const BRIEF_WINDOW_DAYS = 7;

const BRIEF_PREFIX = 'ojo_morningbrief_';
const briefNotifId = (dateISO: string) => `${BRIEF_PREFIX}${dateISO}`;

/** Copy for the next brief, so Notification Settings can show a preview without
 *  needing weather or closet context of its own. */
export const BRIEF_PREVIEW_KEY = 'ojo_morning_brief_preview';

export interface BriefDay {
  /** Local calendar date, yyyy-mm-dd — must match DailyForecast.date. */
  dateISO: string;
  title: string;
  body: string;
}

export interface ScheduleBriefsInput {
  enabled: boolean;
  /** 0–23 local. Convert from the stored UTC hour with utcHourToLocal. */
  localHour: number;
  days: BriefDay[];
}

/** Cancel every scheduled Morning Outfit Brief. */
export const cancelMorningBriefs = async (): Promise<void> => {
  await cancelByPrefix(BRIEF_PREFIX);
  await storage.removeItem(BRIEF_PREVIEW_KEY).catch(() => {});
};

/**
 * (Re)schedule the rolling brief window.
 *
 * Always cancels first, so calling this on every sync replaces the window rather
 * than stacking duplicates on top of it.
 *
 * Returns the number scheduled, which is what the on-device check in the plan
 * asserts against; callers are free to ignore it.
 */
export const scheduleMorningBriefs = async ({
  enabled,
  localHour,
  days,
}: ScheduleBriefsInput): Promise<number> => {
  await cancelByPrefix(BRIEF_PREFIX);

  if (!enabled) {
    await storage.removeItem(BRIEF_PREVIEW_KEY).catch(() => {});
    return 0;
  }

  // A local notification needs permission just as much as a push does — it just
  // doesn't need a push token.
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return 0;

  const hour = Number.isInteger(localHour) ? Math.min(Math.max(localHour, 0), 23) : 7;
  const now = new Date();
  let scheduled = 0;
  let firstUpcoming: BriefDay | null = null;

  for (const day of days.slice(0, BRIEF_WINDOW_DAYS)) {
    const fireAt = new Date(day.dateISO + 'T00:00:00');
    if (isNaN(fireAt.getTime())) continue;
    fireAt.setHours(hour, 0, 0, 0);
    // Today's brief is already past by the time most syncs run; skip rather than
    // firing it immediately, which would read as a bug.
    if (fireAt <= now) continue;

    await Notifications.scheduleNotificationAsync({
      identifier: briefNotifId(day.dateISO),
      content: {
        title: day.title,
        body: day.body,
        // Lands on the home tab (today's outfit) rather than wherever the app
        // was last left. Mapped by app/+native-intent.tsx.
        data: { url: 'ojo://outfit' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    }).catch(() => {});

    if (!firstUpcoming) firstUpcoming = day;
    scheduled++;
  }

  if (firstUpcoming) {
    await storage
      .setItem(BRIEF_PREVIEW_KEY, JSON.stringify(firstUpcoming))
      .catch(() => {});
  }

  return scheduled;
};

/** The next brief's copy, for the Notification Settings preview. */
export const getBriefPreview = async (): Promise<BriefDay | null> => {
  try {
    const raw = await storage.getItem(BRIEF_PREVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.title === 'string' && typeof parsed?.body === 'string'
      ? (parsed as BriefDay)
      : null;
  } catch {
    return null;
  }
};

/**
 * Drop the window if the feature was turned off on another device (settings sync
 * through the server, notifications don't). Without this, disabling the brief on
 * one phone leaves the other still firing a week of already-scheduled copy.
 *
 * Only ever cancels. Re-scheduling needs weather and closet data that only the
 * home screen has — useMorningBriefScheduler refills the window on next sync.
 */
export const reconcileMorningBriefs = async (): Promise<void> => {
  if (!getToken()) return;
  try {
    const { data } = await axios.get('/api/notifications/settings', authHeaders());
    if (!data?.morningBriefEnabled) await cancelMorningBriefs();
  } catch {
    // Best-effort — leave the existing window alone rather than cancelling on a
    // transient network failure.
  }
};

// ─── Same-Day Weather Nudge ────────────────────────────────────────────────────
// A same-day DATE trigger fired at the actual clock hour buildTimeline flags a
// real change (a temp swing crossing, rain starting or clearing) — not the
// Morning Brief's once-a-day, fixed-hour check-in. Scheduled off the live outfit
// generation that already runs in OutfitSuggestion (see
// useSameDayNudgeScheduler), so there's no separate fetch here — filtering and
// content live in lib/sameDayNudge.ts, this file only knows how to schedule/
// cancel what it's handed, same division as the Brief.
//
// Distinct from weatherChangeEnabled: that's an existing server-side cron fixed
// to 2pm UTC with no per-user hour precision. A user with both toggles on can get
// two pushes about the same event — flagged in NotificationsScreen, not resolved
// here.

const SAME_DAY_NUDGE_PREFIX = 'ojo_samedaynudge_';

// idx guards two candidates sharing an hour (e.g. rain starts and a temp
// threshold cross in the same clock hour) from colliding on one identifier.
const sameDayNudgeId = (dateISO: string, hour: number, idx: number) =>
  `${SAME_DAY_NUDGE_PREFIX}${dateISO}_${hour}_${idx}`;

export interface SameDayNudgeItem {
  /** Local calendar date, yyyy-mm-dd — always "today" in practice. */
  dateISO: string;
  /** 0–23 local wall-clock hour to fire at. */
  hour:  number;
  title: string;
  body:  string;
}

/** Cancel every scheduled Same-Day Weather Nudge. */
export const cancelSameDayNudges = async (): Promise<void> =>
  cancelByPrefix(SAME_DAY_NUDGE_PREFIX);

/**
 * (Re)schedule today's nudges.
 *
 * Always cancels first, so calling this on every sync replaces the set rather
 * than stacking duplicates on top of it — same pattern as scheduleMorningBriefs.
 *
 * Returns the number scheduled.
 */
export const scheduleSameDayNudges = async (items: SameDayNudgeItem[]): Promise<number> => {
  await cancelByPrefix(SAME_DAY_NUDGE_PREFIX);

  if (items.length === 0) return 0;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return 0;

  const now = new Date();
  let scheduled = 0;

  for (const [idx, item] of items.entries()) {
    const fireAt = new Date(item.dateISO + 'T00:00:00');
    if (isNaN(fireAt.getTime())) continue;
    fireAt.setHours(item.hour, 0, 0, 0);
    if (fireAt <= now) continue; // the step's hour already passed

    await Notifications.scheduleNotificationAsync({
      identifier: sameDayNudgeId(item.dateISO, item.hour, idx),
      content: {
        title: item.title,
        body: item.body,
        data: { url: 'ojo://outfit' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    }).catch(() => {});

    scheduled++;
  }

  return scheduled;
};

/**
 * Drop today's nudges if the feature was turned off on another device — same
 * cross-device-off reasoning as reconcileMorningBriefs. Only ever cancels;
 * re-scheduling needs the live outfit generation only the home screen has.
 */
export const reconcileSameDayNudges = async (): Promise<void> => {
  if (!getToken()) return;
  try {
    const { data } = await axios.get('/api/notifications/settings', authHeaders());
    if (!data?.sameDayNudgeEnabled) await cancelSameDayNudges();
  } catch {
    // Best-effort — leave the existing schedule alone on a transient failure.
  }
};
