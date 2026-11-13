/**
 * background/lifecycle.ts — starting and stopping the background work.
 *
 * Separate from ./tasks (which defines what the work does) so that AuthContext
 * can stop it on sign-out without importing the refresh, which imports
 * SettingsContext, which imports AuthContext.
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import { stopWatchingArea, watchArea } from './geofence';
import { clearDevicePlace, readDevicePlace, rememberDevicePlace } from './devicePlace';
import { getBackgroundLocationAccess } from './locationAccess';

export const BACKGROUND_REFRESH_TASK = 'ojo-background-refresh';

/**
 * Minimum minutes between background runs. iOS treats it as a floor and
 * usually waits longer; asking for less than this buys nothing but battery.
 */
const REFRESH_INTERVAL_MIN = 120;

/**
 * Bring background work in line with the current account and permissions.
 * Idempotent and cheap — call it on every signed-in launch and after the
 * "Always" permission changes.
 */
export async function syncBackgroundWork(): Promise<void> {
  try {
    if (await TaskManager.isAvailableAsync()) {
      const status = await BackgroundTask.getStatusAsync();
      const registered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK);
      if (status === BackgroundTask.BackgroundTaskStatus.Available && !registered) {
        await BackgroundTask.registerTaskAsync(BACKGROUND_REFRESH_TASK, {
          minimumInterval: REFRESH_INTERVAL_MIN,
        });
      }
    }
  } catch {
    /* Background App Refresh off, or unavailable — the app still works open. */
  }

  // The region follows the permission: without "Always" iOS stops delivering
  // its events anyway, so don't leave a dead registration behind.
  if ((await getBackgroundLocationAccess()) !== 'always') {
    await stopWatchingArea();
    return;
  }
  const place = await readDevicePlace();
  if (place) await watchArea(place);
  // No known place yet: the home screen's next fix starts the region
  // (MainPage → noteDeviceFix).
}

/**
 * The home screen just showed weather for a live device fix. Remember it as
 * the device's place (which also tells the server) and centre the region on
 * it — a geofence exit that fired while the app was open is skipped by the
 * refresh, so this is what moves the region in that case.
 */
export async function noteDeviceFix(place: {
  lat: number;
  lon: number;
  name?: string | null;
}): Promise<void> {
  try {
    await rememberDevicePlace(place);
    await watchArea(place);
  } catch {
    /* best-effort */
  }
}

/** Sign-out: nothing should keep running, or remembering places, for nobody. */
export async function stopBackgroundWork(): Promise<void> {
  try {
    if (await TaskManager.isTaskRegisteredAsync(BACKGROUND_REFRESH_TASK)) {
      await BackgroundTask.unregisterTaskAsync(BACKGROUND_REFRESH_TASK);
    }
  } catch {
    /* ignore */
  }
  await stopWatchingArea();
  await clearDevicePlace();
}
