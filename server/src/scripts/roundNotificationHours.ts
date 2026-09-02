/**
 * roundNotificationHours.ts
 * -------------------------
 * One-time migration: round every non-integer notification hour to a whole hour.
 *
 * WHY
 * ───
 * An older `localHourToUTC` (src/lib/notifications.ts) added the device's raw
 * UTC offset without quantising it, so users in a sub-hour zone — India +05:30,
 * Nepal +05:45, Adelaide, Newfoundland, Chatham — stored a fractional
 * `morningBriefHourUTC` such as 2.5. The scheduler matches that field against an
 * integer `getUTCHours()`, so a fractional value matches no hour at all: the
 * closet-gap nudge never fired, `lastMorningSnapshot` was never written, and the
 * afternoon weather-change check silently degraded to "is it raining right now"
 * for those accounts.
 *
 * Both halves of that bug are fixed going forward (the client quantises the
 * offset; `hourOfDay` in routes/notifications.ts rounds on write). Neither
 * reaches an account already holding a fractional value, because both only run
 * when the user next opens the notification settings screen and saves — which
 * most never will. This script is the part that actually heals them.
 *
 * Idempotent: a second run matches nothing.
 *
 * Run with:  npx ts-node src/scripts/roundNotificationHours.ts
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../db';
import User from '../models/User';

/**
 * Fields that must hold whole numbers, with the range the scheduler accepts.
 * `weeklyRecapDay` is included for the same reason: it was written through the
 * same unguarded `Number(v) || fallback` path.
 */
const FIELDS = [
  { path: 'notificationSettings.morningBriefHourUTC',   min: 0, max: 23 },
  { path: 'notificationSettings.morningBriefHourLocal', min: 0, max: 23 },
  { path: 'notificationSettings.weeklyRecapDay',        min: 0, max: 6  },
] as const;

async function migrate(): Promise<void> {
  await connectDB();

  let total = 0;

  for (const { path: field, min, max } of FIELDS) {
    // `$not: { $mod: [1, 0] }` selects values that leave a remainder when
    // divided by one — i.e. every non-integer. Done as a query rather than a
    // full scan so the pass only touches rows that actually need repair.
    const affected = await User.find(
      { [field]: { $exists: true, $not: { $mod: [1, 0] } } },
      { [field]: 1 },
    ).lean();

    for (const user of affected) {
      const raw = field
        .split('.')
        .reduce<any>((acc, key) => acc?.[key], user);
      if (typeof raw !== 'number' || Number.isInteger(raw)) continue;

      // Clamp as well as round: a fractional value that also landed out of
      // range is not something the scheduler can honour either.
      const rounded = Math.min(max, Math.max(min, Math.round(raw)));
      await User.updateOne({ _id: user._id }, { $set: { [field]: rounded } });
      console.log(`  ${String(user._id)}  ${field}: ${raw} → ${rounded}`);
      total++;
    }
  }

  console.log(`Migrated ${total} field value(s) to whole numbers.`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
