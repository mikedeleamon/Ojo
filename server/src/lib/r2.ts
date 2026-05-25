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
const PUBLIC_URL = `https://${process.env.R2_ACCOUNT_ID}.r2.dev`;

export async function uploadToR2(base64: string, fileName?: string): Promise<string> {
  try {
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) throw new Error('Invalid base64 format');

    const [, mimeType, data] = matches;
    const buffer = Buffer.from(data, 'base64');
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const key = `articles/${fileName ?? uuid()}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));

    return `${PUBLIC_URL}/${key}`;
  } catch (err) {
    console.error('[r2] upload error:', err);
    throw err;
  }
}

export async function deleteFromR2(url: string): Promise<void> {
  try {
    if (!url.includes(PUBLIC_URL)) return;
    const key = url.replace(`${PUBLIC_URL}/`, '');
    await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    console.error('[r2] delete error:', err);
  }
}
