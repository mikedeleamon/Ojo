# Cloudflare R2 Image Migration

This document explains how Ojo now stores images in Cloudflare R2 instead of MongoDB, and how to migrate existing base64 images.

## What Changed

### Before
- Article images stored as **base64 data URIs** directly in MongoDB
- Risk: MongoDB's 16MB document limit
- Storage: Expensive per-GB from Atlas
- No CDN delivery

### After
- Article images uploaded to **Cloudflare R2** via the server
- Public R2 URL stored in MongoDB (small string, not large binary)
- Storage: $0.015/GB (R2 is much cheaper)
- Automatic CDN delivery via R2 domain

## Architecture

### Client Flow (New)
1. User picks/captures image → `pickImage()` or `captureImage()` (returns base64)
2. `ArticleModal` calls `uploadImageToR2(base64, closetId)`
3. Server endpoint `POST /api/closets/:closetId/upload-image` receives base64
4. Server uploads to R2, returns public URL
5. Client stores **R2 URL** in article form (not base64)

### Server Flow (New)
- `uploadToR2(base64)` — Converts base64 → buffer → S3 PutObject to R2 → returns public URL
- `deleteFromR2(url)` — Removes image from R2 (called on article delete/update)
- Articles no longer embed `imageUrl` as base64; store as public R2 URL string

## Usage

### For New Uploads (Automatic)
When a user adds/edits an article and picks an image:
1. Image is uploaded to R2 automatically
2. R2 public URL is stored in MongoDB
3. No base64 data in the database

### For Existing Images (Manual Migration)

Run the migration script once to move all existing base64 images to R2:

```bash
cd server
npx ts-node src/scripts/migrateImagesToR2.ts
```

This script:
- Finds all articles with base64 `imageUrl` fields
- Uploads each to R2
- Updates the MongoDB document with the public R2 URL
- Reports progress and errors

**Expected output:**
```
Found 42 closets with base64 images
Migrating article 60c1...
Migrating article 60c2...
...
Migration complete!
  Migrated: 42
  Skipped:  0
  Errors:   0
```

After migration, no more base64 in the `imageUrl` field — only R2 URLs like:
```
https://pub-[account-id].r2.dev/articles/[uuid].jpg
```

## Environment Variables

Add to `.env` (already in `.env.example`):

```env
R2_ACCESS_KEY_ID=xxxxx
R2_SECRET_ACCESS_KEY=xxxxx
R2_ACCOUNT_ID=xxxxx
R2_BUCKET_NAME=ojo-wardrobe-images
```

Get these from Cloudflare Dashboard → R2 → Create API Token

## Database

### `articles.imageUrl` Field Changes
- **Before**: `data:image/jpeg;base64,/9j/4AAQSkZJRg...` (megabytes)
- **After**: `https://pub-[account-id].r2.dev/articles/[uuid].jpg` (kilobytes)

### Document Size
- Old: Single article with 5MB image = 5MB+ document
- New: Article metadata + URL string = ~1KB

### Database Cleanup
After migration, old base64 images are in MongoDB but not used. Optional: run this to clean them out (after confirming R2 migration succeeded):

```javascript
// In mongosh
db.closets.updateMany(
  { "articles.imageUrl": { $regex: "^data:" } },
  { $set: { "articles[].imageUrl": "" } }
)
```

## API Changes

### New Endpoint
```
POST /api/closets/:closetId/upload-image
Content-Type: application/json

{
  "base64": "data:image/jpeg;base64,..."
}

Response:
{
  "imageUrl": "https://pub-[account-id].r2.dev/articles/[uuid].jpg"
}
```

### Article CRUD (Unchanged)
- POST/PUT `/api/closets/:closetId/articles` still work the same
- Now the `imageUrl` field expects a public R2 URL (or empty string)
- Base64 no longer accepted in the `imageUrl` field

## Client Code

### Before
```typescript
const result = await pickImage(); // base64
set('imageUrl', result.uri); // ← store base64 directly
```

### After
```typescript
const result = await pickImage(); // base64
const r2Url = await uploadImageToR2(result.uri, closetId); // ← upload first
set('imageUrl', r2Url); // ← store R2 URL
```

## Cost Estimation

### Example: 1000 users with 50 articles each = 50k images

**Old (Base64 in MongoDB):**
- MongoDB storage: ~250GB (5MB avg per image)
- Cost: ~$1,500/month (Atlas at $0.10/GB)

**New (R2):**
- R2 storage: ~250GB (same data)
- Cost: ~$4/month (R2 at $0.015/GB)
- Plus: CDN egress ($0.02/GB, amortized across users)

**Savings: ~$1,500/month** ✨

## Rollback (If Needed)

If something breaks, you can temporarily disable R2 uploads:

1. Comment out `uploadImageToR2` call in `ArticleModal.tsx`
2. Revert to storing base64 in `imageUrl` field
3. Database supports both formats (old base64 + new R2 URLs)

However, **the migration is idempotent** — run it again anytime to re-upload any base64 images found.

## Troubleshooting

### Upload fails with "Invalid base64 format"
- Ensure the base64 is a proper data URI: `data:image/jpeg;base64,...`
- The `pickImage()` and `captureImage()` functions enforce this

### Upload fails with 401 Unauthorized
- Check R2 credentials in `.env`
- Verify `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are correct

### Migration script hangs
- Check MongoDB connection
- Check R2 credentials
- Run with `--verbose` flag (not yet implemented, but can add if needed)

### R2 URL returns 403 Forbidden
- Bucket is not public. Go to Cloudflare Dashboard → R2 → Bucket Settings → CORS
- Ensure the bucket or domain is configured for public reads
- Or use a custom domain instead of `pub-[id].r2.dev` (requires CNAME)
