/**
 * roundStoredLocations.ts
 * -----------------------
 * One-time migration: round every stored account location to two decimal
 * places (~1 km), matching what the app and PUT /api/user/settings now store.
 *
 * WHY
 * ───
 * Onboarding's "Use my location" used to save the raw GPS fix, which is often
 * within ~100 m of where someone lives. The App Store privacy label now says
 * Coarse Location and the Privacy Policy says location is kept at about 1 km;
 * new writes are rounded (lib/coarseLocation.ts), and this brings accounts
 * saved before that in line. Covers settings.lat/lon and every entry in
 * settings.savedLocations.
 *
 * Idempotent: rounding an already-rounded value changes nothing, so a second
 * run matches nothing.
 *
 * Run with:  npx ts-node src/scripts/roundStoredLocations.ts [--dry-run]
 * The repo-root .env points at the dev database. For production, pass
 * production's connection string inline (dotenv never overrides it):
 *   MONGO_URI="…" npx ts-node src/scripts/roundStoredLocations.ts --dry-run
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { connectDB } from '../db';
import User from '../models/User';
import { COORD_DECIMALS } from '../lib/coarseLocation';

/** `expr` rounded, when it is a number; otherwise `expr` unchanged. */
const rounded = (expr: string) => ({
  $cond: [{ $isNumber: expr }, { $round: [expr, COORD_DECIMALS] }, expr],
});

/** True when `expr` is a number with more precision than we keep. */
const tooPrecise = (expr: string) => ({
  $and: [{ $isNumber: expr }, { $ne: [expr, { $round: [expr, COORD_DECIMALS] }] }],
});

const SAVED = { $ifNull: ['$settings.savedLocations', []] };

const currentFilter = {
  $expr: { $or: [tooPrecise('$settings.lat'), tooPrecise('$settings.lon')] },
};

const savedFilter = {
  $expr: {
    $anyElementTrue: [{
      $map: {
        input: SAVED,
        as: 'l',
        in: { $or: [tooPrecise('$$l.lat'), tooPrecise('$$l.lon')] },
      },
    }],
  },
};

async function migrate() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  // The native collection, so these pipeline updates reach Mongo exactly as
  // written rather than through Mongoose's casting.
  const users = User.collection;

  const current = await users.countDocuments(currentFilter);
  const saved = await users.countDocuments(savedFilter);
  console.log(`${current} account(s) store a current location finer than ${COORD_DECIMALS} decimals.`);
  console.log(`${saved} account(s) store a saved city finer than ${COORD_DECIMALS} decimals.`);

  if (dryRun) {
    console.log('Dry run — nothing changed.');
    process.exit(0);
  }

  if (current > 0) {
    const r = await users.updateMany(currentFilter, [
      { $set: { 'settings.lat': rounded('$settings.lat'), 'settings.lon': rounded('$settings.lon') } },
    ]);
    console.log(`Rounded the current location on ${r.modifiedCount} account(s).`);
  }

  if (saved > 0) {
    const r = await users.updateMany(savedFilter, [
      {
        $set: {
          'settings.savedLocations': {
            $map: {
              input: SAVED,
              as: 'l',
              in: { $mergeObjects: ['$$l', { lat: rounded('$$l.lat'), lon: rounded('$$l.lon') }] },
            },
          },
        },
      },
    ]);
    console.log(`Rounded saved cities on ${r.modifiedCount} account(s).`);
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
