import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

const r2 = new S3Client({
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
});

const BUCKET = process.env.R2_BUCKET_NAME!;

// R2_PUBLIC_URL is the CDN root for image delivery.
// Default: the R2 public dev URL. Override with a custom domain once configured.
// e.g. R2_PUBLIC_URL=https://images.ojo.app
const PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`).replace(/\/$/, '');

// Images use UUIDs so they never change — safe to cache for 1 year
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

export async function uploadToR2(base64: string, fileName?: string): Promise<string> {
  const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 format');

  const [, mimeType, data] = matches;
  const buffer = Buffer.from(data, 'base64');
  const ext = mimeType.split('/')[1] ?? 'jpg';
  const key = `articles/${fileName ?? uuid()}.${ext}`;

  await r2.send(new PutObjectCommand({
    Bucket:       BUCKET,
    Key:          key,
    Body:         buffer,
    ContentType:  mimeType,
    CacheControl: CACHE_CONTROL,
  }));

  return `${PUBLIC_URL}/${key}`;
}

export async function deleteFromR2(url: string): Promise<void> {
  try {
    // Extract the key from the path regardless of which domain served the URL.
    // All article images are stored under the articles/ prefix.
    const match = url.match(/\/(articles\/.+)$/);
    if (!match) return;
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: match[1] }));
  } catch (err) {
    console.error('[r2] delete error:', err);
  }
}

/**
 * Bulk cleanup for the paths that drop many articles at once — deleting a
 * closet, or deleting an account. Without this the objects those articles
 * pointed at stay in the bucket forever, which the Privacy Policy says they
 * won't.
 *
 * Runs a few deletes at a time rather than all at once so a large closet
 * doesn't open hundreds of concurrent connections. Skips legacy `data:` URLs,
 * which were stored inline and never had an R2 object. Never throws:
 * deleteFromR2 logs and swallows its own failures, so one bad key can't
 * abandon the rest of the batch.
 */
export async function deleteManyFromR2(
  urls: (string | undefined | null)[],
  concurrency = 8,
): Promise<void> {
  const queue = urls.filter(
    (u): u is string => typeof u === 'string' && u.length > 0 && !u.startsWith('data:'),
  );
  if (queue.length === 0) return;

  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, queue.length) },
    async () => {
      // Safe without a lock: the increment never yields to the event loop.
      while (cursor < queue.length) await deleteFromR2(queue[cursor++]);
    },
  );
  await Promise.all(workers);
}
