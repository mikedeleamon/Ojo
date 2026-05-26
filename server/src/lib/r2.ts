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
