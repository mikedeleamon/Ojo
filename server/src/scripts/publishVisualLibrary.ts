/**
 * publishVisualLibrary.ts — last step of the visual-library pipeline
 * (scripts/visual-library/README.md, docs/prerendered-visuals-plan.md Phase 0).
 *
 * Uploads scripts/visual-library/work/dist/ to R2 under content-hashed keys and
 * writes src/lib/visualLibrary/manifest.json, which ships inside the app.
 *
 *   cd server
 *   npx ts-node src/scripts/publishVisualLibrary.ts            # dry run: prints the plan, uploads nothing
 *   npx ts-node src/scripts/publishVisualLibrary.ts --upload   # uploads, then writes the manifest
 *
 * Reads R2 credentials from the repo-root .env like every script here. CHECK
 * FIRST which bucket they write to: the library must land in the bucket
 * production serves from (open question 1 in the plan). To publish with other
 * credentials, set them inline — dotenv never overrides a variable that is
 * already set.
 *
 * Refuses an incomplete library, because the app's manifest test only accepts
 * "empty" or "complete": a partial library would mean some weather gets a story loop and
 * the rest doesn't. --allow-partial exists for pipeline testing only.
 */

import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import { createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const REPO = path.join(__dirname, '../../..');
// $VL_WORK points at a throwaway work folder, as in scripts/visual-library/vl_common.py.
const WORK = process.env.VL_WORK
  ? path.resolve(process.env.VL_WORK)
  : path.join(REPO, 'scripts/visual-library/work');
const DIST = path.join(WORK, 'dist');
const DATA_FILE = path.join(WORK, 'data/library.json');
const INDEX_FILE = path.join(DIST, 'index.json');
const MANIFEST_FILE = path.join(REPO, 'src/lib/visualLibrary/manifest.json');
const PREVIEW_FILE = path.join(WORK, 'manifest.preview.json');

/** Bump only if the manifest shape changes incompatibly; content changes never need it. */
const PREFIX = 'library/v1';

// Mirrors src/lib/visualLibrary/types.ts. The app's tsconfig and the server's
// can't share a file (server builds with rootDir ./src), so the manifest test
// on the app side is what holds the two to the same shape.
interface Asset { path: string; bytes: number; w?: number; h?: number }
interface Loop extends Asset { poster: Asset }
interface Manifest { version: number; loops: Record<string, Loop> }

interface DistIndex {
  loops: Record<string, { file: string; poster: string; w?: number; h?: number }>;
}
interface LibraryData {
  loops: { required: string[] };
}

interface Upload { key: string; file: string; contentType: string; bytes: number }

const readJson = <T>(file: string, hint: string): T => {
  if (!existsSync(file)) {
    console.error(`Missing ${path.relative(REPO, file)} — ${hint}`);
    process.exit(1);
  }
  return JSON.parse(readFileSync(file, 'utf8')) as T;
};

const hash8 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex').slice(0, 8);

const CONTENT_TYPES: Record<string, string> = { '.jpg': 'image/jpeg', '.mp4': 'video/mp4' };

/** Reads a dist file and plans its upload under a content-hashed key. */
function plan(uploads: Upload[], distFile: string, dir: 'loops', stem: string): Asset {
  const file = path.join(DIST, distFile);
  const ext = path.extname(file);
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) throw new Error(`Unexpected file type in dist: ${distFile}`);
  const buf = readFileSync(file);
  const libraryPath = `${dir}/${stem}.${hash8(buf)}${ext}`;
  uploads.push({ key: `${PREFIX}/${libraryPath}`, file, contentType, bytes: buf.length });
  return { path: libraryPath, bytes: buf.length };
}

async function main() {
  const upload = process.argv.includes('--upload');
  const allowPartial = process.argv.includes('--allow-partial');

  const data = readJson<LibraryData>(DATA_FILE, 'run `npx tsx scripts/visual-library/export_data.ts` first.');
  const index = readJson<DistIndex>(INDEX_FILE, 'run `python3 scripts/visual-library/build_dist.py` first.');

  // ── Coverage: the same rule the app's manifest test enforces ─────────────────
  // A loop for every look the app can show, plus the recap.
  const missingLoops = data.loops.required.filter(key => !index.loops[key]);
  if (missingLoops.length) {
    console.error(`Incomplete library — loops missing: ${missingLoops.join(', ')}`);
    if (!allowPartial) process.exit(1);
    console.error('--allow-partial: continuing anyway. Do not ship this manifest.');
  }

  // ── Plan ─────────────────────────────────────────────────────────────────────
  const previous = existsSync(MANIFEST_FILE)
    ? (JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) as Manifest)
    : { version: 0, loops: {} };
  const manifest: Manifest = { version: previous.version + 1, loops: {} };
  const uploads: Upload[] = [];

  for (const [key, entry] of Object.entries(index.loops).sort(([a], [b]) => a.localeCompare(b))) {
    const video = plan(uploads, entry.file, 'loops', key);
    const poster = plan(uploads, entry.poster, 'loops', `${key}.poster`);
    manifest.loops[key] = { ...video, w: entry.w, h: entry.h, poster };
  }

  const totalMB = uploads.reduce((sum, u) => sum + u.bytes, 0) / 1024 / 1024;
  console.log(`${Object.keys(manifest.loops).length} loops, ${uploads.length} files, ${totalMB.toFixed(1)} MB`);

  if (!upload) {
    writeFileSync(PREVIEW_FILE, JSON.stringify(manifest, null, 2) + '\n');
    for (const u of uploads) console.log(`  would upload ${u.key} (${(u.bytes / 1024).toFixed(0)} KB)`);
    console.log(`Dry run. Manifest preview: ${path.relative(REPO, PREVIEW_FILE)}. Re-run with --upload to publish.`);
    return;
  }

  // Imported only now, so a dry run needs no R2 credentials at all.
  const { putLibraryObject, libraryObjectExists, R2_PUBLIC_BASE_URL } = await import('../lib/r2');
  console.log(`Bucket: ${process.env.R2_BUCKET_NAME} → ${R2_PUBLIC_BASE_URL}`);

  let uploaded = 0;
  for (const u of uploads) {
    if (await libraryObjectExists(u.key)) {
      console.log(`  exists   ${u.key}`);
      continue;
    }
    await putLibraryObject(u.key, readFileSync(u.file), u.contentType);
    uploaded++;
    console.log(`  uploaded ${u.key}`);
  }

  // Written only after every upload succeeded, so the committed manifest can
  // never point at a file that isn't there.
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Uploaded ${uploaded}, skipped ${uploads.length - uploaded}. Wrote ${path.relative(REPO, MANIFEST_FILE)} (version ${manifest.version}).`);
  console.log(`Set EXPO_PUBLIC_LIBRARY_BASE_URL=${R2_PUBLIC_BASE_URL}/${PREFIX} in .env and in eas.json's preview + production env.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
