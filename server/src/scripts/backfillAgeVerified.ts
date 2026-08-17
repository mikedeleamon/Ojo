/**
 * backfillAgeVerified.ts
 * ----------------------
 * One-time migration for the minimum-age gate.
 *
 * Every account created before the gate existed carries a birthday that was
 * never checked server-side, and every OAuth account carries no birthday at
 * all. This stamps `ageVerifiedAt` on the accounts whose stored date already
 * satisfies the rule, so those users are not re-prompted on their next launch.
 *
 * Accounts it does NOT stamp are left for the in-app gate to handle:
 *   - blank birthday (all Apple/Google sign-ups)   → prompted on next request
 *   - unparseable birthday                          → prompted on next request
 *   - a birthday that reads as under 13             → REPORTED, NOT DELETED
 *
 * That last group is deliberately left alone. A stored under-13 date on an
 * account created before any server-side check is more likely a typo than a
 * real child, and this script is not the place to make an irreversible call —
 * the in-app gate asks the user directly, and POST /api/auth/verify-age handles
 * a confirmed under-13 answer. Review the list this prints before acting.
 *
 * Safe to run repeatedly — already-stamped accounts are skipped.
 *
 * Usage:  npx ts-node src/scripts/backfillAgeVerified.ts [--dry-run]
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../db';
import User from '../models/User';
import { validateBirthday } from '../lib/age';

async function migrate() {
  const dryRun = process.argv.includes('--dry-run');
  await connectDB();

  const users = await User.find({ ageVerifiedAt: { $exists: false } })
    .select('_id email birthday')
    .lean();

  const toStamp: string[] = [];
  const blank:   string[] = [];
  const invalid: { id: string; email: string; birthday: string }[] = [];
  const underage: { id: string; email: string; birthday: string }[] = [];

  for (const u of users) {
    const id = String(u._id);
    const result = validateBirthday(u.birthday);

    if (result.ok)                              toStamp.push(id);
    else if (result.reason === 'missing')       blank.push(id);
    else if (result.reason === 'underage')      underage.push({ id, email: u.email, birthday: u.birthday });
    else                                        invalid.push({ id, email: u.email, birthday: u.birthday });
  }

  if (!dryRun && toStamp.length > 0) {
    const result = await User.updateMany(
      { _id: { $in: toStamp } },
      { $set: { ageVerifiedAt: new Date() } },
    );
    console.log(`Stamped ${result.modifiedCount} account(s) as age-verified.`);
  } else {
    console.log(`${dryRun ? '[dry run] Would stamp' : 'Stamped'} ${toStamp.length} account(s) as age-verified.`);
  }

  console.log(`\nScanned ${users.length} unstamped account(s):`);
  console.log(`  ${toStamp.length}  already hold a valid adult date of birth  → verified`);
  console.log(`  ${blank.length}  hold no date of birth (OAuth sign-ups)     → will be prompted in-app`);
  console.log(`  ${invalid.length}  hold an unparseable date                   → will be prompted in-app`);
  console.log(`  ${underage.length}  hold a date reading as under 13            → REVIEW MANUALLY`);

  if (invalid.length > 0) {
    console.log('\nUnparseable birthdays:');
    invalid.forEach(u => console.log(`  ${u.id}  ${u.email}  "${u.birthday}"`));
  }

  if (underage.length > 0) {
    console.log('\nAccounts whose stored date of birth reads as under 13.');
    console.log('These were NOT modified. They will be re-prompted in-app, and a');
    console.log('confirmed under-13 answer deletes the account through the normal');
    console.log('verify-age path. Review before taking any manual action:');
    underage.forEach(u => console.log(`  ${u.id}  ${u.email}  "${u.birthday}"`));
  }

  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
