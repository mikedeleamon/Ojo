/**
 * exportTrainingData.ts
 * ---------------------
 * Offline export of wear-log history as JSONL for the ML style ranker
 * (ojo-training repo). Not an API route on purpose: training data leaves the
 * database only when someone runs this deliberately, with userIds hashed.
 *
 * Usage:  npx ts-node src/scripts/exportTrainingData.ts [outPath]
 *         (default outPath: ./training_export.jsonl)
 *
 * One JSON object per line:
 *   {
 *     userHash,             // sha256 of the userId — never the raw id
 *     wornAt,               // ISO timestamp
 *     context,              // WearContext | null (null = pre-instrumentation entry)
 *     positive: { articleIds, articles, engine },   // engine may be null
 *     negatives: [{ articleIds, articles, score, source }]
 *   }
 *
 * `articles` carries only ranker-relevant attributes (type/category/fabric/
 * color/gender/isAccessory), joined from the user's closets at export time.
 * Articles deleted since the wear are exported as null so the training loader
 * can decide how to handle partial outfits.
 */

import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { connectDB } from '../db';
import OutfitHistory from '../models/OutfitHistory';
import Closet from '../models/Closet';

interface ExportedArticle {
  clothingType:        string;
  clothingCategories:  string[];
  fabricType:          string | null;
  color:               string | null;
  gender:              string | null;
  isAccessory:         boolean;
}

const hashUserId = (userId: string): string =>
  crypto.createHash('sha256').update(userId).digest('hex');

/** article _id → ranker-relevant attributes, across all of a user's closets. */
const buildArticleIndex = async (userId: string): Promise<Map<string, ExportedArticle>> => {
  const closets = await Closet.find({ userId }).lean();
  const index = new Map<string, ExportedArticle>();
  for (const closet of closets) {
    for (const a of closet.articles ?? []) {
      index.set(String(a._id), {
        clothingType:       a.clothingType,
        clothingCategories: a.clothingCategories?.length
          ? a.clothingCategories
          : a.clothingCategory ? [a.clothingCategory] : [],
        fabricType:  a.fabricType ?? null,
        color:       a.color ?? null,
        gender:      a.gender ?? null,
        isAccessory: a.isAccessory ?? false,
      });
    }
  }
  return index;
};

async function exportTrainingData() {
  await connectDB();

  const outPath = path.resolve(process.argv[2] ?? './training_export.jsonl');
  const out = fs.createWriteStream(outPath, { flags: 'w' });

  const userIds = (await OutfitHistory.distinct('userId')).map(String);
  let entryCount = 0;
  let withContext = 0;

  for (const userId of userIds) {
    const userHash = hashUserId(String(userId));
    const articleIndex = await buildArticleIndex(String(userId));
    const lookup = (ids: string[]) => ids.map(id => articleIndex.get(id) ?? null);

    const entries = await OutfitHistory
      .find({ userId })
      .sort({ wornAt: 1 })
      .lean();

    for (const e of entries) {
      const line = {
        userHash,
        wornAt:  e.wornAt.toISOString(),
        context: e.context ?? null,
        positive: {
          articleIds: e.articleIds,
          articles:   lookup(e.articleIds),
          engine:     e.engine ?? null,
        },
        negatives: (e.negatives ?? []).map(n => ({
          articleIds: n.articleIds,
          articles:   lookup(n.articleIds),
          score:      n.score,
          source:     n.source,
        })),
      };
      out.write(JSON.stringify(line) + '\n');
      entryCount++;
      if (e.context) withContext++;
    }
  }

  await new Promise<void>((resolve, reject) => {
    out.end((err: Error | null | undefined) => (err ? reject(err) : resolve()));
  });

  console.log(`Exported ${entryCount} entries from ${userIds.length} user(s) → ${outPath}`);
  console.log(`${withContext} entries carry ranker context (trainable); ${entryCount - withContext} predate instrumentation.`);
  process.exit(0);
}

exportTrainingData().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});
