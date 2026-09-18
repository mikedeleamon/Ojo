/**
 * purgeBirthdays.ts
 * -----------------
 * One-time cleanup: remove the date of birth older accounts still hold.
 *
 * WHY
 * ───
 * Ojo required a date of birth, at sign-up and again after Apple/Google
 * sign-in, until App Review rejected build 31 under guideline 5.1.1(v): an app
 * may only require information its core functionality needs, and nothing in
 * Ojo uses a birthday. The app no longer asks, the server no longer reads or
 * writes it, and the Privacy Policy no longer lists it as collected. Every
 * value still stored is therefore data we neither use nor disclose, so it is
 * removed rather than left in place.
 *
 * Unsets `birthday` and `ageVerifiedAt` (the old gate's record of when a
 * birthday was accepted). Nothing else on the account is touched.
 *
 * Irreversible, so run it with --dry-run first. Idempotent: a second run
 * matches nothing.
 *
 * Run with:  npx ts-node src/scripts/purgeBirthdays.ts [--dry-run]
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { connectDB } from '../db';
import User from '../models/User';

async function purge() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  // Both fields are gone from the schema, and Mongoose's strict mode silently
  // drops unknown paths from an update, so a model-level $unset would report
  // success and change nothing. The native collection has no such filter.
  const users = User.collection;
  const filter = {
    $or: [{ birthday: { $exists: true } }, { ageVerifiedAt: { $exists: true } }],
  };

  const count = await users.countDocuments(filter);
  console.log(`${count} account(s) still hold a birthday or ageVerifiedAt.`);

  if (dryRun) {
    console.log('Dry run — nothing changed.');
  } else if (count > 0) {
    const result = await users.updateMany(filter, {
      $unset: { birthday: '', ageVerifiedAt: '' },
    });
    console.log(`Removed from ${result.modifiedCount} account(s).`);
  }

  process.exit(0);
}

purge().catch(err => {
  console.error('Purge failed:', err);
  process.exit(1);
});
