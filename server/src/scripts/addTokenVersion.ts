/**
 * addTokenVersion.ts
 * ------------------
 * One-time migration: backfill tokenVersion: 0 on all user documents
 * that predate the field. Safe to run multiple times (no-op if already set).
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../db';
import User from '../models/User';

async function migrate() {
  await connectDB();

  const result = await User.updateMany(
    { tokenVersion: { $exists: false } },
    { $set: { tokenVersion: 0 } },
  );

  console.log(`Migrated ${result.modifiedCount} user(s) — tokenVersion backfilled.`);
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
