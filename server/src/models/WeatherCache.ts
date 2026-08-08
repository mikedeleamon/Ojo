import mongoose, { Document, Schema } from 'mongoose';

/**
 * Shared (L2) weather cache.
 *
 * The in-process Map in lib/ttlCache is L1: fast, but it dies with the process.
 * Every deploy therefore dumped the whole cache and every active location
 * re-fetched — one extra billable WeatherKit call per warm cell, per deploy.
 * This collection survives restarts and is shared across instances, so a fresh
 * container serves from Mongo instead of paying Apple again.
 *
 * `_id` IS the cache key (see lib/weatherKit), which gives a unique index for
 * free and makes writes a single atomic upsert.
 */
// Document<string> — the _id is our cache key, not an ObjectId.
export interface IWeatherCache extends Document<string> {
  _id:       string;
  payload:   unknown;
  expiresAt: Date;
}

const weatherCacheSchema = new Schema<IWeatherCache>(
  {
    _id:       { type: String },
    // Shape is owned by weatherKit's NormalisedBundle. Mixed because Mongoose
    // must not try to validate or cast it — the cache is opaque storage, and
    // the key's version prefix is what guards against shape drift.
    payload:   { type: Schema.Types.Mixed, required: true },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

// Reclaims disk only. Mongo's TTL monitor runs on a ~60-second cycle, so an
// expired document can still be present when we read it — readers MUST compare
// expiresAt themselves rather than trusting this index for correctness.
weatherCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IWeatherCache>('WeatherCache', weatherCacheSchema);
