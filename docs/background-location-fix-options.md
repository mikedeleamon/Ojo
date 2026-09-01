# Fixing Stale Location in Morning Brief & Widget

## The problem

When you travel (e.g. Arlington → Miami) without opening the app, the morning
brief notification and the home-screen widget both keep showing weather for
Arlington. This is not a bug — it's a consequence of how the app is built
today:

- **Morning brief** is a batch of `expo-notifications` local notifications,
  scheduled up to `BRIEF_WINDOW_DAYS` ahead with content baked in at schedule
  time (`src/hooks/useMorningBriefScheduler.ts`, `src/lib/notifications.ts`).
  Once scheduled, they fire on the OS clock — they never re-check your
  location before firing.
- **Location** is only ever resolved in the foreground, while the app is
  open. There's no background-fetch/background-task entitlement anywhere in
  the app (confirmed via grep of native config and `AppDelegate.swift`).
- **The widget** (`targets/ojo-widget/Provider.swift`) doesn't fetch location
  either — it reads a cached snapshot the RN app last wrote into the App
  Group, and its timeline refresh policy just redraws that same stale
  snapshot on a schedule.

Net effect: both surfaces are frozen to whatever city was resolved the last
time the app was opened in the foreground.

## Option A — Background location monitoring + BGAppRefreshTask

Register for iOS's low-power **significant-location-change** updates, which
wake the app in the background when you move roughly city-scale distances,
then re-run the brief scheduler and push a fresh widget snapshot.

**Pros**
- The most complete fix — corrects both the notification and the widget.
- No reliance on the user having opened the app recently.

**Cons**
- Requires upgrading location permission from "When In Use" to **"Always"**
  — a heavier ask that many users decline.
- Historically draws extra manual scrutiny in App Store review (stronger
  justification string required, higher chance of multiple
  rejection/resubmit cycles), adding real time to ship.
- Apple expects "Always" to be requested contextually, not upfront — likely
  requires an onboarding/settings UX change, not just a permission call.
- More background weather API calls, working against the ongoing WeatherKit
  cost-reduction effort (`docs/weatherkit-cost-plan.md`).

## Option B — Widget does its own background location refresh

Give the widget extension itself minimal location authorization and let it
periodically re-fetch within WidgetKit's own background timeline budget,
independent of the RN app.

**Pros**
- Avoids the "Always" permission tier — lighter App Store review footprint
  than Option A.

**Cons**
- **Doesn't fix the actual complaint.** The morning brief notification is
  scheduled by the RN app, not the widget — this only changes what the
  widget displays, not the notification content.
- WidgetKit's refresh budget is still OS-throttled and opaque; no guarantee
  of timely updates.
- Getting a Core Location fix inside a widget's tight timeline-generation
  window is unreliable, especially a cold GPS fix right after landing —
  risks the widget rendering stale or blank data instead.
- Creates two independent fetch paths (app + widget) that can disagree with
  each other.
- Extra WeatherKit calls from a second code path, duplicating what the app
  already fetches.
- Real native complexity: separate `CLLocationManager` setup, entitlements,
  and permission dialog in the widget target; hard to test since the
  simulator doesn't simulate widget background refresh well.

## Option C — Shrink the notification window + silent-push refresh

Reduce how far ahead notifications are scheduled (e.g. just the next day or
two instead of a full week), and have the backend send a **silent push**
(`content-available: 1`, `remote-notification` background mode) a few hours
before each brief is due. The push briefly wakes the app in the background
to re-check whatever "When In Use" location is already available, cancel
the stale notification, and reschedule it with fresh content.

**Pros**
- No new permission prompt and no "Always" location ask at all.
- `remote-notification` background mode is one of the least scrutinized
  entitlements in App Store review — very common, low friction.
- Meaningfully reduces the staleness window for the common case (occasional
  app opens during travel, e.g. checking email) without touching the
  location permission tier.

**Cons**
- If the user force-quits the app, iOS won't deliver silent pushes to wake
  it — same failure mode as today for that subset of users, just less
  frequent.
- Requires a backend component that can schedule/send a per-user push at
  the right local time — real work to add if the brief is currently 100%
  client-scheduled.
- Location freshness is bounded by "When In Use": it won't detect travel
  that happens with zero app opens at all during the trip.

## Recommendation

Option A is the only one that fully solves the problem, but it's the
costliest in permission friction and review risk. Option B is a partial fix
that leaves the notification issue untouched and adds real reliability and
cost tradeoffs for a widget-only improvement. Option C is the pragmatic
middle ground — it meaningfully improves the common case with the lowest
permission/review cost, at the price of adding a lightweight server-push
component. Worth starting with C and only escalating to A if travel-without-
any-app-open turns out to be common enough among users to justify the
"Always" permission ask.
