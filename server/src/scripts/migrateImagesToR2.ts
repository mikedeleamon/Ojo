import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../db';
import Closet from '../models/Closet';
import { uploadToR2 } from '../lib/r2';

let migratedCount = 0;
let skippedCount = 0;
let errorCount = 0;

async function migrate() {
  await connectDB();

  const closets = await Closet.find({
    'articles.imageUrl': { $regex: '^data:' },
  });

  console.log(`Found ${closets.length} closets with base64 images`);

  for (const closet of closets) {
    for (const article of closet.articles) {
      if (article.imageUrl?.startsWith('data:')) {
        try {
          console.log(`Migrating article ${article._id}...`);
          const r2Url = await uploadToR2(article.imageUrl);
          article.imageUrl = r2Url;
          migratedCount++;
        } catch (err) {
          console.error(`Failed to migrate article ${article._id}:`, err);
          errorCount++;
        }
      } else {
        skippedCount++;
      }
    }
    await closet.save();
  }

  console.log(`\nMigration complete!`);
  console.log(`  Migrated: ${migratedCount}`);
  console.log(`  Skipped:  ${skippedCount}`);
  console.log(`  Errors:   ${errorCount}`);
  process.exit(errorCount > 0 ? 1 : 0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
