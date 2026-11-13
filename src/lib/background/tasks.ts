/**
 * background/tasks.ts — the two ways iOS runs Ojo while it's closed.
 *
 * Must be imported at module scope from the app entry (app/_layout.tsx):
 * TaskManager only delivers a task to a JS function defined before the event
 * arrives, and on a background launch the event arrives during startup.
 *
 *   - BACKGROUND_REFRESH_TASK — iOS background processing time (BGTaskScheduler
 *     via expo-background-task). iOS decides when; in practice mostly overnight
 *     and around the times the app is usually opened, which is when tomorrow's
 *     brief and the widget most need rebuilding. Needs no location permission:
 *     without "Always" it refreshes the last known place.
 *   - CITY_GEOFENCE_TASK — the phone left the area it was in (lib/background/
 *     geofence.ts). Needs "Always" location. This is what makes notifications
 *     and widgets follow the user to a new city before they open the app.
 *
 * Starting, stopping and re-centring them lives in ./lifecycle, which is kept
 * free of the refresh's imports so AuthContext can use it without a cycle.
 */

import * as TaskManager from 'expo-task-manager';
import * as BackgroundTask from 'expo-background-task';
import * as Location from 'expo-location';
import { withBackgroundTime } from '../widget/native';
import { runBackgroundRefresh } from './refresh';
import { CITY_GEOFENCE_TASK } from './geofence';
import { BACKGROUND_REFRESH_TASK } from './lifecycle';

TaskManager.defineTask(BACKGROUND_REFRESH_TASK, async () => {
  const outcome = await runBackgroundRefresh({ trigger: 'scheduled' });
  return outcome === 'failed'
    ? BackgroundTask.BackgroundTaskResult.Failed
    : BackgroundTask.BackgroundTaskResult.Success;
});

interface GeofenceEvent {
  eventType: Location.GeofencingEventType;
  region: Location.LocationRegion;
}

TaskManager.defineTask<GeofenceEvent>(CITY_GEOFENCE_TASK, async ({ data, error }) => {
  // Enter events also arrive — iOS reports the region's initial state when
  // monitoring starts, including on every background relaunch. Only leaving
  // means anything.
  if (error || data?.eventType !== Location.GeofencingEventType.Exit) return;
  // A geofence wake gets ~10 s from iOS; ask for the usual ~30 s so the fix,
  // the weather fetch and outfit generation can finish.
  await withBackgroundTime('ojo-moved', () => runBackgroundRefresh({ trigger: 'moved' }));
});
